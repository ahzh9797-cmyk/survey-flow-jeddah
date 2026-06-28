import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ErrorBanner, ExportMenu,
  ensureXLSX, ensurePDF, pdfRTLText, tsStamp, loadScript, logAction,
  RoleBadge, ViewerNotice, useSchoolCount, useAppSettings, saveSetting } from "./lib.jsx";
import { SURVEY_TYPES, SURVEY_TYPE_LABELS, SURVEY_STATUS_LABELS,
  SurveyTypeSelector, SurveySettingsPanel } from "./SurveyService.jsx";
import { AudienceSelector, saveTargeting, loadTargeting, emptyTargeting } from "./TargetingService.jsx";
import { genId, deepClone } from "./utils.js";
import { audit, AUDIT_ACTION_LABELS } from "./AuditService.js";
import LifecycleActions, { LifecycleBadge } from "./LifecycleActions.jsx";
import { resolveState, LIFECYCLE_STATE_CONFIG } from "./SurveyLifecycleService.js";
import LoginPage from "./LoginPage.jsx";

// ── Premium UI styles ──────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("surveys-premium-styles")) {
  const _s = document.createElement("style");
  _s.id = "surveys-premium-styles";
  _s.textContent = `
    .survey-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .survey-card:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(0,0,0,0.10) !important; }
    .action-btn { transition: all 0.12s ease; }
    .action-btn:hover { filter: brightness(0.95); }
    .action-btn:active { transform: scale(0.95); }
    .search-input:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; outline: none; }
    .filter-chip { transition: all 0.15s ease; }
    @keyframes card-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .card-in { animation: card-in 0.25s ease both; }
    @keyframes spin { to { transform: rotate(360deg) } }
  `;
  document.head.appendChild(_s);
}

const PT = {
  e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
  e100:"#D1FAE5",e50:"#ECFDF5",
  gold:"#C9A84C",goldL:"#FEF3C7",
  s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
  s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
  white:"#FFFFFF",bg:"#F0F4F8",
  danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
  success:"#059669",successBg:"#ECFDF5",purple:"#7B2D8B",purpleBg:"#F5EEFA",amber:"#B7791F",
};



// ── Premium UI styles ──────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("surveys-premium-styles")) {
  const _s = document.createElement("style");
  _s.id = "surveys-premium-styles";
  _s.textContent = `
    .survey-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .survey-card:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(0,0,0,0.10) !important; }
    .survey-card:active { transform: scale(0.99); }
    .search-input:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; outline: none; }
    .filter-chip { transition: all 0.15s ease; }
    @keyframes card-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .card-in { animation: card-in 0.2s ease both; }
  `;
  document.head.appendChild(_s);
}

const PT = {
  e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
  e100:"#D1FAE5",e50:"#ECFDF5",
  gold:"#C9A84C",goldL:"#FEF3C7",
  s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
  s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
  white:"#FFFFFF",bg:"#F0F4F8",
  danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
  success:"#059669",successBg:"#ECFDF5",purple:"#7B2D8B",purpleBg:"#F5EEFA",
  amber:"#B7791F",
};



function SurveysList({ surveys, schoolCount, onNew, onShare, onTrack, loading, isAdmin, onDelete, onApprove, onEdit, onSaveAsTemplate, onLifecycleChange, user }) {
  const now = new Date();
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("الكل");

  if (loading) return (
    <div style={{ minHeight:"50vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:48, height:48, borderRadius:"50%", border:`3px solid ${PT.e100}`, borderTopColor:PT.e600, animation:"spin 0.7s linear infinite", margin:"0 auto 12px" }}/>
        <p style={{ color:PT.s500, fontSize:13, margin:0 }}>جاري التحميل...</p>
      </div>
    </div>
  );

  const typeColor = { school:PT.e700, supervisor:PT.purple, administrator:PT.amber, open:PT.gold };
  const typeBg    = { school:PT.e50,   supervisor:PT.purpleBg, administrator:PT.warnBg, open:PT.goldL };

  const STATE_FILTERS = ["الكل","منشورة","مسودة","موقوفة","مغلقة","مؤرشفة"];
  const STATE_MAP = { "منشورة":"published","مسودة":"draft","موقوفة":"paused","مغلقة":"closed","مؤرشفة":"archived" };

  const filtered = surveys.filter(s => {
    const state = resolveState(s);
    const stateOk = stateFilter === "الكل" || state === STATE_MAP[stateFilter];
    const searchOk = !search.trim() || s.title.includes(search) || (s.description||"").includes(search);
    return stateOk && searchOk;
  });

  function canShare(s) {
    const endDate = s.end_date || s.expires_at;
    const isExpired = endDate && new Date(endDate) < now;
    return !isExpired && s.approval_status==="approved" && resolveState(s)==="published" && isAdmin;
  }
  function canApprove(s) {
    return (s.approval_status==="pending_approval"||s.approval_status==="draft") && isAdmin;
  }

  // State badge config
  const STATE_BADGE = {
    published: { label:"✅ منشور",      bg:PT.e50,      color:PT.e700,   border:`${PT.e500}40` },
    draft:     { label:"📝 مسودة",       bg:PT.s100,     color:PT.s700,   border:`${PT.s300}` },
    paused:    { label:"⏸️ موقوف",      bg:PT.warnBg,   color:PT.warn,   border:`${PT.warn}40` },
    closed:    { label:"🔒 مغلق",        bg:PT.dangerBg, color:PT.danger, border:"#FECACA" },
    archived:  { label:"📦 مؤرشف",      bg:PT.s100,     color:PT.s400,   border:PT.s200 },
  };

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div>
            <h2 style={{ margin:0, fontSize:18, color:PT.s900, fontWeight:800, letterSpacing:"-0.01em" }}>الاستبيانات</h2>
            <p style={{ margin:"2px 0 0", color:PT.s500, fontSize:12 }}>{surveys.length} استبيان · {schoolCount} مدرسة</p>
          </div>
          <button onClick={onNew} style={{
            background:`linear-gradient(135deg,${PT.e600},${PT.e800})`,
            color:"#fff", border:"none", borderRadius:12,
            padding:"10px 18px", fontSize:13, fontWeight:800,
            cursor:"pointer", fontFamily:"inherit",
            boxShadow:`0 4px 16px ${PT.e600}40`,
            display:"flex", alignItems:"center", gap:6,
          }}>
            <span style={{ fontSize:16 }}>＋</span> جديد
          </button>
        </div>

        {/* Search */}
        <div style={{ position:"relative", marginBottom:10 }}>
          <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", fontSize:16, pointerEvents:"none" }}>🔍</span>
          <input
            className="search-input"
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="ابحث باسم الاستبيان أو الوصف..."
            style={{ width:"100%", padding:"11px 42px 11px 14px", border:`1.5px solid ${PT.s200}`,
              borderRadius:12, fontSize:13, fontFamily:"inherit", direction:"rtl",
              boxSizing:"border-box", background:PT.white, color:PT.s900, transition:"all 0.2s" }}/>
          {search && (
            <button onClick={()=>setSearch("")} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:PT.s400, cursor:"pointer", fontSize:16 }}>✕</button>
          )}
        </div>

        {/* State filters */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
          {STATE_FILTERS.map(f => (
            <button key={f} onClick={()=>setStateFilter(f)} className="filter-chip" style={{
              padding:"6px 14px", borderRadius:20, fontSize:12, fontFamily:"inherit",
              cursor:"pointer", whiteSpace:"nowrap", fontWeight:stateFilter===f?700:500,
              border:`1.5px solid ${stateFilter===f ? PT.e600 : PT.s200}`,
              background: stateFilter===f ? PT.e50 : PT.white,
              color: stateFilter===f ? PT.e700 : PT.s500,
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 20px", background:PT.white,
          borderRadius:20, border:`1px solid ${PT.s200}` }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
          <p style={{ margin:"0 0 6px", fontSize:15, fontWeight:700, color:PT.s900 }}>
            {surveys.length === 0 ? "لا توجد استبيانات بعد" : "لا توجد نتائج مطابقة"}
          </p>
          <p style={{ margin:0, fontSize:13, color:PT.s500 }}>
            {surveys.length === 0 ? "اضغط ＋ جديد لإنشاء أول استبيان" : "جرب تغيير الفلاتر أو البحث"}
          </p>
        </div>
      )}

      {/* Survey cards */}
      {filtered.map((s, idx) => {
        const endDate = s.end_date || s.expires_at;
        const isExpired = endDate && new Date(endDate) < now;
        const expiringSoon = endDate && !isExpired && (new Date(endDate)-now) < 24*60*60*1000;
        const state = resolveState(s);
        const badge = STATE_BADGE[state] || STATE_BADGE.draft;
        const tc = typeColor[s.survey_type] || PT.e700;
        const tb = typeBg[s.survey_type] || PT.e50;

        return (
          <div key={s.id} className="survey-card card-in"
            style={{ background:PT.white, borderRadius:18, border:`1px solid ${PT.s200}`,
              marginBottom:12, overflow:"hidden", opacity:isExpired?0.7:1,
              boxShadow:"0 2px 8px rgba(0,0,0,0.06)",
              animationDelay:`${idx*0.04}s`,
              borderRight:`4px solid ${tc}`,
            }}>
            <div style={{ padding:"14px 16px" }}>

              {/* Top row: title + badges */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:10 }}>
                <h3 style={{ margin:0, fontSize:15, color:PT.s900, fontWeight:700, flex:1, lineHeight:1.4 }}>{s.title}</h3>
                <div style={{ display:"flex", gap:4, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
                  {/* Type badge */}
                  <span style={{ background:tb, color:tc, border:`1px solid ${tc}30`,
                    borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                    {({ school:"🏫 مدارس", supervisor:"👤 مشرفون", administrator:"🎓 إداريون", open:"🌐 مفتوح" })[s.survey_type] || "🏫 مدارس"}
                  </span>
                  {/* State badge */}
                  <span style={{ background:badge.bg, color:badge.color,
                    border:`1px solid ${badge.border}`, borderRadius:20,
                    padding:"3px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                    {badge.label}
                  </span>
                </div>
              </div>

              {/* Expiry warning */}
              {expiringSoon && (
                <div style={{ background:PT.warnBg, border:`1px solid ${PT.warn}30`, borderRadius:8,
                  padding:"6px 10px", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:14 }}>⚠️</span>
                  <p style={{ margin:0, fontSize:11, color:PT.warn, fontWeight:700 }}>
                    ينتهي غداً — {new Date(endDate).toLocaleDateString("ar-SA")}
                  </p>
                </div>
              )}
              {endDate && !isExpired && !expiringSoon && (
                <p style={{ margin:"0 0 6px", fontSize:11, color:PT.s400 }}>
                  📅 ينتهي: {new Date(endDate).toLocaleDateString("ar-SA")}
                </p>
              )}

              {s.description && (
                <p style={{ margin:"0 0 12px", fontSize:12, color:PT.s500, lineHeight:1.5 }}>
                  {s.description.length > 80 ? s.description.slice(0,80)+"..." : s.description}
                </p>
              )}

              {/* Action buttons */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <ActionBtn icon="📊" label="متابعة" onClick={()=>onTrack(s)} color={PT.e700} bg={PT.e50}/>
                {canShare(s) && <ActionBtn icon="🔗" label="مشاركة" onClick={()=>onShare(s)} color={PT.gold} bg={PT.goldL}/>}
                {canApprove(s) && <ActionBtn icon="✅" label="اعتماد" onClick={()=>onApprove(s)} color={PT.success} bg={PT.successBg}/>}
                {isAdmin && <ActionBtn icon="✏️" label="تعديل" onClick={()=>onEdit(s)}/>}
                {isAdmin && <ActionBtn icon="📋" label="قالب" onClick={()=>onSaveAsTemplate(s)}/>}
                {isAdmin && <ActionBtn icon="🗑️" label="حذف" onClick={()=>onDelete(s)} color={PT.danger} bg={PT.dangerBg}/>}
              </div>

              {/* Lifecycle actions */}
              {isAdmin && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${PT.s100}` }}>
                  <LifecycleActions survey={s} user={user} isAdmin={isAdmin} onRefresh={onLifecycleChange}/>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionBtn({ icon, label, onClick, color, bg }) {
  return (
    <button onClick={onClick} className="action-btn" style={{
      background: bg || "#F1F5F9",
      color: color || "#334155",
      border: `1px solid ${color ? color+"25" : "#E2E8F0"}`,
      borderRadius:9, padding:"7px 12px",
      fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
      display:"inline-flex", alignItems:"center", gap:5,
    }}>
      <span style={{ fontSize:13 }}>{icon}</span>
      {label}
    </button>
  );
}


function NewSurveyPage({ onSaved, onCancel, user, isAdmin, existingSurvey, initialQuestions, initialSurveyType }) {
  const isEdit = !!existingSurvey;
  const [title, setTitle] = useState(existingSurvey?.title || "");
  const [desc, setDesc] = useState(existingSurvey?.description || "");
  const [surveyType, setSurveyType] = useState(existingSurvey?.survey_type || initialSurveyType || "school");
  const [targeting, setTargeting] = useState(emptyTargeting());
  const [targetingLoaded, setTargetingLoaded] = useState(!existingSurvey);
  const [surveySettings, setSurveySettings] = useState({
    response_limit: existingSurvey?.response_limit || "one_per_entity",
    start_date: existingSurvey?.start_date ? new Date(existingSurvey.start_date).toISOString().slice(0,16) : "",
    end_date: (existingSurvey?.end_date || existingSurvey?.expires_at)
      ? new Date(existingSurvey.end_date || existingSurvey.expires_at).toISOString().slice(0,16) : "",
    survey_status: existingSurvey?.survey_status || "published",
  });

  useEffect(() => {
    if (existingSurvey?.id) {
      loadTargeting(existingSurvey.id).then(t => {
        if (t && (t.rules?.length || t.selectedSchools?.length)) {
          setTargeting(t);
        } else if (existingSurvey.target_stages?.length) {
          setTargeting({
            rules: existingSurvey.target_stages.map(s => ({ method:'stage', value:s })),
            selectedSchools: [],
            excludedSchools: [],
          });
        }
        setTargetingLoaded(true);
      });
    }
  }, [existingSurvey?.id]);

  const [qs, setQs] = useState(() => {
    if (existingSurvey?.questions?.length) {
      return existingSurvey.questions.map(q => ({
        ...deepClone(q),
        options: q.options || [],
        allowedFileTypes: q.allowed_file_types || "pdf,xlsx",
      }));
    }
    if (initialQuestions?.length) {
      return initialQuestions.map(q => ({
        ...deepClone(q),
        id: genId(),
        options: q.options || [],
        allowedFileTypes: q.allowed_file_types || "pdf,xlsx",
      }));
    }
    return [{ id: genId(), type:"text", label:"", required:true, options:[], allowedFileTypes:"pdf,xlsx" }];
  });

  const [gateQuestionId, setGateQuestionId] = useState(existingSurvey?.gate_question_id || "");
  const [gateRequiredValue, setGateRequiredValue] = useState(existingSurvey?.gate_required_value || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const upd = (id,f,v) => setQs(p => p.map(q => q.id===id ? {...q,[f]:v} : q));
  const types = [
    {v:"text",l:"نص قصير"},{v:"textarea",l:"نص طويل"},
    {v:"number",l:"رقم / إحصائية"},{v:"select",l:"اختيار من قائمة"},
    {v:"rating",l:"تقييم بالنجوم"},{v:"file",l:"رفع ملف (PDF/Excel)"},
  ];

  const selectQuestions = qs.filter(q => q.type === "select" && (q.options||[]).length > 0 && q.label.trim());

  function removeQuestion(id) {
    setQs(p => p.filter(x => x.id !== id));
    if (gateQuestionId === id) { setGateQuestionId(""); setGateRequiredValue(""); }
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true); setError("");

    const approvalStatus = isAdmin ? "approved" : "pending_approval";
    let surveyId = existingSurvey?.id;

    const surveyPayload = {
      title, description: desc, survey_type: surveyType,
      gate_question_id: null,
      target_stages: null,
      survey_status: surveySettings.survey_status,
      response_limit: surveySettings.response_limit,
      start_date: surveySettings.start_date ? new Date(surveySettings.start_date).toISOString() : null,
      end_date: surveySettings.end_date ? new Date(surveySettings.end_date).toISOString() : null,
      expires_at: surveySettings.end_date ? new Date(surveySettings.end_date).toISOString() : null,
    };

    if (isEdit) {
      const { error: updErr } = await supabase.from("surveys").update(surveyPayload).eq("id", surveyId);
      if (updErr) { setSaving(false); setError("فشل التحديث: " + updErr.message); return; }
      await supabase.from("survey_questions").delete().eq("survey_id", surveyId);
    } else {
      const { data: survey, error: surveyErr } = await supabase
        .from("surveys")
        .insert({ ...surveyPayload, status: "active", approval_status: approvalStatus, created_by: user?.id })
        .select().single();
      if (surveyErr) {
        setSaving(false);
        setError(surveyErr.code === "42501" ? "ليست لديك صلاحية إنشاء استبيانات" : "فشل حفظ الاستبيان: " + surveyErr.message);
        return;
      }
      surveyId = survey.id;
    }

    const questionsPayload = qs.map((q, i) => ({
      survey_id: surveyId, label: q.label, type: q.type,
      required: q.required, options: q.options || [], order_index: i,
      allowed_file_types: q.type === "file" ? (q.allowedFileTypes||"pdf,xlsx") : null,
    }));

    const { data: insertedQs, error: qErr } = await supabase.from("survey_questions").insert(questionsPayload).select();
    if (qErr) { setSaving(false); setError("فشل حفظ الأسئلة: " + qErr.message); return; }

    if (gateQuestionId && gateRequiredValue) {
      const localIndex = qs.findIndex(q => q.id === gateQuestionId);
      const realQuestion = insertedQs?.find(q => q.order_index === localIndex);
      if (realQuestion) {
        await supabase.from("surveys").update({
          gate_question_id: realQuestion.id,
          gate_required_value: gateRequiredValue,
        }).eq("id", surveyId);
      }
    }

    if (surveyType === "school" && (targeting.rules?.length || targeting.selectedSchools?.length)) {
      await saveTargeting(surveyId, targeting);
    }

    setSaving(false);
    if (isEdit) { audit.surveyUpdate(user, surveyId, title); }
    else        { audit.surveyCreate(user, surveyId, title); }
    onSaved();
  }

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      <button onClick={onCancel} style={{ background:"none", border:"none", color:C.primary, fontSize:14,
        cursor:"pointer", padding:"0 0 14px", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>← إلغاء</button>
      <h2 style={{ margin:"0 0 16px", fontSize:18, color:C.dark, fontWeight:800 }}>{isEdit ? "تعديل الاستبيان" : "استبيان جديد"}</h2>

      {!isAdmin && (
        <div style={{ background:C.warnBg, border:`1px solid ${C.warn}40`, borderRadius:10, padding:"10px 14px",
          fontSize:12, color:"#9a5a10", marginBottom:14 }}>
          ℹ️ سيُحفظ الاستبيان كـ<strong> مسودة بانتظار اعتماد المسؤول</strong> قبل نشره.
        </div>
      )}

      {initialQuestions?.length > 0 && (
        <div style={{ background:C.primaryBg, border:`1px solid ${C.primary}30`, borderRadius:10,
          padding:"10px 14px", fontSize:12, color:C.primary, marginBottom:14 }}>
          🗂️ تم تحميل <strong>{initialQuestions.length} سؤال</strong> من القالب — يمكنك التعديل قبل الحفظ.
        </div>
      )}

      <Card style={{ marginBottom:14 }}><SurveyTypeSelector value={surveyType} onChange={setSurveyType}/></Card>

      <Card style={{ marginBottom:14 }}>
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>
            عنوان الاستبيان <span style={{color:C.danger}}>*</span>
          </label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: استبيان البيانات التعريفية"
            style={{ width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`, borderRadius:10,
              fontSize:14, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none" }}/>
        </div>
        <div>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>وصف الاستبيان</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} placeholder="وصف مختصر"
            style={{ width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`, borderRadius:10,
              fontSize:14, fontFamily:"inherit", direction:"rtl", resize:"vertical", boxSizing:"border-box", outline:"none" }}/>
        </div>
      </Card>

      <Card style={{ marginBottom:14 }}><SurveySettingsPanel settings={surveySettings} onChange={setSurveySettings}/></Card>

      {surveyType === "school" && targetingLoaded && (
        <Card style={{ marginBottom:14 }}>
          <p style={{ margin:"0 0 14px", fontSize:13, fontWeight:700, color:C.dark }}>🎯 المدارس المستهدفة</p>
          <AudienceSelector entityType="school" value={targeting} onChange={setTargeting}/>
        </Card>
      )}

      {surveyType === "school" && (
        <Card style={{ marginBottom:12, background:"#e8f5ee", border:`1px solid ${C.success}40` }}>
          <p style={{ margin:0, fontSize:13, color:C.success, fontWeight:700 }}>✅ سؤال الرقم الوزاري تلقائي</p>
          <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>يُعرض أولاً للتحقق من هوية المستجيب، ثم أسئلتك أدناه.</p>
        </Card>
      )}
      {surveyType === "supervisor" && (
        <Card style={{ marginBottom:12, background:"#f5eefa", border:"1px solid #7B2D8B40" }}>
          <p style={{ margin:0, fontSize:13, color:"#7B2D8B", fontWeight:700 }}>👤 سؤال رقم الهوية تلقائي</p>
          <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>يُعرض أولاً للتحقق من هوية المشرف عبر رقم هويته، ثم أسئلتك أدناه.</p>
        </Card>
      )}
      {surveyType === "administrator" && (
        <Card style={{ marginBottom:12, background:"#FFFBEB", border:"1px solid #B7791F40" }}>
          <p style={{ margin:0, fontSize:13, color:"#B7791F", fontWeight:700 }}>🎓 سؤال رقم الهوية تلقائي</p>
          <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>يُعرض أولاً للتحقق من هوية الإداري، ثم أسئلتك أدناه.</p>
        </Card>
      )}
      {surveyType === "open" && (
        <Card style={{ marginBottom:12, background:C.accentLight, border:`1px solid ${C.accent}40` }}>
          <p style={{ margin:0, fontSize:13, color:C.accent, fontWeight:700 }}>🌐 استبيان مفتوح بدون تحقق</p>
          <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>سيُطلب من المجيب اسمه أو جهته اختيارياً فقط، ثم ينتقل مباشرة لأسئلتك أدناه.</p>
        </Card>
      )}

      {qs.map((q,i) => (
        <Card key={q.id} style={{ marginBottom:12 }} accent={gateQuestionId===q.id ? C.accent : C.primary}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:700, color:gateQuestionId===q.id ? C.accent : C.primary }}>
              السؤال {i+1} {gateQuestionId===q.id && "🚪 (سؤال شرطي)"}
            </span>
            {qs.length>1 && (
              <button onClick={()=>removeQuestion(q.id)} style={{ background:"none", border:"none", cursor:"pointer", color:C.danger, fontSize:18 }}>🗑</button>
            )}
          </div>
          <input value={q.label} onChange={e=>upd(q.id,"label",e.target.value)} placeholder="نص السؤال..."
            style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${C.border}`, borderRadius:10,
              fontSize:14, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none", marginBottom:10 }}/>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <select value={q.type} onChange={e=>{ upd(q.id,"type",e.target.value); if (gateQuestionId===q.id && e.target.value!=="select") { setGateQuestionId(""); setGateRequiredValue(""); } }}
              style={{ flex:1, minWidth:140, padding:"9px 10px", border:`1.5px solid ${C.border}`, borderRadius:10,
                fontSize:13, fontFamily:"inherit", color:C.text, background:C.white }}>
              {types.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, cursor:"pointer" }}>
              <input type="checkbox" checked={q.required} onChange={e=>upd(q.id,"required",e.target.checked)} style={{width:16,height:16}}/>مطلوب
            </label>
          </div>
          {q.type==="select" && (
            <>
              <textarea value={(q.options||[]).join("\n")} onChange={e=>upd(q.id,"options",e.target.value.split("\n").filter(Boolean))}
                rows={3} placeholder={"خيار 1\nخيار 2\nخيار 3"}
                style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${C.border}`, borderRadius:10,
                  fontSize:13, fontFamily:"inherit", direction:"rtl", resize:"none", boxSizing:"border-box", outline:"none", marginTop:8 }}/>
              {(q.options||[]).length > 0 && q.label.trim() && (
                <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, cursor:"pointer", marginTop:10,
                  background:gateQuestionId===q.id?C.accentLight:"transparent", padding:"7px 10px", borderRadius:8 }}>
                  <input type="checkbox" checked={gateQuestionId===q.id}
                    onChange={e=>{ if (e.target.checked) { setGateQuestionId(q.id); setGateRequiredValue(q.options[0]||""); } else { setGateQuestionId(""); setGateRequiredValue(""); } }}
                    style={{width:16,height:16}}/>
                  🚪 اجعل هذا سؤال شرطي (بوابة)
                </label>
              )}
              {gateQuestionId===q.id && (
                <div style={{ marginTop:10 }}>
                  <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.accent, marginBottom:5 }}>
                    الإجابة التي تسمح بمتابعة باقي الأسئلة:
                  </label>
                  <select value={gateRequiredValue} onChange={e=>setGateRequiredValue(e.target.value)}
                    style={{ width:"100%", padding:"9px 10px", border:`1.5px solid ${C.accent}`, borderRadius:10,
                      fontSize:13, fontFamily:"inherit", color:C.text, background:C.white }}>
                    {(q.options||[]).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <p style={{ margin:"6px 0 0", fontSize:11, color:C.muted }}>أي إجابة أخرى ستُنهي الاستبيان فوراً.</p>
                </div>
              )}
            </>
          )}
          {q.type==="file" && (
            <div style={{ marginTop:10 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:5 }}>أنواع الملفات المسموحة:</label>
              <div style={{ display:"flex", gap:10 }}>
                {[["pdf","PDF"],["xlsx","Excel"]].map(([v,l]) => (
                  <label key={v} style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, cursor:"pointer" }}>
                    <input type="checkbox"
                      checked={(q.allowedFileTypes||"pdf,xlsx").includes(v)}
                      onChange={e=>{
                        const cur = (q.allowedFileTypes||"pdf,xlsx").split(",").filter(Boolean);
                        const next = e.target.checked ? [...new Set([...cur,v])] : cur.filter(x=>x!==v);
                        upd(q.id,"allowedFileTypes",next.join(","));
                      }}
                      style={{width:16,height:16}}/>{l}
                  </label>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}

      <ErrorBanner message={error}/>
      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        <Btn sm variant="secondary" onClick={()=>setQs(p=>[...p,{id:genId(),type:"text",label:"",required:false,options:[]}])}>＋ سؤال</Btn>
        <Btn sm disabled={!title.trim()} loading={saving} onClick={save}>✓ حفظ في قاعدة البيانات</Btn>
      </div>
    </div>
  );
}

function ShareSheet({ survey, onClose }) {
  const [tab, setTab] = useState("link");
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?survey=${survey.id}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
  const wa = encodeURIComponent(`السلام عليكم ورحمة الله وبركاته،\n\nنرجو من سعادتكم التكرم بتعبئة الاستبيان التالي:\n*${survey.title}*\n\nالرابط: ${link}\n\nإدارة التعليم — جدة`);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200, display:"flex", alignItems:"flex-end", direction:"rtl" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", background:C.white, borderRadius:"20px 20px 0 0", paddingBottom:32, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0" }}>
          <div style={{ width:40, height:4, background:C.border, borderRadius:4 }}/>
        </div>
        <div style={{ padding:"0 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:17, color:C.dark, fontWeight:800 }}>مشاركة الاستبيان</h3>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.muted }}>✕</button>
          </div>
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginBottom:20 }}>
            {[["link","🔗 رابط"],["qr","📱 QR"],["whatsapp","💬 واتساب"]].map(([k,l]) => (
              <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:"10px 4px", border:"none", background:"none", cursor:"pointer",
                fontSize:12, fontFamily:"inherit", fontWeight:tab===k?700:400, color:tab===k?C.primary:C.muted,
                borderBottom:`2px solid ${tab===k?C.primary:"transparent"}`, marginBottom:-1 }}>{l}</button>
            ))}
          </div>
          {tab==="link" && (
            <div>
              <div style={{ background:C.bg, borderRadius:10, padding:14, marginBottom:12, border:`1px solid ${C.border}`, wordBreak:"break-all", fontSize:13, color:C.muted }}>{link}</div>
              <Btn full variant={copied?"secondary":"primary"} onClick={()=>{ navigator.clipboard.writeText(link).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); }}>
                {copied?"✓ تم النسخ!":"نسخ الرابط"}
              </Btn>
            </div>
          )}
          {tab==="qr" && (
            <div style={{ textAlign:"center", padding:"8px 0" }}>
              <img src={qr} alt="QR" style={{ width:180, height:180, borderRadius:12, border:`1px solid ${C.border}` }}/>
              <p style={{ color:C.muted, fontSize:13, marginTop:12 }}>امسح الرمز للوصول للاستبيان مباشرة</p>
            </div>
          )}
          {tab==="whatsapp" && (
            <a href={`https://wa.me/?text=${wa}`} target="_blank" rel="noopener noreferrer" style={{ display:"block", textDecoration:"none" }}>
              <Btn full variant="green">📱 إرسال عبر واتساب</Btn>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}


const GREEN_API_INSTANCE = "7107658040";
const GREEN_API_TOKEN = "5057056a62c9475db20433c433349df534e9ee32ba0b47c0a0";

async function sendWhatsAppGreen(phone, message) {
  const cleanPhone = phone.replace(/\D/g, "").replace(/^0/, "966").replace(/^(?!966)/, "966");
  const url = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}/sendMessage/${GREEN_API_TOKEN}`;
  const res = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ chatId:`${cleanPhone}@c.us`, message }) });
  return res.ok;
}

function AnalyticsPage({ surveys, onNavigate }) {
  const [stats, setStats] = useState({});
  const [pendingSchools, setPendingSchools] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState({});
  const [sentCount, setSentCount] = useState({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const schoolCount = useSchoolCount();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const results = {}, pending = {};
      for (const s of surveys) {
        const { count } = await supabase.from("survey_responses").select("*", { count:"exact", head:true }).eq("survey_id", s.id);
        results[s.id] = count || 0;
        if (s.survey_type === "school" && s.approval_status === "approved") {
          const { data: responses } = await supabase.from("survey_responses").select("school_id").eq("survey_id", s.id);
          const respondedIds = new Set((responses||[]).map(r => r.school_id));
          let allSchools = [], from = 0;
          while (true) {
            const { data } = await supabase.from("survey_schools").select("id,name,principal,phone,stage").range(from, from+999);
            if (!data?.length) break;
            allSchools = allSchools.concat(data);
            if (data.length < 1000) break;
            from += 1000;
          }
          pending[s.id] = allSchools.filter(sc => !respondedIds.has(sc.id));
        }
      }
      setStats(results); setPendingSchools(pending); setLoading(false);
    }
    if (surveys.length) load(); else setLoading(false);
  }, [surveys]);

  const totalResponded = Object.values(stats).reduce((a,b)=>a+b,0);
  const activeSurveys = surveys.filter(s => s.approval_status === "approved" && (!s.expires_at || new Date(s.expires_at) > new Date()));

  async function sendReminders(survey) {
    const schools = pendingSchools[survey.id] || [];
    if (!schools.length) return;
    setSending(p => ({...p, [survey.id]: true}));
    const link = `${window.location.origin}?survey=${survey.id}`;
    const expText = survey.expires_at ? `\n⏰ آخر موعد: ${new Date(survey.expires_at).toLocaleDateString("ar-SA")}` : "";
    let sent = 0;
    for (const school of schools) {
      if (!school.phone) continue;
      const ok = await sendWhatsAppGreen(school.phone, `السلام عليكم ${school.principal || ""},\n\nنرجو تعبئة استبيان:\n*${survey.title}*\n\n${link}${expText}\n\nإدارة التعليم — جدة`);
      if (ok) sent++;
      await new Promise(r => setTimeout(r, 500));
    }
    setSending(p => ({...p, [survey.id]: false}));
    setSentCount(p => ({...p, [survey.id]: sent}));
  }

  async function exportAnalyticsExcel() {
    const XLSX = await ensureXLSX();
    const rows = surveys.map(s => { const count = stats[s.id]||0; const pct = schoolCount?Math.round(count/schoolCount*100):0; return {"الاستبيان":s.title,"الردود":count,"إجمالي المدارس":schoolCount,"نسبة الاستجابة":`${pct}%`}; });
    const ws = XLSX.utils.json_to_sheet(rows); ws["!cols"]=Object.keys(rows[0]||{}).map(()=>({wch:24}));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "إحصائيات");
    XLSX.writeFile(wb, `إحصائيات-${tsStamp()}.xlsx`);
  }

  if (loading) return <div style={{ minHeight:"50vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={32}/></div>;

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginBottom:16 }}>
        {[["dashboard","🏠 لوحة التحكم"],["whatsapp","📱 إشعارات واتس"],["details","📊 تفاصيل"]].map(([k,l]) => (
          <button key={k} onClick={()=>setActiveTab(k)} style={{ flex:1, padding:"10px 4px", border:"none", background:"none", cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:activeTab===k?700:400, color:activeTab===k?C.primary:C.muted, borderBottom:`2px solid ${activeTab===k?C.primary:"transparent"}`, marginBottom:-1 }}>{l}</button>
        ))}
      </div>
      {activeTab === "dashboard" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:20 }}>
            {[
              {l:"إجمالي المدارس",v:schoolCount,i:"🏫",c:C.primary,nav:"directory",sub:"اضغط للإدارة"},
              {l:"استبيانات نشطة",v:activeSurveys.length,i:"📋",c:C.accent,nav:"surveys",sub:"اضغط للعرض"},
              {l:"إجمالي الردود",v:totalResponded,i:"📝",c:C.success,nav:"surveys",sub:"اضغط للتفاصيل"},
              {l:"متوسط الاستجابة",v:schoolCount&&activeSurveys.length?`${Math.round(totalResponded/activeSurveys.length/schoolCount*100)}%`:"—",i:"📊",c:"#7B2D8B",nav:null,sub:"من المدارس"},
            ].map((x,i) => (
              <div key={i} onClick={()=>x.nav&&onNavigate&&onNavigate(x.nav)} className={x.nav?"card-hover":undefined}
                style={{ background:C.white, borderRadius:16, padding:16, border:`1px solid ${C.border}`, borderTop:`3px solid ${x.c}`, boxShadow:"0 2px 8px rgba(0,0,0,0.06)", cursor:x.nav?"pointer":"default", textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{x.i}</div>
                <div style={{ fontSize:26, fontWeight:800, color:x.c, lineHeight:1 }}>{x.v}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:4, fontWeight:500 }}>{x.l}</div>
                {x.nav && <div style={{ fontSize:10, color:x.c, marginTop:4, fontWeight:600 }}>{x.sub} ←</div>}
              </div>
            ))}
          </div>
          <h3 style={{ margin:"0 0 10px", fontSize:14, color:C.dark }}>الاستبيانات النشطة</h3>
          {activeSurveys.length === 0 ? <Card style={{ textAlign:"center", padding:24 }}><p style={{ margin:0, color:C.muted, fontSize:13 }}>لا توجد استبيانات نشطة حالياً</p></Card>
          : activeSurveys.map(s => {
            const count = stats[s.id]||0, pct = schoolCount?Math.round(count/schoolCount*100):0, pending = pendingSchools[s.id]?.length||0;
            const expiresTomorrow = s.expires_at && (new Date(s.expires_at)-new Date()) < 24*60*60*1000 && new Date(s.expires_at) > new Date();
            return (
              <Card key={s.id} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark, flex:1 }}>{s.title}</p>
                  <span style={{ fontSize:13, fontWeight:800, color:C.primary }}>{pct}%</span>
                </div>
                {expiresTomorrow && <div style={{ background:C.warnBg, borderRadius:8, padding:"5px 10px", marginBottom:8 }}><p style={{ margin:0, fontSize:11, color:C.warn, fontWeight:700 }}>⚠️ ينتهي غداً</p></div>}
                <div style={{ height:10, background:C.border, borderRadius:6, marginBottom:8 }}><div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${C.primary},${C.primaryLight})`, borderRadius:6, transition:"width 0.5s" }}/></div>
                <p style={{ margin:"0 0 4px", fontSize:12, color:C.muted }}>✅ {count} استجابت · ⏳ {pending} لم تستجب</p>
                {s.expires_at && <p style={{ margin:0, fontSize:11, color:C.muted }}>📅 ينتهي: {new Date(s.expires_at).toLocaleDateString("ar-SA")}</p>}
              </Card>
            );
          })}
        </>
      )}
      {activeTab === "whatsapp" && (
        <>
          <div style={{ background:C.primaryBg, borderRadius:12, padding:14, marginBottom:16 }}>
            <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:700, color:C.primary }}>📱 إرسال تذكيرات واتس</p>
            <p style={{ margin:0, fontSize:12, color:C.muted, lineHeight:1.7 }}>ترسل رسالة واتس تلقائية لكل مدرسة لم تستجب بعد</p>
          </div>
          {activeSurveys.filter(s=>s.survey_type==="school").length === 0 ? <Card style={{ textAlign:"center", padding:24 }}><p style={{ margin:0, color:C.muted, fontSize:13 }}>لا توجد استبيانات مدرسية نشطة</p></Card>
          : activeSurveys.filter(s=>s.survey_type==="school").map(s => {
            const pending = pendingSchools[s.id]||[], withPhone = pending.filter(sc=>sc.phone), isSending = sending[s.id], sent = sentCount[s.id];
            return (
              <Card key={s.id} style={{ marginBottom:12 }}>
                <p style={{ margin:"0 0 6px", fontSize:14, fontWeight:700, color:C.dark }}>{s.title}</p>
                <p style={{ margin:"0 0 12px", fontSize:12, color:C.muted }}>⏳ {pending.length} مدرسة لم تستجب · 📱 {withPhone.length} لديها جوال</p>
                {sent !== undefined && <div style={{ background:C.successBg, borderRadius:8, padding:"6px 10px", marginBottom:10 }}><p style={{ margin:0, fontSize:12, color:C.success }}>✅ تم إرسال {sent} رسالة</p></div>}
                {withPhone.length > 0 ? <Btn full loading={isSending} onClick={()=>sendReminders(s)}>{isSending?`جاري الإرسال...`:`📱 إرسال تذكير لـ ${withPhone.length} مدرسة`}</Btn>
                : <p style={{ margin:0, fontSize:12, color:C.muted, textAlign:"center" }}>لا توجد أرقام جوال للمدارس غير المستجيبة</p>}
              </Card>
            );
          })}
        </>
      )}
      {activeTab === "details" && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <p style={{ margin:0, fontSize:13, color:C.muted }}>{surveys.length} استبيان</p>
            {surveys.length > 0 && <ExportMenu options={[{key:"xlsx",icon:"📊",label:"تصدير Excel",action:exportAnalyticsExcel}]}/>}
          </div>
          {surveys.map(s => {
            const count = stats[s.id]||0, total = s.survey_type==="school"?schoolCount:count, pct = total?Math.round(count/total*100):0;
            return (
              <Card key={s.id} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark, flex:1 }}>{s.title}</p>
                  <span style={{ fontSize:13, fontWeight:800, color:C.primary }}>{pct}%</span>
                </div>
                <p style={{ margin:"0 0 8px", fontSize:12, color:C.muted }}>{count} من {s.survey_type==="school"?schoolCount:"—"} مدرسة</p>
                <div style={{ height:10, background:C.border, borderRadius:6 }}><div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${C.primary},${C.primaryLight})`, borderRadius:6 }}/></div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

const STAGES = ["الابتدائية", "المتوسطة", "الثانوية"];

function SchoolForm({ initial, onSaved, onCancel, user }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(initial || { id:"", name:"", principal:"", phone:"", email:"", stage:"ابتدائية", supervisor:"", status:"مُسندة" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function set(k,v) { setForm(p=>({...p,[k]:v})); }

  async function save() {
    if (!form.id.trim()||!form.name.trim()) { setError("الرقم الوزاري واسم المدرسة حقول إلزامية"); return; }
    setSaving(true); setError("");
    const payload = { id:form.id.trim(), name:form.name.trim(), principal:form.principal.trim(), phone:form.phone.trim(), email:form.email.trim(), stage:form.stage, supervisor:form.supervisor.trim(), status:form.status };
    let err;
    if (isEdit) { ({error:err} = await supabase.from("survey_schools").update(payload).eq("id", initial.id)); }
    else        { ({error:err} = await supabase.from("survey_schools").insert(payload)); }
    setSaving(false);
    if (err) { setError(err.code==="23505"?"هذا الرقم الوزاري مستخدم بالفعل":err.code==="42501"?"ليست لديك صلاحية تنفيذ هذا الإجراء":"حدث خطأ أثناء الحفظ"); return; }
    if (isEdit) audit.schoolUpdate(user, payload.id, payload.name);
    else        audit.schoolCreate(user, payload.id, payload.name);
    onSaved();
  }

  const inputStyle = { width:"100%", padding:"10px 12px", border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none", marginBottom:10 };
  const labelStyle = { fontSize:12, fontWeight:700, color:C.text, marginBottom:5, display:"block" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:50, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:C.bg, width:"100%", maxHeight:"92vh", overflowY:"auto", borderRadius:"18px 18px 0 0", padding:18, direction:"rtl" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ margin:0, fontSize:16, color:C.dark }}>{isEdit?"تعديل مدرسة":"إضافة مدرسة جديدة"}</h3>
          <button onClick={onCancel} style={{ background:"none", border:"none", fontSize:20, color:C.muted, cursor:"pointer" }}>✕</button>
        </div>
        <ErrorBanner message={error}/>
        <label style={labelStyle}>الرقم الوزاري *</label>
        <input value={form.id} onChange={e=>set("id",e.target.value)} disabled={isEdit} style={{ ...inputStyle, direction:"ltr", textAlign:"center", fontWeight:700, background:isEdit?"#f0f0f0":"#fff" }}/>
        <label style={labelStyle}>اسم المدرسة *</label>
        <input value={form.name} onChange={e=>set("name",e.target.value)} style={inputStyle}/>
        <label style={labelStyle}>اسم المدير/ة</label>
        <input value={form.principal} onChange={e=>set("principal",e.target.value)} style={inputStyle}/>
        <label style={labelStyle}>المرحلة</label>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          {STAGES.map(s => <button key={s} onClick={()=>set("stage",s)} style={{ flex:1, padding:"9px 0", borderRadius:9, fontSize:12, fontFamily:"inherit", cursor:"pointer", border:`1.5px solid ${form.stage===s?C.primary:C.border}`, background:form.stage===s?C.primaryBg:"#fff", color:form.stage===s?C.primary:C.muted, fontWeight:form.stage===s?700:400 }}>{s}</button>)}
        </div>
        <label style={labelStyle}>جوال المدير/ة</label>
        <input value={form.phone} onChange={e=>set("phone",e.target.value)} style={{...inputStyle,direction:"ltr"}}/>
        <label style={labelStyle}>البريد الرسمي</label>
        <input value={form.email} onChange={e=>set("email",e.target.value)} style={{...inputStyle,direction:"ltr"}}/>
        <label style={labelStyle}>المشرف/ة</label>
        <input value={form.supervisor} onChange={e=>set("supervisor",e.target.value)} style={inputStyle}/>
        <label style={labelStyle}>الحالة</label>
        <div style={{ display:"flex", gap:8, marginBottom:18 }}>
          {["مُسندة","غير مُسندة"].map(s => <button key={s} onClick={()=>set("status",s)} style={{ flex:1, padding:"9px 0", borderRadius:9, fontSize:12, fontFamily:"inherit", cursor:"pointer", border:`1.5px solid ${form.status===s?C.primary:C.border}`, background:form.status===s?C.primaryBg:"#fff", color:form.status===s?C.primary:C.muted, fontWeight:form.status===s?700:400 }}>{s}</button>)}
        </div>
        <Btn full onClick={save} loading={saving}>{isEdit?"حفظ التعديلات":"إضافة المدرسة"}</Btn>
      </div>
    </div>
  );
}

function CsvUploadSheet({ onDone, onCancel, user }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function parseCsv(text) {
    const lines = text.split(/\r\n|\n/).filter(l=>l.trim().length>0);
    if (lines.length<2) return [];
    const headers = lines[0].split(",").map(h=>h.trim().replace(/^\uFEFF/,""));
    const idx = { id:headers.indexOf("id"), name:headers.indexOf("name"), principal:headers.indexOf("principal"), phone:headers.indexOf("phone"), email:headers.indexOf("email"), stage:headers.indexOf("stage"), supervisor:headers.indexOf("supervisor"), status:headers.indexOf("status") };
    const out = [];
    for (let i=1;i<lines.length;i++) {
      const cells=[]; let cur="",inQuotes=false; const line=lines[i];
      for (let c=0;c<line.length;c++) { const ch=line[c]; if(ch==='"'){inQuotes=!inQuotes;} else if(ch===","&&!inQuotes){cells.push(cur);cur="";} else cur+=ch; } cells.push(cur);
      const id=(cells[idx.id]||"").trim(), name=(cells[idx.name]||"").trim();
      if (!id||!name) continue;
      out.push({ id, name, principal:(cells[idx.principal]||"").trim(), phone:(cells[idx.phone]||"").trim(), email:(cells[idx.email]||"").trim(), stage:(cells[idx.stage]||"ابتدائية").trim(), supervisor:(cells[idx.supervisor]||"").trim(), status:(cells[idx.status]||"مُسندة").trim() });
    }
    return out;
  }

  function handleFile(e) {
    const file=e.target.files[0]; if(!file) return;
    setFileName(file.name); setError(""); setResult(null); setParsing(true);
    const reader=new FileReader();
    reader.onload=(ev)=>{ try { const parsed=parseCsv(ev.target.result); if(parsed.length===0) setError("لم يتم العثور على بيانات صالحة."); setRows(parsed); } catch(err){setError("تعذرت قراءة الملف: "+err.message);} setParsing(false); };
    reader.onerror=()=>{setError("فشل قراءة الملف");setParsing(false);};
    reader.readAsText(file,"UTF-8");
  }

  async function upload() {
    if(rows.length===0) return;
    setUploading(true); setProgress(0); setError("");
    const BATCH=50; let success=0, failed=0;
    for(let i=0;i<rows.length;i+=BATCH) {
      const batch=rows.slice(i,i+BATCH);
      const {error:err}=await supabase.from("survey_schools").upsert(batch,{onConflict:"id"});
      if(err) failed+=batch.length; else success+=batch.length;
      setProgress(Math.min(100,Math.round(((i+BATCH)/rows.length)*100)));
    }
    if(success>0) audit.schoolImport(user, success);
    setUploading(false); setResult({success,failed});
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:50, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:C.bg, width:"100%", maxHeight:"90vh", overflowY:"auto", borderRadius:"18px 18px 0 0", padding:18, direction:"rtl" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ margin:0, fontSize:16, color:C.dark }}>رفع مدارس عبر CSV</h3>
          <button onClick={onCancel} style={{ background:"none", border:"none", fontSize:20, color:C.muted, cursor:"pointer" }}>✕</button>
        </div>
        {!result && (
          <>
            <Card style={{ marginBottom:14, background:C.primaryBg }}><p style={{ margin:0, fontSize:12, color:C.text, lineHeight:1.8 }}>الأعمدة المطلوبة: <strong>id, name</strong> (إلزامية)</p></Card>
            <label style={{ display:"block", padding:"30px 16px", border:`2px dashed ${C.border}`, borderRadius:14, textAlign:"center", cursor:"pointer", background:"#fff", marginBottom:14 }}>
              <input type="file" accept=".csv" onChange={handleFile} style={{ display:"none" }}/>
              <div style={{ fontSize:30, marginBottom:6 }}>📄</div>
              <div style={{ fontSize:13, color:C.primary, fontWeight:700 }}>{fileName||"اضغط لاختيار ملف CSV"}</div>
            </label>
            <ErrorBanner message={error}/>
            {parsing && <div style={{ textAlign:"center", padding:14 }}><Spinner/></div>}
            {!parsing && rows.length>0 && <Card style={{ marginBottom:14 }}><p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.success }}>✅ تم العثور على {rows.length} مدرسة</p><div style={{ maxHeight:160, overflowY:"auto" }}>{rows.slice(0,5).map((r,i)=><div key={i} style={{ fontSize:11, color:C.muted, padding:"4px 0", borderBottom:`1px solid ${C.border}` }}>{r.id} — {r.name}</div>)}{rows.length>5&&<p style={{ fontSize:11, color:C.muted, margin:"6px 0 0" }}>... و{rows.length-5} أخرى</p>}</div></Card>}
            {uploading && <div style={{ marginBottom:14 }}><div style={{ height:8, background:C.border, borderRadius:6, overflow:"hidden" }}><div style={{ height:"100%", width:`${progress}%`, background:C.primary, transition:"width 0.3s" }}/></div><p style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:6 }}>{progress}%</p></div>}
            <Btn full onClick={upload} disabled={rows.length===0} loading={uploading}>رفع {rows.length>0?`${rows.length} مدرسة`:"الملف"}</Btn>
          </>
        )}
        {result && <div style={{ textAlign:"center", padding:20 }}><div style={{ fontSize:40, marginBottom:10 }}>{result.failed===0?"✅":"⚠️"}</div><p style={{ fontWeight:700, color:C.dark, margin:"0 0 6px" }}>تم الانتهاء</p><p style={{ fontSize:13, color:C.success, margin:"0 0 4px" }}>نجح: {result.success}</p>{result.failed>0&&<p style={{ fontSize:13, color:C.danger, margin:0 }}>فشل: {result.failed}</p>}<div style={{ marginTop:18 }}><Btn full onClick={onDone}>تم</Btn></div></div>}
      </div>
    </div>
  );
}

function DeleteConfirm({ school, onConfirm, onCancel, user }) {
  const [deleting, setDeleting] = useState(false);
  async function doDelete() {
    setDeleting(true);
    const {error:err} = await supabase.from("survey_schools").delete().eq("id", school.id);
    setDeleting(false);
    if (!err) audit.schoolDelete(user, school.id, school.name);
    onConfirm();
  }
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#fff", borderRadius:16, padding:22, maxWidth:340, width:"100%", direction:"rtl" }}>
        <div style={{ fontSize:32, textAlign:"center", marginBottom:10 }}>🗑️</div>
        <p style={{ textAlign:"center", fontWeight:700, color:C.dark, margin:"0 0 6px" }}>تأكيد الحذف</p>
        <p style={{ textAlign:"center", fontSize:13, color:C.muted, margin:"0 0 18px" }}>هل أنت متأكد من حذف مدرسة<br/><strong style={{ color:C.text }}>{school.name}</strong>؟<br/>لا يمكن التراجع.</p>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="secondary" full onClick={onCancel} disabled={deleting}>إلغاء</Btn>
          <Btn variant="danger" full onClick={doDelete} loading={deleting}>حذف نهائياً</Btn>
        </div>
      </div>
    </div>
  );
}

function SchoolsManagementPage({ isAdmin, user }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("الكل");
  const [formTarget, setFormTarget] = useState(undefined);
  const [csvOpen, setCsvOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    let all=[], from=0;
    while(true) {
      const {data,error}=await supabase.from("survey_schools").select("*").order("name").range(from,from+999);
      if(error||!data||data.length===0) break;
      all=all.concat(data); if(data.length<1000) break; from+=1000;
    }
    setSchools(all); setLoading(false);
  }, []);

  useEffect(()=>{load();},[load]);

  const filtered = useMemo(()=>{
    let list=schools;
    if(stageFilter!=="الكل") list=list.filter(s=>s.stage===stageFilter);
    if(search.trim()) { const q=search.trim().toLowerCase(); list=list.filter(s=>s.id.toLowerCase().includes(q)||(s.name||"").toLowerCase().includes(q)||(s.principal||"").toLowerCase().includes(q)); }
    return list;
  },[schools,search,stageFilter]);

  const paged = filtered.slice(0, page*PAGE_SIZE);

  async function exportSchoolsExcel() {
    const XLSX=await ensureXLSX();
    const rows=filtered.map(s=>({"الرقم الوزاري":s.id,"اسم المدرسة":s.name,"المدير/ة":s.principal||"","المرحلة":s.stage,"جوال المدير":s.phone||"","البريد الرسمي":s.email||"","المشرف/ة":s.supervisor||"","الحالة":s.status||""}));
    const ws=XLSX.utils.json_to_sheet(rows); ws["!cols"]=Object.keys(rows[0]||{}).map(()=>({wch:24}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"المدارس");
    XLSX.writeFile(wb,`قائمة-المدارس-${tsStamp()}.xlsx`);
    audit.exportExcel(user, "قائمة المدارس");
  }

  async function exportSchoolsPdf() {
    const jsPDF=await ensurePDF();
    const doc=new jsPDF({orientation:"l",unit:"pt",format:"a4"});
    const W=doc.internal.pageSize.getWidth();
    doc.setFontSize(15); pdfRTLText(doc,"قائمة المدارس — إدارة التعليم جدة",W-40,40);
    doc.setFontSize(9); doc.setTextColor(110,110,110); pdfRTLText(doc,`${filtered.length} مدرسة · ${new Date().toLocaleDateString("ar-SA")}`,W-40,58);
    doc.autoTable({ startY:72, head:[["الرقم","المدرسة","المدير","المرحلة","المشرف","الحالة"]], body:filtered.map(s=>[s.id,s.name,s.principal||"-",s.stage,s.supervisor||"-",s.status]), styles:{font:"helvetica",fontSize:8,halign:"right"}, headStyles:{fillColor:[11,110,110],halign:"right"}, margin:{left:30,right:30} });
    doc.save(`قائمة-المدارس-${tsStamp()}.pdf`);
    audit.exportPdf(user, "قائمة المدارس");
  }

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div><h2 style={{ margin:0, fontSize:17, color:C.dark }}>إدارة المدارس</h2><p style={{ margin:"2px 0 0", fontSize:12, color:C.muted }}>{schools.length} مدرسة مسجّلة</p></div>
        <ExportMenu options={[{key:"xlsx",icon:"📊",label:"تصدير Excel",action:exportSchoolsExcel},{key:"pdf",icon:"📄",label:"تصدير PDF",action:exportSchoolsPdf}]}/>
      </div>
      {isAdmin ? <div style={{ display:"flex", gap:8, marginBottom:12 }}><Btn full onClick={()=>setFormTarget(null)}>➕ إضافة مدرسة</Btn><Btn full variant="secondary" onClick={()=>setCsvOpen(true)}>📄 رفع CSV</Btn></div>
      : <ViewerNotice action="إضافة أو رفع المدارس"/>}
      <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="ابحث بالاسم أو الرقم الوزاري أو المدير..."
        style={{ width:"100%", padding:"10px 14px", border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:13, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none", marginBottom:10 }}/>
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto" }}>
        {["الكل",...STAGES].map(s=><button key={s} onClick={()=>{setStageFilter(s);setPage(1);}} style={{ padding:"6px 14px", borderRadius:18, fontSize:12, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", border:`1.5px solid ${stageFilter===s?C.primary:C.border}`, background:stageFilter===s?C.primaryBg:"#fff", color:stageFilter===s?C.primary:C.muted, fontWeight:stageFilter===s?700:400 }}>{s}</button>)}
      </div>
      {loading ? <div style={{ textAlign:"center", padding:40 }}><Spinner size={28}/></div>
      : filtered.length===0 ? <p style={{ textAlign:"center", color:C.muted, fontSize:13, padding:30 }}>لا توجد نتائج مطابقة</p>
      : (
        <>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {paged.map(s => (
              <Card key={s.id} style={{ padding:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark }}>{s.name}</p>
                    <p style={{ margin:"3px 0 0", fontSize:12, color:C.muted }}>{s.principal||"—"} · رقم: {s.id}</p>
                    <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}><Tag color={C.primary}>{s.stage}</Tag><Tag color={s.status==="مُسندة"?C.success:C.warn}>{s.status}</Tag></div>
                  </div>
                  {isAdmin && <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <button onClick={()=>setFormTarget(s)} style={{ background:C.primaryBg, border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, color:C.primary, cursor:"pointer", fontFamily:"inherit" }}>✏️ تعديل</button>
                    <button onClick={()=>setDeleteTarget(s)} style={{ background:"#fdf0ee", border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, color:C.danger, cursor:"pointer", fontFamily:"inherit" }}>🗑️ حذف</button>
                  </div>}
                </div>
              </Card>
            ))}
          </div>
          {paged.length<filtered.length && <Btn variant="secondary" full onClick={()=>setPage(p=>p+1)} style={{ marginTop:12 }}>عرض المزيد ({filtered.length-paged.length} متبقي)</Btn>}
        </>
      )}
      {isAdmin&&formTarget!==undefined&&<SchoolForm initial={formTarget} onSaved={()=>{setFormTarget(undefined);load();}} onCancel={()=>setFormTarget(undefined)} user={user}/>}
      {isAdmin&&csvOpen&&<CsvUploadSheet onDone={()=>{setCsvOpen(false);load();}} onCancel={()=>setCsvOpen(false)} user={user}/>}
      {isAdmin&&deleteTarget&&<DeleteConfirm school={deleteTarget} onConfirm={()=>{setDeleteTarget(null);load();}} onCancel={()=>setDeleteTarget(null)} user={user}/>}
    </div>
  );
}

function UsersManagementPage({ currentUser }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(async()=>{ setLoading(true); const{data}=await supabase.from("user_roles").select("*").order("created_at"); setRoles(data||[]); setLoading(false); },[]);
  useEffect(()=>{load();},[load]);

  async function setRole(userId, role, displayName) {
    setError(""); setInfo("");
    const{error:err}=await supabase.from("user_roles").update({role,status:"approved"}).eq("user_id",userId);
    if(err){setError("فشل تحديث الصلاحية");return;}
    audit.userRoleChange(currentUser, userId, role==="admin"?"مدير عام":"مشرف");
    load();
  }

  async function approve(userId, displayName) {
    setError(""); setInfo("");
    const{error:err}=await supabase.from("user_roles").update({status:"approved",role:"viewer"}).eq("user_id",userId);
    if(err){setError("فشل قبول الطلب");return;}
    audit.userApprove(currentUser, userId, displayName||"مستخدم");
    setInfo(`تم قبول ${displayName||"المستخدم"} بصلاحية مشرف`); load();
  }

  async function reject(userId, displayName) {
    setError(""); setInfo("");
    const{error:err}=await supabase.from("user_roles").update({status:"rejected"}).eq("user_id",userId);
    if(err){setError("فشل رفض الطلب");return;}
    audit.userReject(currentUser, userId, displayName||"مستخدم");
    load();
  }

  const pending=roles.filter(r=>r.status==="pending"), others=roles.filter(r=>r.status!=="pending");

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      <h2 style={{ margin:"0 0 4px", fontSize:17, color:C.dark }}>إدارة المستخدمين والصلاحيات</h2>
      <p style={{ margin:"0 0 16px", fontSize:12, color:C.muted }}>تحكم في من يملك صلاحية التعديل الكاملة</p>
      <ErrorBanner message={error}/>
      {info&&<div style={{ background:C.successBg, border:`1px solid ${C.success}40`, borderRadius:10, padding:"10px 14px", fontSize:13, color:C.success, marginBottom:12 }}>✅ {info}</div>}
      {loading?<div style={{ textAlign:"center", padding:30 }}><Spinner/></div>:(
        <>
          {pending.length>0&&<div style={{ marginBottom:20 }}><p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.warn }}>🔔 طلبات تسجيل بانتظار الموافقة ({pending.length})</p><div style={{ display:"flex", flexDirection:"column", gap:8 }}>{pending.map(r=><Card key={r.user_id} style={{ padding:14, background:C.warnBg, border:`1px solid ${C.warn}40` }}><p style={{ margin:"0 0 2px", fontSize:13, fontWeight:700, color:C.dark }}>{r.display_name||"مستخدم"}</p><p style={{ margin:"0 0 10px", fontSize:11, color:C.muted }}>طلب التسجيل {new Date(r.created_at).toLocaleDateString("ar-SA")}</p><div style={{ display:"flex", gap:8 }}><Btn sm full variant="primary" onClick={()=>approve(r.user_id,r.display_name)}>✅ قبول</Btn><Btn sm full variant="danger" onClick={()=>reject(r.user_id,r.display_name)}>❌ رفض</Btn></div></Card>)}</div></div>}
          {others.length===0?<Card style={{ textAlign:"center", padding:24 }}><p style={{ margin:0, color:C.muted, fontSize:13 }}>لا يوجد مستخدمون آخرون بعد</p></Card>
          :<div style={{ display:"flex", flexDirection:"column", gap:8 }}>{others.map(r=><Card key={r.user_id} style={{ padding:14, opacity:r.status==="rejected"?0.6:1 }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}><div><p style={{ margin:0, fontSize:13, fontWeight:700, color:C.dark }}>{r.display_name||"مستخدم"} {r.user_id===currentUser?.id&&<span style={{color:C.primary,fontSize:11}}>(أنت)</span>}</p><p style={{ margin:"2px 0 0", fontSize:11, color:C.muted, direction:"ltr", textAlign:"right" }}>{r.user_id.slice(0,8)}...</p></div><div style={{ display:"flex", gap:6, alignItems:"center" }}>{r.status==="rejected"&&<Tag color={C.danger}>مرفوض</Tag>}<RoleBadgeStatic role={r.role}/></div></div>{r.status!=="rejected"&&<div style={{ display:"flex", gap:8 }}><button onClick={()=>setRole(r.user_id,"admin",r.display_name)} disabled={r.role==="admin"} style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:11, fontFamily:"inherit", border:`1.5px solid ${r.role==="admin"?C.accent:C.border}`, background:r.role==="admin"?C.accentLight:"#fff", color:r.role==="admin"?C.accent:C.muted, cursor:r.role==="admin"?"default":"pointer", fontWeight:700 }}>👑 مدير عام</button><button onClick={()=>setRole(r.user_id,"viewer",r.display_name)} disabled={r.role==="viewer"} style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:11, fontFamily:"inherit", border:`1.5px solid ${r.role==="viewer"?C.primary:C.border}`, background:r.role==="viewer"?C.primaryBg:"#fff", color:r.role==="viewer"?C.primary:C.muted, cursor:r.role==="viewer"?"default":"pointer", fontWeight:700 }}>👁️ مشرف (عرض فقط)</button></div>}{r.status==="rejected"&&<Btn sm full variant="secondary" onClick={()=>approve(r.user_id,r.display_name)}>إعادة القبول</Btn>}</Card>)}</div>}
        </>
      )}
    </div>
  );
}

function RoleBadgeStatic({ role }) {
  const isAdmin=role==="admin";
  return <span style={{ background:isAdmin?C.accentLight:C.primaryBg, color:isAdmin?C.accent:C.primary, border:`1px solid ${isAdmin?C.accent:C.primary}40`, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{isAdmin?"👑 مدير عام":"👁️ مشرف"}</span>;
}

const ACTION_LABELS = {
  ...Object.fromEntries(Object.entries(AUDIT_ACTION_LABELS).map(([k,v])=>[k,v])),
  create:{label:"إضافة",color:"#1A7A4A",icon:"➕"},
  update:{label:"تعديل",color:"#0B6E6E",icon:"✏️"},
  delete:{label:"حذف",color:"#C0392B",icon:"🗑️"},
  bulk_upload:{label:"رفع جماعي",color:"#C49A28",icon:"📄"},
};

const TABLE_LABELS = {
  survey:"الاستبيانات", template:"القوالب", directory:"الدليل",
  user:"المستخدمون", export:"التصدير", settings:"الإعدادات", system:"النظام",
  survey_schools:"المدارس", surveys:"الاستبيانات", survey_questions:"أسئلة الاستبيان", user_roles:"صلاحيات المستخدمين",
};

function SupervisorsManagementPage({ user }) {
  const [sups, setSups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [page, setPage] = useState(1);
  const [previewRows, setPreviewRows] = useState(null);
  const PER = 30;

  const load = useCallback(async()=>{ setLoading(true); const{data}=await supabase.from("supervisors").select("*").order("name"); setSups(data||[]); setLoading(false); },[]);
  useEffect(()=>{load();},[load]);

  const filtered = sups.filter(s=>!search||s.name.includes(search)||s.national_id.includes(search)||(s.phone||"").includes(search));
  const paged = filtered.slice((page-1)*PER, page*PER);

  async function saveSup(data) {
    setError("");
    if (!data.name?.trim()||!data.national_id?.trim()) { setError("الاسم ورقم الهوية حقلان إلزاميان"); return; }
    const payload={name:data.name.trim(),national_id:data.national_id.trim(),phone:data.phone?.trim()||"",email:data.email?.trim()||"",status:data.status||"مُسندة"};
    let err;
    if(data.id){({error:err}=await supabase.from("supervisors").update(payload).eq("id",data.id));}
    else{({error:err}=await supabase.from("supervisors").insert(payload));}
    if(err){setError(err.code==="23505"?"رقم الهوية مستخدم بالفعل":"حدث خطأ أثناء الحفظ");return;}
    if(data.id) audit.supervisorUpdate(user, data.id, payload.name);
    else        audit.supervisorCreate(user, null, payload.name);
    setForm(null); load();
  }

  async function deleteSup(id, name) {
    await supabase.from("supervisors").delete().eq("id",id);
    audit.supervisorDelete(user, id, name);
    setDelTarget(null); load();
  }

  async function loadPdfJs() {
    if(window.pdfjsLib) return window.pdfjsLib;
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    return window.pdfjsLib;
  }

  async function parseFile(file) {
    setError(""); setPreviewRows(null);
    const ext=file.name.split(".").pop().toLowerCase();
    if(ext==="pdf") {
      const pdfjsLib=await loadPdfJs(); const ab=await file.arrayBuffer(); const pdf=await pdfjsLib.getDocument({data:ab}).promise;
      let allText="";
      for(let p=1;p<=pdf.numPages;p++) { const page=await pdf.getPage(p); const content=await page.getTextContent(); allText+=content.items.map(i=>i.str).join(" ")+"\n"; }
      const lines=allText.split(/[\n\r]+/).map(l=>l.trim()).filter(Boolean);
      const idPattern=/\b[12]\d{9}\b/, phonePattern=/\b05\d{8}\b/, rows=[];
      for(const line of lines) {
        const idMatch=line.match(idPattern), phoneMatch=line.match(phonePattern);
        if(idMatch) { let name=line.replace(idMatch[0],"").replace(phoneMatch?.[0]||"","").replace(/\d+/g,"").replace(/[#\-_|،,]/g," ").trim().replace(/\s+/g," "); if(name.length>2) rows.push({name,national_id:idMatch[0],phone:phoneMatch?.[0]||"",email:"",status:"مُسندة"}); }
      }
      if(!rows.length){setError("لم يتم التعرف على بيانات منظمة. يُنصح باستخدام Excel.");return;}
      setPreviewRows(rows);
    } else {
      const XLSX=await ensureXLSX(); const ab=await file.arrayBuffer(); const wb=XLSX.read(ab); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(ws);
      const mapped=rows.map(r=>({name:String(r["الاسم"]||r["name"]||r["Name"]||"").trim(),national_id:String(r["رقم الهوية"]||r["national_id"]||r["الهوية"]||"").trim(),phone:String(r["الجوال"]||r["phone"]||r["Phone"]||"").trim(),email:String(r["البريد"]||r["email"]||"").trim(),status:String(r["الحالة"]||"مُسندة")})).filter(r=>r.name&&r.national_id);
      if(!mapped.length){setError("لم يتم العثور على بيانات صحيحة.");return;}
      setPreviewRows(mapped);
    }
  }

  async function confirmImport() {
    if(!previewRows?.length) return;
    const{error:err}=await supabase.from("supervisors").upsert(previewRows,{onConflict:"national_id"});
    if(err){setError("فشل الاستيراد: "+err.message);return;}
    audit.supervisorImport(user, previewRows.length);
    setInfo(`تم استيراد ${previewRows.length} مشرف بنجاح`);
    setPreviewRows(null); setCsvOpen(false); load();
  }

  const inputStyle={width:"100%",padding:"10px 12px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:13,fontFamily:"inherit",direction:"rtl",boxSizing:"border-box",outline:"none",marginBottom:10};

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      <h2 style={{ margin:"0 0 4px", fontSize:17, color:C.dark }}>إدارة المشرفين</h2>
      <p style={{ margin:"0 0 12px", fontSize:12, color:C.muted }}>{sups.length} مشرف مسجّل</p>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}><Btn sm full onClick={()=>setForm({})}>➕ إضافة مشرف</Btn><Btn sm full variant="secondary" onClick={()=>{setCsvOpen(true);setPreviewRows(null);}}>📄 رفع Excel/PDF</Btn></div>
      <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="🔍 ابحث بالاسم أو رقم الهوية أو الجوال..."
        style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:13, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none", marginBottom:12 }}/>
      <ErrorBanner message={error}/>
      {info&&<div style={{ background:C.successBg, border:`1px solid ${C.success}40`, borderRadius:10, padding:"10px 14px", fontSize:12, color:C.success, marginBottom:12 }}>✅ {info}</div>}
      {loading?<div style={{ textAlign:"center", padding:30 }}><Spinner/></div>:(
        <>
          <p style={{ fontSize:11, color:C.muted, margin:"0 0 8px" }}>عرض {paged.length} من {filtered.length}</p>
          <Card style={{ padding:0, overflow:"hidden" }}>
            {paged.length===0?<p style={{ padding:20, textAlign:"center", color:C.muted, fontSize:13 }}>لا توجد نتائج</p>
            :paged.map((s,i)=><div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderBottom:i<paged.length-1?`1px solid ${C.border}`:undefined }}><div style={{ flex:1, minWidth:0 }}><p style={{ margin:0, fontSize:13, fontWeight:700, color:C.dark }}>{s.name}</p><p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>هوية: {s.national_id} {s.phone&&`· 📱 ${s.phone}`}</p></div><Tag color={s.status==="مُسندة"?C.success:C.muted}>{s.status}</Tag><div style={{ display:"flex", gap:6, flexShrink:0 }}><button onClick={()=>setForm(s)} style={{ background:C.primaryBg, border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, color:C.primary, cursor:"pointer", fontFamily:"inherit" }}>✏️</button><button onClick={()=>setDelTarget(s)} style={{ background:"#fdf0ee", border:"none", borderRadius:8, padding:"5px 8px", fontSize:11, color:C.danger, cursor:"pointer", fontFamily:"inherit" }}>🗑️</button></div></div>)}
          </Card>
          {Math.ceil(filtered.length/PER)>1&&<div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:12 }}><Btn sm variant="secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>السابق</Btn><span style={{ padding:"8px 14px", fontSize:13, color:C.muted }}>{page}/{Math.ceil(filtered.length/PER)}</span><Btn sm variant="secondary" disabled={page>=Math.ceil(filtered.length/PER)} onClick={()=>setPage(p=>p+1)}>التالي</Btn></div>}
        </>
      )}
      {form!==null&&<div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"flex-end", direction:"rtl" }}><div style={{ width:"100%", background:C.white, borderRadius:"20px 20px 0 0", padding:20, maxHeight:"80vh", overflowY:"auto" }}><h3 style={{ margin:"0 0 16px", fontSize:16, color:C.dark }}>{form.id?"تعديل بيانات المشرف":"إضافة مشرف جديد"}</h3>{[["الاسم","name","اسم المشرف"],["رقم الهوية","national_id","10 أرقام"],["رقم الجوال","phone","05xxxxxxxx"],["البريد الإلكتروني","email",""]].map(([l,k,ph])=><div key={k}><label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:4 }}>{l}</label><input value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={inputStyle}/></div>)}<label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:4 }}>الحالة</label><select value={form.status||"مُسندة"} onChange={e=>setForm(p=>({...p,status:e.target.value}))} style={{ ...inputStyle, background:C.white }}><option>مُسندة</option><option>غير مُسندة</option></select><ErrorBanner message={error}/><div style={{ display:"flex", gap:8 }}><Btn full variant="secondary" onClick={()=>{setForm(null);setError("");}}>إلغاء</Btn><Btn full onClick={()=>saveSup(form)}>حفظ</Btn></div></div></div>}
      {delTarget&&<div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}><div style={{ background:C.white, borderRadius:16, padding:20, width:"100%", maxWidth:340 }}><p style={{ textAlign:"center", fontWeight:700, color:C.dark, fontSize:15 }}>حذف {delTarget.name}؟</p><p style={{ textAlign:"center", color:C.muted, fontSize:12 }}>لا يمكن التراجع</p><div style={{ display:"flex", gap:8, marginTop:14 }}><Btn full variant="secondary" onClick={()=>setDelTarget(null)}>إلغاء</Btn><Btn full variant="danger" onClick={()=>deleteSup(delTarget.id,delTarget.name)}>حذف</Btn></div></div></div>}
      {csvOpen&&<div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"flex-end", direction:"rtl" }}><div style={{ width:"100%", background:C.white, borderRadius:"20px 20px 0 0", padding:20, maxHeight:"85vh", overflowY:"auto" }}><h3 style={{ margin:"0 0 12px", fontSize:16 }}>رفع قائمة مشرفين</h3>{!previewRows?(<><Card style={{ marginBottom:12, background:C.primaryBg }}><p style={{ margin:"0 0 6px", fontSize:12, color:C.text, lineHeight:1.8 }}><strong>Excel/CSV:</strong> أعمدة: الاسم، رقم الهوية (إلزامي)</p><p style={{ margin:0, fontSize:12, color:C.warn, lineHeight:1.8 }}><strong>PDF:</strong> استخراج تلقائي قد يحتاج مراجعة</p></Card><ErrorBanner message={error}/><input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={e=>{if(e.target.files?.[0]) parseFile(e.target.files[0]);}} style={{ width:"100%", fontSize:13, marginBottom:12 }}/><Btn full variant="secondary" onClick={()=>{setCsvOpen(false);setError("");}}>إلغاء</Btn></>):(<><div style={{ background:C.successBg, border:`1px solid ${C.success}40`, borderRadius:10, padding:"10px 14px", fontSize:12, color:C.success, marginBottom:12 }}>✅ تم قراءة <strong>{previewRows.length}</strong> سجل</div><div style={{ overflowX:"auto", marginBottom:14 }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}><thead><tr style={{ background:C.primaryBg }}>{["الاسم","رقم الهوية","الجوال"].map(h=><th key={h} style={{ padding:"8px 10px", textAlign:"right", color:C.primary, borderBottom:`1px solid ${C.border}` }}>{h}</th>)}</tr></thead><tbody>{previewRows.slice(0,20).map((r,i)=><tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}><td style={{ padding:"7px 10px", color:C.dark }}>{r.name||"—"}</td><td style={{ padding:"7px 10px", color:C.muted, direction:"ltr" }}>{r.national_id}</td><td style={{ padding:"7px 10px", color:C.muted }}>{r.phone||"—"}</td></tr>)}</tbody></table>{previewRows.length>20&&<p style={{ textAlign:"center", fontSize:11, color:C.muted, marginTop:6 }}>... و{previewRows.length-20} سجل آخر</p>}</div><div style={{ display:"flex", gap:8 }}><Btn full variant="secondary" onClick={()=>setPreviewRows(null)}>← رجوع</Btn><Btn full onClick={confirmImport}>💾 حفظ الكل</Btn></div></>)}</div></div>}
    </div>
  );
}

function AppSettingsPage({ onSaved }) {
  const { settings, reload } = useAppSettings();
  const [logoUrl, setLogoUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [appSubtitle, setAppSubtitle] = useState("");
  const [defaultSurveyType, setDefaultSurveyType] = useState("school");
  const [defaultReminderMsg, setDefaultReminderMsg] = useState("");
  const [reportHeader, setReportHeader] = useState("");
  const [reportFooter, setReportFooter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLogoUrl(settings.logo_url || "");
    setAppName(settings.app_name || "منظومة الاستبيانات");
    setAppSubtitle(settings.app_subtitle || "إدارة التعليم — جدة");
    setDefaultSurveyType(settings.default_survey_type || "school");
    setDefaultReminderMsg(settings.default_reminder_msg || "");
    setReportHeader(settings.report_header || "");
    setReportFooter(settings.report_footer || "");
  }, [settings]);

  async function uploadLogo(file) {
    if(!file) return;
    setUploading(true); setError("");
    const ext=file.name.split(".").pop(), path=`logo.${ext}`;
    const{error:upErr}=await supabase.storage.from("logos").upload(path,file,{upsert:true});
    if(upErr){setError("فشل رفع الصورة: "+upErr.message);setUploading(false);return;}
    const{data}=supabase.storage.from("logos").getPublicUrl(path);
    setLogoUrl(data.publicUrl+"?t="+Date.now()); setUploading(false);
  }

  async function save() {
    setSaving(true); setError(""); setInfo("");
    await saveSetting("logo_url", logoUrl);
    await saveSetting("app_name", appName);
    await saveSetting("app_subtitle", appSubtitle);
    await saveSetting("default_survey_type", defaultSurveyType);
    await saveSetting("default_reminder_msg", defaultReminderMsg);
    await saveSetting("report_header", reportHeader);
    await saveSetting("report_footer", reportFooter);
    await reload();
    setSaving(false);
    setInfo("تم حفظ الإعدادات بنجاح");
    if(onSaved) onSaved();
  }

  const inputStyle={width:"100%",padding:"11px 13px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,fontFamily:"inherit",direction:"rtl",boxSizing:"border-box",outline:"none"};

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      <h2 style={{ margin:"0 0 4px", fontSize:17, color:C.dark }}>إعدادات التطبيق</h2>
      <p style={{ margin:"0 0 16px", fontSize:12, color:C.muted }}>تخصيص اللوغو وعناوين النظام والإعدادات الافتراضية</p>

      <Card style={{ marginBottom:14 }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>🖼️ اللوغو</p>
        {logoUrl?<div style={{ textAlign:"center", marginBottom:12 }}><img src={logoUrl} alt="logo" style={{ maxHeight:80, maxWidth:"100%", borderRadius:10, objectFit:"contain" }}/></div>
        :<div style={{ textAlign:"center", marginBottom:12, padding:20, background:C.bg, borderRadius:10 }}><p style={{ margin:0, fontSize:12, color:C.muted }}>لا يوجد لوغو حالياً</p></div>}
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:6 }}>رفع صورة جديدة:</label>
        <input type="file" accept="image/*" onChange={e=>uploadLogo(e.target.files?.[0])} disabled={uploading} style={{ width:"100%", fontSize:13, marginBottom:10 }}/>
        {uploading&&<p style={{ fontSize:12, color:C.primary, margin:"0 0 8px" }}>جاري الرفع...</p>}
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:6 }}>أو أدخل رابط URL:</label>
        <input value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" style={{ ...inputStyle, direction:"ltr" }}/>
        <button onClick={()=>setLogoUrl("")} style={{ background:"none", border:"none", color:C.danger, fontSize:11, cursor:"pointer", marginTop:6, fontFamily:"inherit" }}>✕ إزالة اللوغو</button>
      </Card>

      <Card style={{ marginBottom:14 }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>📝 عناوين النظام</p>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:5 }}>اسم النظام:</label>
        <input value={appName} onChange={e=>setAppName(e.target.value)} style={{ ...inputStyle, marginBottom:12 }}/>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:5 }}>العنوان الفرعي:</label>
        <input value={appSubtitle} onChange={e=>setAppSubtitle(e.target.value)} style={inputStyle}/>
      </Card>

      <Card style={{ marginBottom:14 }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>⚙️ الإعدادات الافتراضية للاستبيانات</p>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:5 }}>نوع الاستبيان الافتراضي:</label>
        <select value={defaultSurveyType} onChange={e=>setDefaultSurveyType(e.target.value)} style={{ ...inputStyle, background:C.white, marginBottom:12 }}>
          <option value="school">🏫 مدارس</option>
          <option value="supervisor">👤 مشرفون</option>
          <option value="administrator">🎓 إداريون</option>
          <option value="open">🌐 مفتوح</option>
        </select>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:5 }}>رسالة التذكير الافتراضية:</label>
        <textarea value={defaultReminderMsg} onChange={e=>setDefaultReminderMsg(e.target.value)} rows={3}
          placeholder="مثال: نرجو تعبئة الاستبيان في أقرب وقت ممكن"
          style={{ ...inputStyle, resize:"vertical" }}/>
      </Card>

      <Card style={{ marginBottom:14 }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>📄 علامة التقارير التجارية</p>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:5 }}>ترويسة التقارير:</label>
        <input value={reportHeader} onChange={e=>setReportHeader(e.target.value)}
          placeholder="مثال: إدارة التعليم بجدة — قسم الاستبيانات"
          style={{ ...inputStyle, marginBottom:12 }}/>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:5 }}>تذييل التقارير:</label>
        <input value={reportFooter} onChange={e=>setReportFooter(e.target.value)}
          placeholder="مثال: سري وخاص — لا يُعاد توزيعه"
          style={inputStyle}/>
      </Card>

      <ErrorBanner message={error}/>
      {info&&<div style={{ background:C.successBg, border:`1px solid ${C.success}40`, borderRadius:10, padding:"10px 14px", fontSize:13, color:C.success, marginBottom:12 }}>✅ {info}</div>}
      <Btn full loading={saving} onClick={save}>💾 حفظ الإعدادات</Btn>
    </div>
  );
}

function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("الكل");
  const [categoryFilter, setCategoryFilter] = useState("الكل");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 40;

  useEffect(() => {
    setLoading(true);
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, []);

  const filtered = logs.filter(l => {
    if (actionFilter !== "الكل" && l.action !== actionFilter) return false;
    if (categoryFilter !== "الكل" && (l.category || l.table_name) !== categoryFilter) return false;
    return true;
  });
  const paged = filtered.slice(0, page * PAGE_SIZE);

  async function exportLogExcel() {
    const XLSX = await ensureXLSX();
    const rows = filtered.map(l => ({
      "التاريخ والوقت": new Date(l.created_at).toLocaleString("ar-SA"),
      "المستخدم": l.user_email || "—",
      "الإجراء": (ACTION_LABELS[l.action]?.label || l.action),
      "التصنيف": TABLE_LABELS[l.category||l.table_name] || l.table_name || "—",
      "العنصر": l.record_label || l.record_id || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 26 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل التدقيق");
    XLSX.writeFile(wb, `سجل-التدقيق-${tsStamp()}.xlsx`);
  }

  const QUICK_FILTERS = [
    {v:"الكل",l:"الكل"},
    {v:"survey_publish",l:"🚀 نشر"},
    {v:"survey_pause",l:"⏸️ إيقاف"},
    {v:"survey_close",l:"🔒 إغلاق"},
    {v:"survey_archive",l:"📦 أرشفة"},
    {v:"survey_duplicate",l:"📄 نسخ"},
    {v:"create",l:"➕ إضافة"},
    {v:"update",l:"✏️ تعديل"},
    {v:"delete",l:"🗑️ حذف"},
  ];

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <h2 style={{ margin:0, fontSize:17, color:C.dark }}>سجل التدقيق</h2>
        {logs.length > 0 && <ExportMenu options={[{key:"xlsx",icon:"📊",label:"تصدير Excel",action:exportLogExcel}]}/>}
      </div>
      <p style={{ margin:"0 0 14px", fontSize:12, color:C.muted }}>سجل كل عمليات النظام</p>

      <div style={{ display:"flex", gap:6, marginBottom:10, overflowX:"auto" }}>
        {QUICK_FILTERS.map(f => (
          <button key={f.v} onClick={()=>{ setActionFilter(f.v); setPage(1); }} style={{
            padding:"6px 14px", borderRadius:18, fontSize:12, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap",
            border:`1.5px solid ${actionFilter===f.v?C.primary:C.border}`,
            background:actionFilter===f.v?C.primaryBg:"#fff", color:actionFilter===f.v?C.primary:C.muted,
            fontWeight:actionFilter===f.v?700:400 }}>{f.l}</button>
        ))}
      </div>

      {loading?<div style={{ textAlign:"center", padding:40 }}><Spinner size={28}/></div>
      :filtered.length===0?<p style={{ textAlign:"center", color:C.muted, fontSize:13, padding:30 }}>لا توجد سجلات بعد</p>
      :(
        <>
          <Card style={{ padding:0, overflow:"hidden" }}>
            {paged.map((l,i) => {
              const a = ACTION_LABELS[l.action] || {label:l.action, color:C.muted, icon:"•"};
              return (
                <div key={l.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", borderBottom:i<paged.length-1?`1px solid ${C.border}`:undefined }}>
                  <div style={{ width:30, height:30, borderRadius:8, background:a.color+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{a.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, color:C.dark }}>
                      <strong>{a.label}</strong>
                      {l.record_label && <> — {l.record_label}</>}
                    </p>
                    <p style={{ margin:"3px 0 0", fontSize:11, color:C.muted }}>
                      {l.user_email||"غير معروف"} · {new Date(l.created_at).toLocaleString("ar-SA")}
                    </p>
                  </div>
                </div>
              );
            })}
          </Card>
          {paged.length<filtered.length&&<Btn variant="secondary" full onClick={()=>setPage(p=>p+1)} style={{ marginTop:12 }}>عرض المزيد ({filtered.length-paged.length} متبقي)</Btn>}
        </>
      )}
    </div>
  );
}

export { SurveysList, NewSurveyPage, ShareSheet, LoginPage, AnalyticsPage,
  SchoolForm, CsvUploadSheet, DeleteConfirm, SchoolsManagementPage,
  UsersManagementPage, RoleBadgeStatic, SupervisorsManagementPage,
  AppSettingsPage, AuditLogPage };

