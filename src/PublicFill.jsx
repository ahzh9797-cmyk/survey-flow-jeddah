import { useState } from "react";
import { supabase, C, Btn, Card, ErrorBanner, Stars } from "./lib.jsx";
import {
  SURVEY_TYPES, checkSurveyAccess, verifyEntity,
  checkDuplicateResponse, buildResponsePayload,
  VerificationStep
} from "./SurveyService.jsx";

// ═══════════════════════════════════════════════════════
// ACCESS GATE — checks survey_status, dates, approval
// ═══════════════════════════════════════════════════════
function SurveyAccessGate({ survey, children }) {
  const { allowed, reason } = checkSurveyAccess(survey);
  if (!allowed) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24, direction:"rtl", textAlign:"center" }}>
      <div style={{ fontSize:72, marginBottom:16 }}>⛔</div>
      <h2 style={{ color:C.danger, margin:"0 0 12px", fontSize:22, fontWeight:800 }}>الاستبيان غير متاح</h2>
      <p style={{ color:C.muted, fontSize:14, maxWidth:320, lineHeight:1.8 }}>{reason}</p>
    </div>
  );
  return children;
}

// ═══════════════════════════════════════════════════════
// ENTITY CARD — shown after successful verification
// ═══════════════════════════════════════════════════════
function EntityCard({ surveyType, entity }) {
  const configs = {
    school: {
      color: C.primary, bg: C.successBg, border: C.success,
      icon: "🏫",
      lines: [
        { label:"اسم المدرسة", value:entity.name },
        { label:"المرحلة",     value:entity.stage },
        { label:"القطاع",      value:entity.sector },
        { label:"المدير/ة",    value:entity.principal },
        { label:"الرقم الوزاري", value:entity.id },
      ]
    },
    supervisor: {
      color: "#7B2D8B", bg: "#f5eefa", border: "#7B2D8B",
      icon: "👤",
      lines: [
        { label:"الاسم",       value:entity.name },
        { label:"الإدارة",     value:entity.department },
        { label:"رقم الهوية", value:entity.national_id },
      ]
    },
    administrator: {
      color: "#B7791F", bg: "#FFFBEB", border: "#B7791F",
      icon: "🎓",
      lines: [
        { label:"الاسم",       value:entity.full_name },
        { label:"الإدارة",     value:entity.department },
        { label:"رقم الهوية", value:entity.national_id },
      ]
    },
  };
  const cfg = configs[surveyType];
  if (!cfg) return null;

  return (
    <div style={{ background:cfg.bg, border:`1.5px solid ${cfg.border}`,
      borderRadius:14, padding:16, marginBottom:16 }}>
      <p style={{ margin:"0 0 10px", fontSize:12, color:cfg.color, fontWeight:700 }}>
        {cfg.icon} ✅ تم التحقق من هويتك
      </p>
      {cfg.lines.filter(l=>l.value).map(l => (
        <div key={l.label} style={{ display:"flex", gap:8, marginBottom:3 }}>
          <span style={{ fontSize:12, color:C.muted, minWidth:80 }}>{l.label}:</span>
          <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{l.value}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PUBLIC FILL COMPONENT
// ═══════════════════════════════════════════════════════
function PublicFill({ survey, onBack }) {
  const isOpen = survey.survey_type === SURVEY_TYPES.PUBLIC;

  // Verified entity state (school / supervisor / administrator object)
  const [entity, setEntity]               = useState(null);
  const [respondentLabel, setRespondentLabel] = useState("");
  const [ans, setAns]                     = useState({});
  const [errs, setErrs]                   = useState({});
  const [step, setStep]                   = useState(isOpen ? "fill" : "identify");
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState("");
  const [gateStopped, setGateStopped]     = useState(false);
  const [existingResp, setExistingResp]   = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState({});

  const setA = (id, v) => { setAns(p=>({...p,[id]:v})); setErrs(p=>({...p,[id]:null})); };

  async function handleVerified(verifiedEntity) {
    // Check for existing response (for one_per_entity surveys)
    const responseLimit = survey.response_limit || "one_per_entity";
    const { isDuplicate, existingResponse } = await checkDuplicateResponse(
      survey.id, survey.survey_type, verifiedEntity, responseLimit
    );
    if (isDuplicate && existingResponse?.answers) {
      setExistingResp(existingResponse);
      setAns(existingResponse.answers); // pre-fill with previous answers
    }
    setEntity(verifiedEntity);
    setStep("fill");
  }

  function visibleQuestions() {
    if (!survey.gate_question_id) return survey.questions;
    const gateAnswer = ans[survey.gate_question_id];
    if (gateAnswer === survey.gate_required_value) return survey.questions;
    return survey.questions.filter(q => q.id === survey.gate_question_id);
  }

  async function uploadFile(questionId, file) {
    if (!file) return;
    setUploadingFiles(p=>({...p,[questionId]:true}));
    const ext = file.name.split(".").pop();
    const path = `${survey.id}/${questionId}_${Date.now()}.${ext}`;
    const { error:upErr } = await supabase.storage.from("survey-files").upload(path, file);
    if (upErr) { setErrs(p=>({...p,[questionId]:"فشل رفع الملف"})); setUploadingFiles(p=>({...p,[questionId]:false})); return; }
    const { data } = supabase.storage.from("survey-files").getPublicUrl(path);
    setA(questionId, { url:data.publicUrl, name:file.name, size:file.size });
    setUploadingFiles(p=>({...p,[questionId]:false}));
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

    const answers = stoppedAtGate
      ? { [survey.gate_question_id]: ans[survey.gate_question_id] }
      : ans;

    const payload = {
      survey_id: survey.id,
      submitted_at: new Date().toISOString(),
      ...buildResponsePayload(survey.survey_type, entity, respondentLabel, answers, stoppedAtGate, survey.gate_question_id),
    };

    // Choose insert strategy based on survey type + response_limit
    const responseLimit = survey.response_limit || "one_per_entity";
    let submitErr;

    if (survey.survey_type === SURVEY_TYPES.SCHOOL && responseLimit === "one_per_entity") {
      // School: upsert on (survey_id, school_id) — backward compatible
      const { error:e } = await supabase.from("survey_responses")
        .upsert(payload, { onConflict:"survey_id,school_id" });
      submitErr = e;
    } else if (
      (survey.survey_type === SURVEY_TYPES.SUPERVISOR || survey.survey_type === SURVEY_TYPES.ADMINISTRATOR)
      && responseLimit === "one_per_entity"
      && payload.respondent_national_id
    ) {
      // Supervisor / Administrator: delete existing then insert (upsert on national_id)
      await supabase.from("survey_responses")
        .delete()
        .eq("survey_id", survey.id)
        .eq("respondent_national_id", payload.respondent_national_id);
      const { error:e } = await supabase.from("survey_responses").insert(payload);
      submitErr = e;
    } else {
      // Public or unlimited: simple insert
      const { error:e } = await supabase.from("survey_responses").insert(payload);
      submitErr = e;
    }

    setSubmitting(false);
    if (submitErr) { setSubmitError("خطأ: " + (submitErr.message || submitErr.code || JSON.stringify(submitErr))); return; }
    if (stoppedAtGate) setGateStopped(true);
    setStep("done");
  }

  // ── Done Screen ──
  if (step === "done") return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24, direction:"rtl", textAlign:"center" }}>
      <div style={{ fontSize:72, marginBottom:16 }}>✅</div>
      <h2 style={{ color:C.primary, margin:"0 0 8px", fontSize:22, fontWeight:800 }}>
        {gateStopped ? "شكراً لإجابتك" : "تم إرسال إجاباتك بنجاح"}
      </h2>
      {entity && (
        <div style={{ background:C.primaryBg, borderRadius:12, padding:16, marginTop:12,
          width:"100%", maxWidth:320, textAlign:"right" }}>
          <p style={{ margin:"0 0 6px", fontSize:12, color:C.muted }}>تم التسجيل باسم:</p>
          <p style={{ margin:0, fontSize:16, fontWeight:800, color:C.dark }}>
            {entity.name || entity.full_name}
          </p>
        </div>
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
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${C.primary},${C.primaryDark})`,
        padding:"18px 16px", color:"#fff" }}>
        <p style={{ margin:0, fontSize:11, opacity:0.7 }}>إدارة التعليم — جدة</p>
        <h1 style={{ margin:"4px 0 0", fontSize:18, fontWeight:800 }}>{survey.title}</h1>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:16 }}>

        {/* Existing response warning */}
        {existingResp && (
          <div style={{ background:C.warnBg, border:`1px solid ${C.warn}40`,
            borderRadius:12, padding:14, marginBottom:16 }}>
            <p style={{ margin:0, fontSize:13, color:C.warn, fontWeight:700 }}>
              ⚠️ لديك إجابة سابقة — إجابتك الجديدة ستحل محلها
            </p>
          </div>
        )}

        {/* IDENTIFY STEP */}
        {step === "identify" && !isOpen && (
          <VerificationStep
            survey={survey}
            onVerified={handleVerified}
          />
        )}

        {/* FILL STEP */}
        {step === "fill" && (
          <>
            {/* Entity confirmation card */}
            {entity && (
              <EntityCard surveyType={survey.survey_type} entity={entity}/>
            )}

            {/* Open survey — optional name field */}
            {isOpen && (
              <Card style={{ marginBottom:16 }}>
                <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>
                  الاسم أو الجهة <span style={{ fontSize:11, fontWeight:400, color:C.muted }}>(اختياري)</span>
                </label>
                <input value={respondentLabel} onChange={e=>setRespondentLabel(e.target.value)}
                  placeholder="مثال: إدارة المدرسة، أو اسمك"
                  style={{ width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`,
                    borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl",
                    boxSizing:"border-box", outline:"none" }}/>
              </Card>
            )}

            {/* Survey description */}
            {survey.description && (
              <div style={{ background:C.accentLight, borderRight:`4px solid ${C.accent}`,
                borderRadius:12, padding:14, marginBottom:16 }}>
                <p style={{ margin:0, fontSize:13, color:C.dark }}>{survey.description}</p>
              </div>
            )}

            {/* Questions */}
            {qsToShow.map((q, i) => (
              <Card key={q.id} style={{ marginBottom:14 }}>
                <p style={{ margin:"0 0 12px", fontWeight:700, color:C.dark, fontSize:15, lineHeight:1.5 }}>
                  <span style={{ color:C.primary, marginLeft:6 }}>{i+1}.</span>
                  {q.label}
                  {q.required && <span style={{ color:C.danger, marginRight:4 }}>*</span>}
                </p>

                {q.type==="text" && (
                  <input value={ans[q.id]||""} onChange={e=>setA(q.id,e.target.value)}
                    style={{ width:"100%", padding:"12px 14px",
                      border:`1.5px solid ${errs[q.id]?C.danger:C.border}`, borderRadius:10,
                      fontSize:15, fontFamily:"inherit", direction:"rtl",
                      boxSizing:"border-box", outline:"none" }}/>
                )}
                {q.type==="textarea" && (
                  <textarea value={ans[q.id]||""} onChange={e=>setA(q.id,e.target.value)} rows={3}
                    style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${C.border}`,
                      borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl",
                      resize:"vertical", boxSizing:"border-box", outline:"none" }}/>
                )}
                {q.type==="number" && (
                  <input type="number" value={ans[q.id]||""} onChange={e=>setA(q.id,e.target.value)}
                    style={{ width:"100%", padding:"12px 14px",
                      border:`1.5px solid ${errs[q.id]?C.danger:C.border}`, borderRadius:10,
                      fontSize:16, fontFamily:"inherit", boxSizing:"border-box",
                      outline:"none", fontWeight:700 }}/>
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
                        fontWeight:ans[q.id]===opt?700:400, textAlign:"right",
                        display:"flex", alignItems:"center", gap:10,
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
                        <p style={{ margin:0, fontSize:12, color:C.success }}>✅ {ans[q.id].name}</p>
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
                {survey.gate_question_id===q.id && ans[q.id] && ans[q.id]!==survey.gate_required_value && (
                  <p style={{ color:C.muted, fontSize:11.5, margin:"10px 0 0",
                    background:C.bg, padding:"8px 10px", borderRadius:8 }}>
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

// Wrap with access gate
function PublicFillWithGate({ survey, onBack }) {
  return (
    <SurveyAccessGate survey={survey}>
      <PublicFill survey={survey} onBack={onBack}/>
    </SurveyAccessGate>
  );
}

export default PublicFillWithGate;

