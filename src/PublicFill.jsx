
import { useState, useEffect, useCallback } from "react";
import { supabase, C, Btn, Card, ErrorBanner, Stars, loadScript, ensureXLSX,
  useSchoolLookup, useSchoolCount, logAction, MinistryLookup } from "./lib.jsx";

function PublicFill({ survey, onBack }) {
  const isOpen = survey.survey_type === "open";
  const isSupervisor = survey.survey_type === "supervisor";
  const isExpired = survey.expires_at && new Date(survey.expires_at) < new Date();

  const [school, setSchool] = useState(null);
  const [supervisor, setSupervisor] = useState(null); // للاستبيانات الخاصة بالمشرفين
  const [nationalId, setNationalId] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [respondentLabel, setRespondentLabel] = useState("");
  const [ans, setAns] = useState({});
  const [errs, setErrs] = useState({});
  const [step, setStep] = useState(isOpen ? "fill" : "identify");
  const [submitting, setSubmitting] = useState(false);
  const [existingResp, setExistingResp] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [gateStopped, setGateStopped] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState({});

  // إن كان الاستبيان منتهياً، نعرض رسالة إغلاق فوراً
  if (isExpired) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24, direction:"rtl", textAlign:"center" }}>
      <div style={{ fontSize:72, marginBottom:16 }}>⛔</div>
      <h2 style={{ color:C.danger, margin:"0 0 8px", fontSize:22, fontWeight:800 }}>انتهت مدة الاستبيان</h2>
      <p style={{ color:C.muted, fontSize:14 }}>
        انتهى هذا الاستبيان في {new Date(survey.expires_at).toLocaleDateString("ar-SA")} ولم يعد يقبل ردوداً جديدة.
      </p>
    </div>
  );

  const setA = (id, v) => { setAns(p=>({...p,[id]:v})); setErrs(p=>({...p,[id]:null})); };

  async function lookupSupervisor() {
    if (!nationalId.trim()) return;
    setLookingUp(true); setLookupError("");
    const { data, error } = await supabase.from("supervisors").select("*")
      .eq("national_id", nationalId.trim()).maybeSingle();
    setLookingUp(false);
    if (error || !data) { setLookupError("رقم الهوية غير موجود في قاعدة بيانات المشرفين"); return; }
    setSupervisor(data);
    setStep("fill");
  }

  async function checkExisting(s) {
    const { data } = await supabase
      .from("survey_responses")
      .select("submitted_at, answers")
      .eq("survey_id", survey.id)
      .eq("school_id", s.id)
      .maybeSingle();
    if (data) {
      setExistingResp(data);
      // تحميل الإجابات السابقة تلقائياً لتسهيل التعديل
      if (data.answers) setAns(data.answers);
    }
  }

  async function uploadFile(questionId, file) {
    if (!file) return;
    setUploadingFiles(p => ({...p, [questionId]: true}));
    const ext = file.name.split(".").pop();
    const path = `${survey.id}/${questionId}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("survey-files").upload(path, file);
    if (upErr) { setErrs(p=>({...p,[questionId]:"فشل رفع الملف"})); setUploadingFiles(p=>({...p,[questionId]:false})); return; }
    const { data } = supabase.storage.from("survey-files").getPublicUrl(path);
    setA(questionId, { url: data.publicUrl, name: file.name, size: file.size });
    setUploadingFiles(p => ({...p, [questionId]: false}));
  }

  // يحدد أي الأسئلة تُعرَض فعلياً بناءً على إجابة سؤال البوابة (إن وُجد)
  function visibleQuestions() {
    if (!survey.gate_question_id) return survey.questions;
    const gateAnswer = ans[survey.gate_question_id];
    if (gateAnswer === survey.gate_required_value) return survey.questions;
    return survey.questions.filter(q => q.id === survey.gate_question_id);
  }

  async function submit() {
    const qsToValidate = visibleQuestions();
    const e = {};
    qsToValidate.forEach(q => { if(q.required && !ans[q.id]) e[q.id]="هذا الحقل مطلوب"; });
    if (Object.keys(e).length) { setErrs(e); return; }

    const stoppedAtGate = survey.gate_question_id
      && ans[survey.gate_question_id] !== undefined
      && ans[survey.gate_question_id] !== survey.gate_required_value;

    setSubmitting(true); setSubmitError("");
    const payload = {
      survey_id: survey.id,
      answers: stoppedAtGate ? { [survey.gate_question_id]: ans[survey.gate_question_id] } : ans,
      submitted_at: new Date().toISOString(),
      completed: !stoppedAtGate,
    };
    if (isOpen) {
      payload.respondent_label = respondentLabel.trim() || null;
    } else if (isSupervisor) {
      payload.respondent_label = supervisor?.name || null;
    } else {
      payload.school_id = school.id;
    }

    let submitError2;
    if (!isOpen && !isSupervisor) {
      // استبيان مدارس: upsert لمنع التكرار
      const { error: e } = await supabase.from("survey_responses")
        .upsert(payload, { onConflict: "survey_id,school_id" });
      submitError2 = e;
    } else {
      // مفتوح أو مشرفين: insert عادي (لا يوجد قيد تعارض)
      const { error: e } = await supabase.from("survey_responses").insert(payload);
      submitError2 = e;
    }
    const error = submitError2;

    setSubmitting(false);
    if (error) { setSubmitError("حدث خطأ أثناء الإرسال. حاول مرة أخرى."); return; }
    if (stoppedAtGate) setGateStopped(true);
    setStep("done");
  }

  if (step === "done") return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24, direction:"rtl", textAlign:"center" }}>
      <div style={{ fontSize:72, marginBottom:16 }}>✅</div>
      <h2 style={{ color:C.primary, margin:"0 0 8px", fontSize:22, fontWeight:800 }}>
        {gateStopped ? "شكراً لإجابتك" : "تم إرسال إجاباتك بنجاح"}
      </h2>
      {!isOpen ? (
        <>
          <p style={{ color:C.muted, fontSize:14, maxWidth:320, lineHeight:1.8 }}>
            شكراً <strong style={{color:C.dark}}>{school?.principal}</strong><br/>
            تم تسجيل رد <strong style={{color:C.dark}}>{school?.name}</strong> في قاعدة البيانات
          </p>
          <div style={{ background:C.primaryBg, borderRadius:12, padding:14, marginTop:20, width:"100%", maxWidth:300 }}>
            <p style={{ margin:0, fontSize:11, color:C.muted }}>الرقم الوزاري</p>
            <p style={{ margin:"4px 0 0", fontSize:22, fontWeight:800, color:C.primary, letterSpacing:2 }}>#{school?.id}</p>
          </div>
        </>
      ) : (
        <p style={{ color:C.muted, fontSize:14, maxWidth:320, lineHeight:1.8 }}>
          تم تسجيل ردك بنجاح في قاعدة البيانات
        </p>
      )}
      {!gateStopped && (
        <button onClick={()=>setStep("fill")} style={{ marginTop:20, background:"none",
          border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 24px",
          fontSize:13, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
          ✏️ تعديل إجاباتي
        </button>
      )}
    </div>
  );

  const qsToShow = visibleQuestions();

  return (
    <div style={{ minHeight:"100vh", background:C.bg, direction:"rtl" }}>
      <div style={{ background:C.primary, padding:"18px 16px", color:"#fff" }}>
        <p style={{ margin:0, fontSize:11, opacity:0.7 }}>إدارة التعليم — جدة</p>
        <h1 style={{ margin:"4px 0 0", fontSize:18, fontWeight:800 }}>{survey.title}</h1>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:16 }}>
        {existingResp && !isOpen && (
          <div style={{ background:C.warnBg, border:`1px solid ${C.warn}40`, borderRadius:12, padding:14, marginBottom:16 }}>
            <p style={{ margin:0, fontSize:13, color:C.warn, fontWeight:700 }}>
              ⚠️ مدرستك أجابت مسبقاً — إجابتك الجديدة ستحل محل الإجابة السابقة
            </p>
          </div>
        )}

        {step === "identify" && isSupervisor && (
          <Card style={{ marginBottom:16 }}>
            <p style={{ margin:"0 0 16px", fontSize:15, fontWeight:800, color:C.dark }}>أولاً: تحقق من هويتك كمشرف</p>
            <label style={{ display:"block", fontSize:14, fontWeight:700, color:C.dark, marginBottom:6 }}>
              رقم الهوية الوطنية <span style={{ color:C.danger }}>*</span>
            </label>
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <input value={nationalId} onChange={e=>{setNationalId(e.target.value);setSupervisor(null);}}
                placeholder="10 أرقام" onKeyDown={e=>e.key==="Enter"&&lookupSupervisor()}
                style={{ flex:1, padding:"12px 14px", border:`1.5px solid ${lookupError?C.danger:C.border}`,
                  borderRadius:10, fontSize:15, fontFamily:"inherit", boxSizing:"border-box", outline:"none",
                  direction:"ltr", textAlign:"center", fontWeight:700 }}/>
              <Btn onClick={lookupSupervisor} loading={lookingUp} sm>بحث</Btn>
            </div>
            <ErrorBanner message={lookupError}/>
            {supervisor && (
              <div style={{ background:C.successBg, border:`1.5px solid ${C.success}`, borderRadius:12, padding:14 }}>
                <p style={{ margin:"0 0 8px", fontSize:12, color:C.success, fontWeight:700 }}>✅ تم التحقق</p>
                <p style={{ margin:0, fontSize:15, fontWeight:800, color:C.dark }}>{supervisor.name}</p>
                <p style={{ margin:"4px 0 10px", fontSize:12, color:C.muted }}>رقم الهوية: {supervisor.national_id}</p>
                <Btn full onClick={()=>setStep("fill")}>✓ تأكيد — هذا أنا</Btn>
              </div>
            )}
          </Card>
        )}
        {step === "identify" && !isOpen && !isSupervisor && (
          <Card style={{ marginBottom:16 }}>
            <p style={{ margin:"0 0 16px", fontSize:15, fontWeight:800, color:C.dark }}>أولاً: تحقق من هوية مدرستك</p>
            <MinistryLookup onConfirm={async s => { setSchool(s); await checkExisting(s); setStep("fill"); }}/>
          </Card>
        )}

        {step === "fill" && (isOpen || isSupervisor || school) && (
          <>
            {!isOpen && !isSupervisor && school && (
              <div style={{ background:C.successBg, border:`1.5px solid ${C.success}`, borderRadius:12, padding:14, marginBottom:16 }}>
                <p style={{ margin:"0 0 4px", fontSize:12, color:C.success, fontWeight:700 }}>✅ تم التحقق</p>
                <p style={{ margin:0, fontSize:15, fontWeight:800, color:C.dark }}>{school.name}</p>
                <p style={{ margin:"3px 0 0", fontSize:12, color:C.muted }}>
                  {school.principal} · {school.stage} · رقم وزاري: {school.id}
                </p>
              </div>
            )}

            {isSupervisor && supervisor && (
              <div style={{ background:"#f5eefa", border:`1.5px solid #7B2D8B`, borderRadius:12, padding:14, marginBottom:16 }}>
                <p style={{ margin:"0 0 4px", fontSize:12, color:"#7B2D8B", fontWeight:700 }}>✅ تم التحقق من هويتك</p>
                <p style={{ margin:0, fontSize:15, fontWeight:800, color:C.dark }}>{supervisor.name}</p>
                <p style={{ margin:"3px 0 0", fontSize:12, color:C.muted }}>رقم الهوية: {supervisor.national_id}</p>
              </div>
            )}

            {isOpen && (
              <Card style={{ marginBottom:16 }}>
                <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>
                  الاسم أو الجهة <span style={{ fontSize:11, fontWeight:400, color:C.muted }}>(اختياري)</span>
                </label>
                <input value={respondentLabel} onChange={e=>setRespondentLabel(e.target.value)}
                  placeholder="مثال: إدارة المدرسة الفلانية، أو اسمك"
                  style={{ width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`, borderRadius:10,
                    fontSize:14, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none" }}/>
              </Card>
            )}

            {survey.description && (
              <div style={{ background:C.accentLight, borderRight:`4px solid ${C.accent}`, borderRadius:12, padding:14, marginBottom:16 }}>
                <p style={{ margin:0, fontSize:13, color:C.dark }}>{survey.description}</p>
              </div>
            )}

            {qsToShow.map((q, i) => (
              <Card key={q.id} style={{ marginBottom:14 }}>
                <p style={{ margin:"0 0 12px", fontWeight:700, color:C.dark, fontSize:15, lineHeight:1.5 }}>
                  <span style={{ color:C.primary, marginLeft:6 }}>{i+1}.</span>
                  {q.label}
                  {q.required && <span style={{ color:C.danger, marginRight:4 }}>*</span>}
                </p>
                {q.type==="text" && (
                  <input value={ans[q.id]||""} onChange={e=>setA(q.id,e.target.value)}
                    style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${errs[q.id]?C.danger:C.border}`,
                      borderRadius:10, fontSize:15, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none" }}/>
                )}
                {q.type==="textarea" && (
                  <textarea value={ans[q.id]||""} onChange={e=>setA(q.id,e.target.value)} rows={3}
                    style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${C.border}`, borderRadius:10,
                      fontSize:14, fontFamily:"inherit", direction:"rtl", resize:"vertical", boxSizing:"border-box", outline:"none" }}/>
                )}
                {q.type==="number" && (
                  <input type="number" value={ans[q.id]||""} onChange={e=>setA(q.id,e.target.value)}
                    style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${errs[q.id]?C.danger:C.border}`,
                      borderRadius:10, fontSize:16, fontFamily:"inherit", boxSizing:"border-box", outline:"none", fontWeight:700 }}/>
                )}
                {q.type==="select" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {(q.options||[]).map(opt => (
                      <button key={opt} onClick={()=>setA(q.id,opt)} style={{
                        width:"100%", padding:"14px 18px", borderRadius:12,
                        border:`2px solid ${ans[q.id]===opt?C.primary:C.border}`,
                        background:ans[q.id]===opt?C.primaryBg:"#fff",
                        color:ans[q.id]===opt?C.primary:C.text,
                        cursor:"pointer", fontSize:15, fontFamily:"inherit",
                        fontWeight:ans[q.id]===opt?700:400,
                        textAlign:"right", display:"flex", alignItems:"center", gap:10,
                        boxShadow:ans[q.id]===opt?`0 0 0 1px ${C.primary}`:"none",
                        transition:"all 0.15s" }}>
                        <span style={{ width:22, height:22, borderRadius:"50%", flexShrink:0,
                          border:`2px solid ${ans[q.id]===opt?C.primary:C.border}`,
                          background:ans[q.id]===opt?C.primary:"#fff",
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {ans[q.id]===opt && <span style={{ width:8, height:8, borderRadius:"50%", background:"#fff" }}/>}
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type==="rating" && <Stars value={ans[q.id]||0} onChange={v=>setA(q.id,v)}/>}
                {q.type==="file" && (
                  <div>
                    <input type="file"
                      accept={(q.allowed_file_types||"pdf,xlsx").split(",").map(t=>`.${t}`).join(",")}
                      onChange={e=>uploadFile(q.id, e.target.files?.[0])}
                      disabled={uploadingFiles[q.id]}
                      style={{ width:"100%", fontSize:13, marginBottom:8 }}/>
                    {uploadingFiles[q.id] && <p style={{ margin:0, fontSize:12, color:C.primary }}>جاري الرفع...</p>}
                    {ans[q.id]?.url && (
                      <div style={{ background:C.successBg, borderRadius:8, padding:"8px 12px" }}>
                        <p style={{ margin:0, fontSize:12, color:C.success }}>✅ تم رفع: {ans[q.id].name}</p>
                        <a href={ans[q.id].url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize:11, color:C.primary }}>عرض الملف ↗</a>
                      </div>
                    )}
                    <p style={{ margin:"6px 0 0", fontSize:11, color:C.muted }}>
                      الصيغ المقبولة: {(q.allowed_file_types||"pdf,xlsx").toUpperCase().replace(",","، ")}
                    </p>
                  </div>
                )}
                {errs[q.id] && <p style={{ color:C.danger, fontSize:12, margin:"8px 0 0" }}>{errs[q.id]}</p>}
                {survey.gate_question_id === q.id && ans[q.id] && ans[q.id] !== survey.gate_required_value && (
                  <p style={{ color:C.muted, fontSize:11.5, margin:"10px 0 0", background:C.bg, padding:"8px 10px", borderRadius:8 }}>
                    ℹ️ بناءً على إجابتك سينتهي الاستبيان هنا عند الإرسال.
                  </p>
                )}
              </Card>
            ))}

            <ErrorBanner message={submitError}/>
            <Btn full onClick={submit} loading={submitting} style={{ marginTop:4 }}>
              إرسال الإجابات ✓
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TRACKING PAGE (live from Supabase)
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// TRACKING — OPEN SURVEYS (no school verification)
// ═══════════════════════════════════════════════════════
export default PublicFill;
