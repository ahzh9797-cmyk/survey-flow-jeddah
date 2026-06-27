import { useState } from "react";
import { supabase, C, Btn, Card, ErrorBanner, Spinner } from "./lib.jsx";

// ═══════════════════════════════════════════════════════
// SURVEY TYPE CONSTANTS
// Internal stable values — never use Arabic in logic
// ═══════════════════════════════════════════════════════
export const SURVEY_TYPES = {
  SCHOOL:         "school",
  SUPERVISOR:     "supervisor",
  ADMINISTRATOR:  "administrator",
  PUBLIC:         "open",
};

export const SURVEY_TYPE_LABELS = {
  school:        "🏫 مدارس",
  supervisor:    "👤 مشرفون",
  administrator: "🎓 الإداريون",
  open:          "🌐 مفتوح",
};

export const SURVEY_STATUS_LABELS = {
  draft:     "📝 مسودة",
  published: "✅ منشور",
  closed:    "🔒 مغلق",
  archived:  "📦 مؤرشف",
};

export const RESPONSE_LIMIT_LABELS = {
  one_per_entity: "رد واحد لكل جهة",
  unlimited:      "ردود غير محدودة",
};

// ═══════════════════════════════════════════════════════
// VERIFICATION SERVICE
// Single reusable service for all entity types
// ═══════════════════════════════════════════════════════

/*
  verifyEntity(surveyType, identifier) → { entity, error }
  
  school:        identifier = Ministry Number → looks up survey_schools
  supervisor:    identifier = National ID    → looks up supervisors
  administrator: identifier = National ID    → looks up administrators
  open:          no verification needed      → returns null entity
*/
export async function verifyEntity(surveyType, identifier) {
  if (surveyType === SURVEY_TYPES.PUBLIC) {
    return { entity: null, error: null };
  }

  const trimmed = identifier?.trim();
  if (!trimmed) {
    return { entity: null, error: "الرجاء إدخال رقم التحقق" };
  }

  let table, pkField, errorMsg;
  switch (surveyType) {
    case SURVEY_TYPES.SCHOOL:
      table    = "survey_schools";
      pkField  = "id";
      errorMsg = "الرقم الوزاري غير موجود في قاعدة البيانات";
      break;
    case SURVEY_TYPES.SUPERVISOR:
      table    = "supervisors";
      pkField  = "national_id";
      errorMsg = "رقم الهوية غير موجود في قاعدة بيانات المشرفين";
      break;
    case SURVEY_TYPES.ADMINISTRATOR:
      table    = "administrators";
      pkField  = "national_id";
      errorMsg = "رقم الهوية غير موجود في قاعدة بيانات المديرين";
      break;
    default:
      return { entity: null, error: "نوع استبيان غير معروف" };
  }

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq(pkField, trimmed)
    .maybeSingle();

  if (error || !data) {
    return { entity: null, error: errorMsg };
  }

  // Check active status (only for directory entities with status field)
  if (data.status && data.status !== "نشط") {
    return { entity: null, error: "هذا السجل غير نشط حالياً. تواصل مع المسؤول." };
  }

  return { entity: data, error: null };
}

/*
  checkDuplicateResponse(surveyId, surveyType, entity, responseLimit)
  → { isDuplicate, existingResponse }
  
  Checks if entity has already responded to this survey.
  Respects response_limit setting.
*/
export async function checkDuplicateResponse(surveyId, surveyType, entity, responseLimit) {
  if (responseLimit === "unlimited") {
    return { isDuplicate: false, existingResponse: null };
  }
  if (!entity) return { isDuplicate: false, existingResponse: null };

  let query = supabase
    .from("survey_responses")
    .select("submitted_at, answers")
    .eq("survey_id", surveyId);

  if (surveyType === SURVEY_TYPES.SCHOOL) {
    query = query.eq("school_id", entity.id);
  } else {
    // supervisor / administrator — use national_id
    const nationalId = entity.national_id;
    if (!nationalId) return { isDuplicate: false, existingResponse: null };
    query = query.eq("respondent_national_id", nationalId);
  }

  const { data } = await query.maybeSingle();
  return { isDuplicate: !!data, existingResponse: data || null };
}

/*
  buildResponsePayload(surveyType, entity, respondentLabel, answers, stoppedAtGate, gateQuestionId)
  → payload object ready for insert/upsert
*/
export function buildResponsePayload(surveyType, entity, respondentLabel, answers, stoppedAtGate, gateQuestionId) {
  const base = {
    answers,
    completed: !stoppedAtGate,
  };

  switch (surveyType) {
    case SURVEY_TYPES.SCHOOL:
      return { ...base, school_id: entity?.id, respondent_label: entity?.name || null };
    case SURVEY_TYPES.SUPERVISOR:
      return { ...base,
        respondent_label: entity?.name || null,
        respondent_national_id: entity?.national_id || null,
      };
    case SURVEY_TYPES.ADMINISTRATOR:
      return { ...base,
        respondent_label: entity?.full_name || null,
        respondent_national_id: entity?.national_id || null,
      };
    case SURVEY_TYPES.PUBLIC:
      return { ...base, respondent_label: respondentLabel?.trim() || null };
    default:
      return base;
  }
}

// ═══════════════════════════════════════════════════════
// VERIFICATION UI COMPONENT
// Reusable identity verification screen
// ═══════════════════════════════════════════════════════
export function VerificationStep({ survey, onVerified }) {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [entity, setEntity] = useState(null);

  const surveyType = survey.survey_type;

  const config = {
    school: {
      icon: "🏫",
      title: "تحقق من هوية المدرسة",
      label: "الرقم الوزاري",
      placeholder: "أدخل الرقم الوزاري",
      dir: "ltr",
      inputMode: "numeric",
    },
    supervisor: {
      icon: "👤",
      title: "تحقق من هوية المشرف",
      label: "رقم الهوية الوطنية",
      placeholder: "10 أرقام",
      dir: "ltr",
      inputMode: "numeric",
    },
    administrator: {
      icon: "🎓",
      title: "تحقق من هوية المدير",
      label: "رقم الهوية الوطنية",
      placeholder: "10 أرقام",
      dir: "ltr",
      inputMode: "numeric",
    },
  }[surveyType];

  if (!config) return null; // open survey — no verification needed

  async function handleVerify() {
    setLoading(true); setError(""); setEntity(null);
    const { entity: found, error: err } = await verifyEntity(surveyType, identifier);
    setLoading(false);
    if (err) { setError(err); return; }
    setEntity(found);
  }

  function getEntityDisplay(e) {
    switch (surveyType) {
      case "school":        return { name: e.name,      sub: `${e.stage||""} ${e.sector?"· "+e.sector:""}`.trim(), id: e.id };
      case "supervisor":    return { name: e.name,      sub: e.department||"",  id: e.national_id };
      case "administrator": return { name: e.full_name, sub: e.department||"",  id: e.national_id };
      default: return { name: "", sub: "", id: "" };
    }
  }

  return (
    <div style={{ direction:"rtl" }}>
      <Card style={{ marginBottom:16 }}>
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <span style={{ fontSize:40 }}>{config.icon}</span>
          <p style={{ margin:"8px 0 0", fontSize:15, fontWeight:800, color:C.dark }}>{config.title}</p>
          <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>أدخل بياناتك للتحقق قبل بدء الاستبيان</p>
        </div>

        <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>
          {config.label} <span style={{color:C.danger}}>*</span>
        </label>
        <div style={{ display:"flex", gap:8 }}>
          <input
            value={identifier}
            onChange={e=>{ setIdentifier(e.target.value); setEntity(null); setError(""); }}
            placeholder={config.placeholder}
            inputMode={config.inputMode}
            onKeyDown={e=>e.key==="Enter"&&handleVerify()}
            style={{
              flex:1, padding:"13px 14px",
              border:`1.5px solid ${error?C.danger:entity?C.success:C.border}`,
              borderRadius:10, fontSize:16, fontFamily:"inherit",
              direction:config.dir, textAlign:"center", fontWeight:700,
              boxSizing:"border-box", outline:"none"
            }}
          />
          <Btn onClick={handleVerify} loading={loading}>بحث</Btn>
        </div>

        <ErrorBanner message={error}/>

        {entity && (() => {
          const display = getEntityDisplay(entity);
          return (
            <div style={{ background:C.successBg, border:`1.5px solid ${C.success}`, borderRadius:12,
              padding:16, marginTop:12 }}>
              <p style={{ margin:"0 0 4px", fontSize:12, color:C.success, fontWeight:700 }}>✅ تم التحقق بنجاح</p>
              <p style={{ margin:"0 0 4px", fontSize:17, fontWeight:800, color:C.dark }}>{display.name}</p>
              {display.sub && <p style={{ margin:"0 0 4px", fontSize:13, color:C.muted }}>{display.sub}</p>}
              <p style={{ margin:"0 0 14px", fontSize:12, color:C.muted }}>المعرّف: {display.id}</p>
              <Btn full onClick={()=>onVerified(entity)}>✓ تأكيد والمتابعة للاستبيان</Btn>
            </div>
          );
        })()}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TARGET TYPE SELECTOR (for NewSurveyPage)
// ═══════════════════════════════════════════════════════
export function SurveyTypeSelector({ value, onChange }) {
  const types = [
    { v:"school",        i:"🏫", l:"مدارس",    s:"رقم وزاري",    c:C.primary,    bg:C.primaryBg },
    { v:"supervisor",    i:"👤", l:"مشرفون",   s:"رقم هوية",     c:"#7B2D8B",    bg:"#f5eefa" },
    { v:"administrator", i:"🎓", l:"الإداريون", s:"رقم هوية",     c:"#B7791F",    bg:"#FFFBEB" },
    { v:"open",          i:"🌐", l:"مفتوح",    s:"بدون تحقق",    c:C.accent,     bg:C.accentLight },
  ];

  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>
        🎯 الجهة المستهدفة
      </label>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
        {types.map(t => (
          <button key={t.v} onClick={()=>onChange(t.v)} style={{
            padding:"12px 10px", borderRadius:12, cursor:"pointer", fontFamily:"inherit",
            border:`2px solid ${value===t.v ? t.c : C.border}`,
            background: value===t.v ? t.bg : "#fff",
            textAlign:"center", transition:"all 0.15s",
            boxShadow: value===t.v ? `0 2px 8px ${t.c}25` : "none"
          }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{t.i}</div>
            <div style={{ fontSize:13, fontWeight:700, color:value===t.v ? t.c : C.dark }}>{t.l}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{t.s}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SURVEY SETTINGS PANEL (for NewSurveyPage)
// response_limit, start_date, end_date, survey_status
// ═══════════════════════════════════════════════════════
export function SurveySettingsPanel({ settings, onChange }) {
  function set(k,v) { onChange({ ...settings, [k]:v }); }

  const inputStyle = {
    width:"100%", padding:"10px 12px",
    border:`1.5px solid ${C.border}`, borderRadius:10,
    fontSize:14, fontFamily:"inherit", boxSizing:"border-box",
    outline:"none", marginBottom:10
  };

  return (
    <div>
      <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>
        🔁 حد الردود
      </label>
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[["one_per_entity","رد واحد لكل جهة"],["unlimited","غير محدود"]].map(([v,l]) => (
          <button key={v} onClick={()=>set("response_limit",v)} style={{
            flex:1, padding:"10px 6px", borderRadius:10, cursor:"pointer", fontFamily:"inherit",
            fontSize:12, fontWeight:settings.response_limit===v?700:400,
            border:`1.5px solid ${settings.response_limit===v?C.primary:C.border}`,
            background:settings.response_limit===v?C.primaryBg:"#fff",
            color:settings.response_limit===v?C.primary:C.muted
          }}>{l}</button>
        ))}
      </div>

      <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>
        📅 تاريخ البداية <span style={{fontWeight:400, color:C.muted, fontSize:11}}>(اختياري)</span>
      </label>
      <input type="datetime-local" value={settings.start_date||""}
        onChange={e=>set("start_date",e.target.value)}
        style={{ ...inputStyle, direction:"ltr" }}/>

      <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>
        📅 تاريخ الانتهاء <span style={{fontWeight:400, color:C.muted, fontSize:11}}>(اختياري)</span>
      </label>
      <input type="datetime-local" value={settings.end_date||""}
        onChange={e=>set("end_date",e.target.value)}
        style={{ ...inputStyle, direction:"ltr" }}/>

      <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>
        📊 حالة الاستبيان
      </label>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
        {[["draft","مسودة"],["published","منشور"],["closed","مغلق"],["archived","مؤرشف"]].map(([v,l]) => (
          <button key={v} onClick={()=>set("survey_status",v)} style={{
            padding:"8px 14px", borderRadius:20, cursor:"pointer", fontFamily:"inherit",
            fontSize:12, fontWeight:settings.survey_status===v?700:400,
            border:`1.5px solid ${settings.survey_status===v?C.primary:C.border}`,
            background:settings.survey_status===v?C.primaryBg:"#fff",
            color:settings.survey_status===v?C.primary:C.muted
          }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SURVEY STATUS GATE (used in PublicFill)
// Checks if survey is currently accessible
// ═══════════════════════════════════════════════════════
export function checkSurveyAccess(survey) {
  const now = new Date();

  // Check survey_status (new field — backward compatible: default is 'published')
  const status = survey.survey_status || "published";
  if (status === "draft")    return { allowed:false, reason:"هذا الاستبيان لا يزال في مرحلة المسودة وغير متاح بعد." };
  if (status === "closed")   return { allowed:false, reason:"تم إغلاق هذا الاستبيان ولم يعد يقبل ردوداً." };
  if (status === "archived") return { allowed:false, reason:"هذا الاستبيان مؤرشف وغير متاح." };

  // Check start_date
  if (survey.start_date && new Date(survey.start_date) > now) {
    const d = new Date(survey.start_date).toLocaleDateString("ar-SA");
    return { allowed:false, reason:`هذا الاستبيان لم يُفتح بعد. يُفتح في ${d}.` };
  }

  // Check end_date (replaces expires_at — supports both for backward compat)
  const endDate = survey.end_date || survey.expires_at;
  if (endDate && new Date(endDate) < now) {
    return { allowed:false, reason:`انتهت مدة هذا الاستبيان في ${new Date(endDate).toLocaleDateString("ar-SA")}.` };
  }

  // Check approval_status (existing field — backward compat)
  if (survey.approval_status && survey.approval_status !== "approved") {
    return { allowed:false, reason:"هذا الاستبيان لم يُعتمد بعد." };
  }

  return { allowed:true, reason:null };
}

