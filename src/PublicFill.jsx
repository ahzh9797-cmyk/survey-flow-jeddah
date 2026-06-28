import { useState } from "react";
import { supabase, C, Btn, Card, ErrorBanner, Stars } from "./lib.jsx";
import {
  SURVEY_TYPES, checkSurveyAccess, verifyEntity,
  checkDuplicateResponse, buildResponsePayload,
  VerificationStep
} from "./SurveyService.jsx";

// ── Premium styles ──────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("publicfill-premium-styles")) {
  const _s = document.createElement("style");
  _s.id = "publicfill-premium-styles";
  _s.textContent = `
    .pf-option { transition: all 0.15s ease; }
    .pf-option:hover { border-color: #059669 !important; background: #ECFDF5 !important; }
    .pf-input:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; outline: none; }
    .pf-card { animation: pf-in 0.2s ease both; }
    @keyframes pf-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pf-done { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
    .pf-done-icon { animation: pf-done 0.5s cubic-bezier(0.22,1,0.36,1) both; }
    @keyframes spin { to { transform: rotate(360deg) } }
  `;
  document.head.appendChild(_s);
}

const F = {
  e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
  e100:"#D1FAE5",e50:"#ECFDF5",
  gold:"#C9A84C",goldL:"#FEF3C7",
  s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
  s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
  white:"#FFFFFF",bg:"#F0F4F8",
  danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
  success:"#059669",successBg:"#ECFDF5",purple:"#7B2D8B",amber:"#B7791F",
};

// ── ACCESS GATE — logic unchanged ──────────────────────
function SurveyAccessGate({ survey, children }) {
  const { allowed, reason } = checkSurveyAccess(survey);
  if (!allowed) return (
    <div style={{ minHeight:"100vh",
      background:`linear-gradient(135deg, ${F.e900} 0%, ${F.e800} 100%)`,
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:24, direction:"rtl", textAlign:"center" }}>
      <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:24, padding:40, maxWidth:360, width:"100%" }}>
        <div style={{ fontSize:64, marginBottom:16 }}>⛔</div>
        <h2 style={{ color:"#fff", margin:"0 0 12px", fontSize:22, fontWeight:800 }}>الاستبيان غير متاح</h2>
        <p style={{ color:"rgba(255,255,255,0.65)", fontSize:14, lineHeight:1.8, margin:0 }}>{reason}</p>
      </div>
    </div>
  );
  return children;
}

// ── ENTITY CARD — logic unchanged, premium UI ──────────
function EntityCard({ surveyType, entity }) {
  const configs = {
    school: {
      color:F.e700, bg:F.e50, border:`1px solid ${F.e100}`, icon:"🏫",
      lines:[
        {label:"اسم المدرسة",value:entity.name},
        {label:"المرحلة",value:entity.stage},
        {label:"القطاع",value:entity.sector},
        {label:"المدير/ة",value:entity.principal},
        {label:"الرقم الوزاري",value:entity.id},
      ]
    },
    supervisor: {
      color:F.purple, bg:"#F5EEFA", border:`1px solid #C4B5FD40`, icon:"👤",
      lines:[
        {label:"الاسم",value:entity.name},
        {label:"الإدارة",value:entity.department},
        {label:"رقم الهوية",value:entity.national_id},
      ]
    },
    administrator: {
      color:F.amber, bg:F.warnBg, border:`1px solid ${F.warn}30`, icon:"🎓",
      lines:[
        {label:"الاسم",value:entity.full_name},
        {label:"الإدارة",value:entity.department},
        {label:"رقم الهوية",value:entity.national_id},
      ]
    },
  };
  const cfg = configs[surveyType];
  if (!cfg) return null;

  return (
    <div style={{ background:cfg.bg, border:cfg.border, borderRadius:16, padding:16, marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:20 }}>{cfg.icon}</span>
        <span style={{ fontSize:12, color:cfg.color, fontWeight:700 }}>✅ تم التحقق من هويتك</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {cfg.lines.filter(l=>l.value).map(l=>(
          <div key={l.label} style={{ background:F.white, borderRadius:10, padding:"8px 12px" }}>
            <p style={{ margin:0, fontSize:10, color:F.s400 }}>{l.label}</p>
            <p style={{ margin:"2px 0 0", fontSize:13, fontWeight:700, color:F.s900 }}>{l.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── QUESTION INPUT COMPONENTS ───────────────────────────

function QuestionText({ value, onChange, hasError }) {
  return (
    <input value={value||""} onChange={e=>onChange(e.target.value)} className="pf-input"
      style={{ width:"100%", padding:"13px 14px",
        border:`1.5px solid ${hasError?F.danger:F.s200}`, borderRadius:12,
        fontSize:15, fontFamily:"inherit", direction:"rtl",
        boxSizing:"border-box", background:F.white, color:F.s900, transition:"all 0.2s" }}/>
  );
}

function QuestionTextarea({ value, onChange }) {
  return (
    <textarea value={value||""} onChange={e=>onChange(e.target.value)} rows={3} className="pf-input"
      style={{ width:"100%", padding:"13px 14px", border:`1.5px solid ${F.s200}`, borderRadius:12,
        fontSize:14, fontFamily:"inherit", direction:"rtl", resize:"vertical",
        boxSizing:"border-box", outline:"none", background:F.white, color:F.s900, transition:"all 0.2s" }}/>
  );
}

function QuestionNumber({ value, onChange, hasError }) {
  return (
    <input type="number" value={value||""} onChange={e=>onChange(e.target.value)} className="pf-input"
      style={{ width:"100%", padding:"13px 14px",
        border:`1.5px solid ${hasError?F.danger:F.s200}`, borderRadius:12,
        fontSize:18, fontFamily:"inherit", boxSizing:"border-box",
        background:F.white, color:F.s900, fontWeight:700, transition:"all 0.2s" }}/>
  );
}

function QuestionSelect({ options, value, onChange }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {(options||[]).map(opt=>(
        <button key={opt} onClick={()=>onChange(opt)} className="pf-option" style={{
          width:"100%", padding:"14px 16px", borderRadius:14,
          border:`2px solid ${value===opt?F.e600:F.s200}`,
          background:value===opt?F.e50:F.white,
          color:value===opt?F.e700:F.s700,
          cursor:"pointer", fontSize:14, fontFamily:"inherit",
          fontWeight:value===opt?700:400, textAlign:"right",
          display:"flex", alignItems:"center", gap:12,
          boxShadow:value===opt?`0 0 0 1px ${F.e500}20`:"none",
        }}>
          <span style={{
            width:22, height:22, borderRadius:"50%", flexShrink:0,
            border:`2px solid ${value===opt?F.e600:F.s300}`,
            background:value===opt?F.e600:F.white,
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"all 0.15s",
          }}>
            {value===opt && <span style={{ width:8, height:8, borderRadius:"50%", background:"#fff" }}/>}
          </span>
          {opt}
        </button>
      ))}
    </div>
  );
}

function QuestionFile({ questionId, value, onChange, allowedTypes, uploading, onUpload }) {
  return (
    <div>
      <label style={{
        display:"block", padding:"20px 16px",
        border:`2px dashed ${value?.url?F.e500:F.s200}`, borderRadius:14,
        textAlign:"center", cursor:"pointer", background:value?.url?F.e50:F.white,
        transition:"border-color 0.2s", marginBottom:8,
      }}>
        <input type="file"
          accept={allowedTypes.split(",").map(t=>`.${t}`).join(",")}
          onChange={e=>onUpload(questionId, e.target.files?.[0])}
          disabled={uploading} style={{ display:"none" }}/>
        {uploading ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <div style={{ width:20, height:20, borderRadius:"50%", border:`2px solid ${F.e100}`,
              borderTopColor:F.e600, animation:"spin 0.7s linear infinite" }}/>
            <span style={{ fontSize:13, color:F.e700 }}>جاري الرفع...</span>
          </div>
        ) : value?.url ? (
          <div>
            <div style={{ fontSize:24, marginBottom:4 }}>✅</div>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:F.e700 }}>{value.name}</p>
            <a href={value.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:11, color:F.e600 }}>عرض الملف ↗</a>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:28, marginBottom:6 }}>📎</div>
            <p style={{ margin:"0 0 2px", fontSize:13, fontWeight:600, color:F.s700 }}>اضغط لرفع ملف</p>
            <p style={{ margin:0, fontSize:11, color:F.s400 }}>
              {allowedTypes.toUpperCase().replace(",","، ")}
            </p>
          </div>
        )}
      </label>
    </div>
  );
}

// ── MAIN PUBLIC FILL ────────────────────────────────────
function PublicFill({ survey, onBack }) {
  const isOpen = survey.survey_type === SURVEY_TYPES.PUBLIC;

  // ── All state & logic unchanged ──
  const [entity,          setEntity]          = useState(null);
  const [respondentLabel, setRespondentLabel] = useState("");
  const [ans,             setAns]             = useState({});
  const [errs,            setErrs]            = useState({});
  const [step,            setStep]            = useState(isOpen?"fill":"identify");
  const [submitting,      setSubmitting]      = useState(false);
  const [submitError,     setSubmitError]     = useState("");
  const [gateStopped,     setGateStopped]     = useState(false);
  const [existingResp,    setExistingResp]    = useState(null);
  const [uploadingFiles,  setUploadingFiles]  = useState({});

  const setA = (id,v) => { setAns(p=>({...p,[id]:v})); setErrs(p=>({...p,[id]:null})); };

  async function handleVerified(verifiedEntity) {
    const responseLimit = survey.response_limit || "one_per_entity";
    const { isDuplicate, existingResponse } = await checkDuplicateResponse(survey.id, survey.survey_type, verifiedEntity, responseLimit);
    if (isDuplicate && existingResponse?.answers) { setExistingResp(existingResponse); setAns(existingResponse.answers); }
    setEntity(verifiedEntity); setStep("fill");
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
    const ext=file.name.split(".").pop();
    const path=`${survey.id}/${questionId}_${Date.now()}.${ext}`;
    const{error:upErr}=await supabase.storage.from("survey-files").upload(path,file);
    if(upErr){setErrs(p=>({...p,[questionId]:"فشل رفع الملف"}));setUploadingFiles(p=>({...p,[questionId]:false}));return;}
    const{data}=supabase.storage.from("survey-files").getPublicUrl(path);
    setA(questionId,{url:data.publicUrl,name:file.name,size:file.size});
    setUploadingFiles(p=>({...p,[questionId]:false}));
  }

  async function submit() {
    const qsToValidate=visibleQuestions();
    const e={};
    qsToValidate.forEach(q=>{if(q.required&&!ans[q.id])e[q.id]="هذا الحقل مطلوب";});
    if(Object.keys(e).length){setErrs(e);return;}
    const stoppedAtGate=survey.gate_question_id&&ans[survey.gate_question_id]!==undefined&&ans[survey.gate_question_id]!==survey.gate_required_value;
    setSubmitting(true);setSubmitError("");
    const answers=stoppedAtGate?{[survey.gate_question_id]:ans[survey.gate_question_id]}:ans;
    const payload={survey_id:survey.id,submitted_at:new Date().toISOString(),...buildResponsePayload(survey.survey_type,entity,respondentLabel,answers,stoppedAtGate,survey.gate_question_id)};
    const responseLimit=survey.response_limit||"one_per_entity";
    let submitErr;
    if(survey.survey_type===SURVEY_TYPES.SCHOOL&&responseLimit==="one_per_entity"){
      const{error:e}=await supabase.from("survey_responses").upsert(payload,{onConflict:"survey_id,school_id"});submitErr=e;
    } else if((survey.survey_type===SURVEY_TYPES.SUPERVISOR||survey.survey_type===SURVEY_TYPES.ADMINISTRATOR)&&responseLimit==="one_per_entity"&&payload.respondent_national_id){
      await supabase.from("survey_responses").delete().eq("survey_id",survey.id).eq("respondent_national_id",payload.respondent_national_id);
      const{error:e}=await supabase.from("survey_responses").insert(payload);submitErr=e;
    } else {
      const{error:e}=await supabase.from("survey_responses").insert(payload);submitErr=e;
    }
    setSubmitting(false);
    if(submitErr){setSubmitError("خطأ: "+(submitErr.message||submitErr.code||JSON.stringify(submitErr)));return;}
    if(stoppedAtGate)setGateStopped(true);
    setStep("done");
  }
  // ── End unchanged logic ──

  // ── Done Screen ──
  if (step==="done") return (
    <div style={{ minHeight:"100vh",
      background:`linear-gradient(135deg, ${F.e900} 0%, ${F.e800} 100%)`,
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:24, direction:"rtl", textAlign:"center" }}>
      <div style={{ background:"rgba(255,255,255,0.95)", borderRadius:24, padding:36,
        maxWidth:360, width:"100%", boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
        <div className="pf-done-icon" style={{ fontSize:72, marginBottom:16 }}>
          {gateStopped ? "🔔" : "✅"}
        </div>
        <h2 style={{ color:F.s900, margin:"0 0 8px", fontSize:20, fontWeight:800 }}>
          {gateStopped ? "شكراً لإجابتك" : "تم إرسال إجاباتك بنجاح"}
        </h2>
        {entity && (
          <div style={{ background:F.e50, border:`1px solid ${F.e100}`, borderRadius:12,
            padding:14, marginTop:16, textAlign:"right" }}>
            <p style={{ margin:"0 0 4px", fontSize:11, color:F.s400 }}>تم التسجيل باسم:</p>
            <p style={{ margin:0, fontSize:15, fontWeight:800, color:F.s900 }}>
              {entity.name || entity.full_name}
            </p>
          </div>
        )}
        {!gateStopped && (
          <button onClick={()=>setStep("fill")} style={{ marginTop:20, background:F.s100,
            border:"none", borderRadius:12, padding:"11px 24px",
            fontSize:13, color:F.s700, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            ✏️ تعديل إجاباتي
          </button>
        )}
      </div>
    </div>
  );

  const qsToShow = visibleQuestions();

  return (
    <div style={{ minHeight:"100vh", background:F.bg, direction:"rtl" }}>
      {/* Premium Header */}
      <div style={{
        background:`linear-gradient(135deg, ${F.e900} 0%, ${F.e800} 60%, #083d2e 100%)`,
        padding:"18px 16px 24px",
      }}>
        <p style={{ margin:"0 0 4px", fontSize:11, color:"rgba(255,255,255,0.5)", fontWeight:500 }}>
          إدارة التعليم — جدة
        </p>
        <h1 style={{ margin:0, fontSize:18, fontWeight:800, color:"#fff", lineHeight:1.3 }}>{survey.title}</h1>
        {survey.description && (
          <p style={{ margin:"8px 0 0", fontSize:12, color:"rgba(255,255,255,0.6)", lineHeight:1.6 }}>
            {survey.description}
          </p>
        )}
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"0 16px 80px" }}>
        {/* Wave connector */}
        <svg viewBox="0 0 375 16" style={{ display:"block", margin:"-1px -16px 0", width:"calc(100% + 32px)" }} preserveAspectRatio="none">
          <path d="M0,0 C120,16 255,16 375,0 L375,16 L0,16 Z" fill={F.e800}/>
        </svg>

        <div style={{ paddingTop:16 }}>
          {/* Existing response warning */}
          {existingResp && (
            <div style={{ background:F.warnBg, border:`1px solid ${F.warn}30`,
              borderRadius:14, padding:14, marginBottom:16,
              display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:18, flexShrink:0 }}>⚠️</span>
              <p style={{ margin:0, fontSize:13, color:F.warn, fontWeight:700, lineHeight:1.5 }}>
                لديك إجابة سابقة — إجابتك الجديدة ستحل محلها
              </p>
            </div>
          )}

          {/* IDENTIFY STEP */}
          {step==="identify" && !isOpen && (
            <div style={{ background:F.white, borderRadius:20, padding:20,
              border:`1px solid ${F.s200}`, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
              <VerificationStep survey={survey} onVerified={handleVerified}/>
            </div>
          )}

          {/* FILL STEP */}
          {step==="fill" && (
            <>
              {entity && <EntityCard surveyType={survey.survey_type} entity={entity}/>}

              {/* Open survey name */}
              {isOpen && (
                <div style={{ background:F.white, borderRadius:16, padding:16, marginBottom:14,
                  border:`1px solid ${F.s200}`, boxShadow:"0 2px 6px rgba(0,0,0,0.04)" }}>
                  <label style={{ display:"block", fontSize:13, fontWeight:700, color:F.s700, marginBottom:8 }}>
                    الاسم أو الجهة
                    <span style={{ fontSize:11, fontWeight:400, color:F.s400, marginRight:6 }}>(اختياري)</span>
                  </label>
                  <input value={respondentLabel} onChange={e=>setRespondentLabel(e.target.value)}
                    className="pf-input"
                    placeholder="مثال: إدارة المدرسة، أو اسمك"
                    style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${F.s200}`,
                      borderRadius:12, fontSize:14, fontFamily:"inherit", direction:"rtl",
                      boxSizing:"border-box", background:F.white, color:F.s900, transition:"all 0.2s" }}/>
                </div>
              )}

              {/* Questions */}
              {qsToShow.map((q, i) => (
                <div key={q.id} className="pf-card" style={{
                  background:F.white, borderRadius:18, padding:"16px 16px 14px",
                  marginBottom:12, border:`1px solid ${errs[q.id]?F.danger:F.s200}`,
                  boxShadow:errs[q.id]?`0 0 0 2px ${F.danger}20`:"0 2px 6px rgba(0,0,0,0.04)",
                  borderRight:`3px solid ${errs[q.id]?F.danger:F.e500}`,
                  animationDelay:`${i*0.04}s`,
                }}>
                  {/* Question header */}
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:14 }}>
                    <span style={{ background:F.e50, color:F.e700, borderRadius:8,
                      width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:12, fontWeight:800, flexShrink:0, marginTop:1 }}>{i+1}</span>
                    <p style={{ margin:0, fontWeight:700, color:F.s900, fontSize:14, lineHeight:1.5, flex:1 }}>
                      {q.label}
                      {q.required && <span style={{ color:F.danger, marginRight:4 }}>*</span>}
                    </p>
                  </div>

                  {/* Question inputs */}
                  {q.type==="text"     && <QuestionText    value={ans[q.id]} onChange={v=>setA(q.id,v)} hasError={!!errs[q.id]}/>}
                  {q.type==="textarea" && <QuestionTextarea value={ans[q.id]} onChange={v=>setA(q.id,v)}/>}
                  {q.type==="number"   && <QuestionNumber   value={ans[q.id]} onChange={v=>setA(q.id,v)} hasError={!!errs[q.id]}/>}
                  {q.type==="select"   && <QuestionSelect   options={q.options} value={ans[q.id]} onChange={v=>setA(q.id,v)}/>}
                  {q.type==="rating"   && <Stars value={ans[q.id]||0} onChange={v=>setA(q.id,v)}/>}
                  {q.type==="file"     && (
                    <QuestionFile questionId={q.id} value={ans[q.id]}
                      onChange={v=>setA(q.id,v)}
                      allowedTypes={q.allowed_file_types||"pdf,xlsx"}
                      uploading={!!uploadingFiles[q.id]}
                      onUpload={uploadFile}/>
                  )}

                  {/* Error */}
                  {errs[q.id] && (
                    <p style={{ color:F.danger, fontSize:12, margin:"10px 0 0",
                      display:"flex", alignItems:"center", gap:4 }}>
                      <span>⚠️</span>{errs[q.id]}
                    </p>
                  )}

                  {/* Gate hint */}
                  {survey.gate_question_id===q.id && ans[q.id] && ans[q.id]!==survey.gate_required_value && (
                    <div style={{ background:F.s50, borderRadius:10, padding:"10px 12px", marginTop:12,
                      border:`1px solid ${F.s200}` }}>
                      <p style={{ margin:0, fontSize:12, color:F.s500, lineHeight:1.6 }}>
                        ℹ️ بناءً على إجابتك سينتهي الاستبيان هنا عند الإرسال.
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {/* Submit error */}
              {submitError && (
                <div style={{ background:F.dangerBg, border:"1px solid #FECACA", borderRadius:14,
                  padding:"12px 16px", fontSize:13, color:F.danger, marginBottom:12,
                  display:"flex", gap:8 }}>
                  <span>⚠️</span>{submitError}
                </div>
              )}

              {/* Submit button */}
              <button onClick={submit} disabled={submitting} style={{
                width:"100%", padding:"16px 24px",
                background:submitting?`${F.e600}70`:`linear-gradient(135deg, ${F.e600} 0%, ${F.e800} 100%)`,
                color:"#fff", border:"none", borderRadius:16,
                fontSize:15, fontWeight:800, cursor:submitting?"not-allowed":"pointer",
                fontFamily:"inherit", letterSpacing:"0.01em",
                boxShadow:submitting?"none":`0 6px 20px ${F.e600}40`,
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                transition:"all 0.2s",
              }}>
                {submitting ? (
                  <>
                    <div style={{ width:18, height:18, borderRadius:"50%",
                      border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff",
                      animation:"spin 0.7s linear infinite" }}/>
                    جاري الإرسال...
                  </>
                ) : "إرسال الإجابات ✓"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Wrap with access gate ───────────────────────────────
function PublicFillWithGate({ survey, onBack }) {
  return (
    <SurveyAccessGate survey={survey}>
      <PublicFill survey={survey} onBack={onBack}/>
    </SurveyAccessGate>
  );
}

export default PublicFillWithGate;

