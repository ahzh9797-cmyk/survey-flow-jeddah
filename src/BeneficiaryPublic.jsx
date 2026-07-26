import { useState, useEffect } from "react";
import { supabase, Stars, Spinner } from "./lib.jsx";

// خدمة المستفيد — نموذج عام مستقل تمامًا عن محرك الاستبيانات الرئيسي
// (لا علاقة له بجداول surveys / survey_questions / survey_responses)

const F = {
  e900:"#064E3B", e800:"#065F46", e700:"#047857", e600:"#059669",
  s900:"#0F172A", s700:"#334155", s500:"#64748B", s400:"#94A3B8",
  s200:"#E2E8F0", s100:"#F1F5F9", white:"#FFFFFF", bg:"#F0F4F8",
  danger:"#DC2626", dangerBg:"#FEF2F2", success:"#059669",
};

function Field({ q, value, onChange, error }) {
  const inputStyle = {
    width:"100%", padding:"12px 14px", border:`1.5px solid ${error?F.danger:F.s200}`,
    borderRadius:12, fontSize:14, fontFamily:"inherit", direction:"rtl",
    boxSizing:"border-box", background:F.white, color:F.s900,
  };
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:13, fontWeight:700, color:F.s700, marginBottom:8 }}>
        {q.label}
        {!q.required && <span style={{ fontSize:11, fontWeight:400, color:F.s400, marginRight:6 }}>(اختياري)</span>}
      </label>

      {q.type==="text" && (
        <input value={value||""} onChange={e=>onChange(e.target.value)} style={inputStyle}/>
      )}

      {q.type==="textarea" && (
        <textarea value={value||""} onChange={e=>onChange(e.target.value)} rows={3}
          style={{ ...inputStyle, resize:"vertical" }}/>
      )}

      {q.type==="select" && (
        <select value={value||""} onChange={e=>onChange(e.target.value)} style={inputStyle}>
          <option value="">اختر...</option>
          {(q.options||[]).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}

      {q.type==="rating" && (
        <Stars value={value||0} onChange={onChange}/>
      )}

      {error && <p style={{ margin:"6px 0 0", fontSize:12, color:F.danger }}>{error}</p>}
    </div>
  );
}

export default function BeneficiaryPublic({ departmentId }) {
  const [department, setDepartment] = useState(null);
  const [questions,  setQuestions]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState("");
  const [ans,        setAns]        = useState({});
  const [errs,       setErrs]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError,setSubmitError]= useState("");
  const [done,       setDone]       = useState(false);

  useEffect(() => {
    (async () => {
      const { data: deptRows, error: deptErr } = await supabase
        .rpc("resolve_beneficiary_department", { p_id: departmentId });
      if (deptErr || !deptRows || !deptRows.length) {
        setLoadError("رابط غير صالح أو القسم غير متاح حاليًا.");
        setLoading(false);
        return;
      }
      setDepartment(deptRows[0]);

      const { data: qRows, error: qErr } = await supabase
        .from("beneficiary_questions")
        .select("*")
        .order("order_index", { ascending:true });
      if (qErr) {
        setLoadError("تعذر تحميل الاستبانة، حاول مرة أخرى.");
        setLoading(false);
        return;
      }
      setQuestions(qRows || []);
      setLoading(false);
    })();
  }, [departmentId]);

  function setA(id, v) { setAns(a => ({ ...a, [id]: v })); setErrs(e => ({ ...e, [id]: null })); }

  async function submit() {
    const e = {};
    questions.forEach(q => {
      if (q.required && !ans[q.id] && ans[q.id] !== 0) e[q.id] = "هذا الحقل مطلوب";
    });
    if (Object.keys(e).length) { setErrs(e); return; }

    setSubmitting(true); setSubmitError("");

    const phoneQuestion = questions.find(q => q.label.includes("جوال"));
    const phoneVal = phoneQuestion ? String(ans[phoneQuestion.id]||"").trim() : "";
    if (phoneQuestion && phoneVal) {
      const { data: already } = await supabase.rpc("check_beneficiary_phone_today", {
        p_department_id: departmentId,
        p_question_id: phoneQuestion.id,
        p_phone: phoneVal,
      });
      if (already) {
        setSubmitting(false);
        setSubmitError("تم إرسال رد بهذا الرقم اليوم بالفعل. يمكنك المحاولة غدًا.");
        return;
      }
    }

    const { error } = await supabase.from("beneficiary_responses").insert({
      department_id: departmentId,
      answers: ans,
    });
    setSubmitting(false);
    if (error) { setSubmitError("تعذر إرسال الرد، حاول مرة أخرى."); return; }
    setDone(true);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:F.bg }}>
      <Spinner size={32}/>
    </div>
  );

  if (loadError) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:F.bg, direction:"rtl", padding:24, textAlign:"center" }}>
      <p style={{ color:F.s500, fontSize:14 }}>{loadError}</p>
    </div>
  );

  if (done) return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      background:`linear-gradient(135deg, ${F.e900} 0%, ${F.e800} 100%)`, direction:"rtl", padding:24, textAlign:"center" }}>
      <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:24, padding:40, maxWidth:360, width:"100%" }}>
        <h2 style={{ color:"#fff", margin:"0 0 12px", fontSize:20, fontWeight:800 }}>تم إرسال إجاباتك بنجاح</h2>
        <p style={{ color:"rgba(255,255,255,0.65)", fontSize:13, lineHeight:1.8, margin:0 }}>شكرًا لك، رأيك يساعدنا على التطوير.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:F.bg, direction:"rtl", padding:"20px 16px 60px" }}>
      <div style={{ maxWidth:480, margin:"0 auto" }}>
        <div style={{ marginBottom:20, textAlign:"center" }}>
          <h1 style={{ margin:0, fontSize:18, fontWeight:800, color:F.s900 }}>استبانة تقييم خدمات الإدارة المدرسية</h1>
          <p style={{ margin:"6px 0 0", fontSize:12, color:F.s500 }}>{department?.name}</p>
        </div>

        <div style={{ background:F.white, borderRadius:16, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
          {questions.map(q => (
            <Field key={q.id} q={q} value={ans[q.id]} onChange={v=>setA(q.id, v)} error={errs[q.id]}/>
          ))}

          {submitError && (
            <p style={{ margin:"0 0 12px", padding:"10px 12px", background:F.dangerBg, color:F.danger,
              borderRadius:10, fontSize:12 }}>{submitError}</p>
          )}

          <button onClick={submit} disabled={submitting} style={{
            width:"100%", padding:"13px 16px", background:F.e600, color:"#fff",
            border:"none", borderRadius:12, fontSize:14, fontWeight:700,
            cursor:submitting?"default":"pointer", fontFamily:"inherit",
            opacity:submitting?0.7:1,
          }}>
            {submitting ? "جارٍ الإرسال..." : "إرسال"}
          </button>
        </div>
      </div>
    </div>
  );
}

