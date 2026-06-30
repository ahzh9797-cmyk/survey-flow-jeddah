/**
 * CommunicationCenter — مركز الاتصالات
 * Phase 3 — Enterprise UI redesign (Microsoft 365 / Stripe language)
 * Logic: 100% unchanged. Only presentation layer rebuilt.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ErrorBanner } from "./lib.jsx";
import { SURVEY_TYPE_LABELS } from "./SurveyService.jsx";
import { resolveTargetedSchools, emptyTargeting, loadTargeting } from "./TargetingService.jsx";
import {
  TEMPLATE_CATEGORIES, TEMPLATE_VARIABLES,
  resolveTemplate, buildTemplateVariables,
  fetchTemplates, createTemplate, updateTemplate,
  archiveTemplate, duplicateTemplate,
  sendCommunication, fetchCommunicationLog, fetchNonRespondents,
} from "./CommunicationService.js";
import { NOTIFICATION_CHANNELS } from "./NotificationService.js";

// ── Enterprise styles — Phase 3, matches Dashboard/SurveysList/Directory/Templates ──
if (typeof document !== "undefined" && !document.getElementById("comm-enterprise-styles")) {
  const _s = document.createElement("style");
  _s.id = "comm-enterprise-styles";
  _s.textContent = `
    .comm-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .comm-card:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; }
    .comm-btn { transition: all 0.12s ease; }
    .comm-btn:active { transform: scale(0.95); }
    .comm-search:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; outline: none; }
    .comm-chip { transition: all 0.15s ease; }
    @keyframes comm-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    .comm-in { animation: comm-in 0.2s ease both; }
    @keyframes spin { to { transform: rotate(360deg) } }

    /* Desktop two-column layout for the Send panel — shown ≥1280px */
    .comm-send-layout { display: block; }
    @media (min-width: 1280px) {
      .comm-send-layout { display: grid; grid-template-columns: 1fr 380px; gap: 18px; align-items: start; }
    }

    /* Templates grid — responsive like TemplatesPage */
    .comm-tmpl-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
    @media (min-width: 1024px) {
      .comm-tmpl-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
    }
    @media (min-width: 1440px) {
      .comm-tmpl-grid { grid-template-columns: repeat(3, 1fr); }
    }
  `;
  document.head.appendChild(_s);
}

const CC = {
  e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
  e100:"#D1FAE5",e50:"#ECFDF5",
  gold:"#C9A84C",goldL:"#FEF3C7",
  s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
  s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
  white:"#FFFFFF",bg:"#F0F4F8",
  danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
  success:"#059669",successBg:"#ECFDF5",purple:"#7B2D8B",purpleBg:"#F5EEFA",
};

// ── Shared UI ───────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    sent:    { label:"✅ تم الإرسال", color:CC.success, bg:CC.successBg },
    partial: { label:"⚠️ جزئي",       color:CC.warn,    bg:CC.warnBg },
    failed:  { label:"❌ فشل",        color:CC.danger,  bg:CC.dangerBg },
    active:  { label:"✅ نشط",        color:CC.success, bg:CC.successBg },
    archived:{ label:"📦 مؤرشف",      color:CC.s400,    bg:CC.s100 },
  }[status] || { label:status, color:CC.s400, bg:CC.s100 };
  return (
    <span style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}30`,
      borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
      {cfg.label}
    </span>
  );
}

function SectionCard({ title, step, children }) {
  return (
    <div className="comm-card" style={{ background:CC.white, borderRadius:16,
      border:`1px solid ${CC.s200}`, marginBottom:14,
      boxShadow:"0 1px 3px rgba(0,0,0,0.04)", overflow:"hidden" }}>
      {title && (
        <div style={{ padding:"12px 16px 10px", borderBottom:`1px solid ${CC.s100}`,
          display:"flex", alignItems:"center", gap:10 }}>
          {step && (
            <span style={{ background:`linear-gradient(135deg,${CC.e600},${CC.e800})`,
              color:"#fff", borderRadius:8, width:24, height:24,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:12, fontWeight:800, flexShrink:0 }}>{step}</span>
          )}
          <p style={{ margin:0, fontSize:13, fontWeight:800, color:CC.s900 }}>{title}</p>
        </div>
      )}
      <div style={{ padding:"14px 16px" }}>{children}</div>
    </div>
  );
}

function FilterChip({ label, active, color=CC.e600, bg, onClick }) {
  return (
    <button onClick={onClick} className="comm-chip" style={{
      padding:"5px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit",
      cursor:"pointer", whiteSpace:"nowrap", fontWeight:active?700:500,
      border:`1.5px solid ${active?color:CC.s200}`,
      background:active?(bg||`${color}10`):CC.white,
      color:active?color:CC.s500,
    }}>{label}</button>
  );
}

const iSt = {
  width:"100%", padding:"11px 13px", border:`1.5px solid ${CC.s200}`,
  borderRadius:12, fontSize:14, fontFamily:"inherit", direction:"rtl",
  boxSizing:"border-box", outline:"none", background:CC.white, color:CC.s900,
  transition:"border-color 0.2s",
};

// ═══════════════════════════════════════════════════════
// TEMPLATE FORM — logic unchanged
// ═══════════════════════════════════════════════════════
function TemplateForm({ existing, user, onSaved, onCancel }) {
  // ── All logic unchanged ──
  const isEdit = !!existing;
  const [title,    setTitle]    = useState(existing?.title    || "");
  const [subject,  setSubject]  = useState(existing?.subject  || "");
  const [body,     setBody]     = useState(existing?.body     || "");
  const [category, setCategory] = useState(existing?.category || "reminder");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  async function save() {
    if (!title.trim() || !body.trim()) { setError("العنوان والنص حقلان إلزاميان"); return; }
    setSaving(true); setError("");
    const payload = { title:title.trim(), subject:subject.trim()||null, body:body.trim(), category };
    const { error:err } = isEdit
      ? await updateTemplate(existing.id, payload, user)
      : await createTemplate(payload, user);
    setSaving(false);
    if (err) { setError("فشل الحفظ: "+err.message); return; }
    onSaved();
  }
  // ── End unchanged logic ──

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200,
      display:"flex", alignItems:"flex-end", direction:"rtl" }}
      onClick={e=>{ if(e.target===e.currentTarget) onCancel(); }}>
      <div style={{ width:"100%", maxWidth:560, margin:"0 auto", background:CC.white, borderRadius:"24px 24px 0 0",
        maxHeight:"90vh", overflowY:"auto", paddingBottom:32 }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"14px 0 4px" }}>
          <div style={{ width:44, height:4, background:CC.s200, borderRadius:4 }}/>
        </div>
        <div style={{ padding:"8px 18px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:17, color:CC.s900, fontWeight:800 }}>
              {isEdit ? "تعديل القالب" : "قالب جديد"}
            </h3>
            <button onClick={onCancel} style={{ background:CC.s100, border:"none", borderRadius:10,
              width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16, cursor:"pointer", color:CC.s500 }}>✕</button>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:CC.s700, marginBottom:6 }}>
              اسم القالب <span style={{color:CC.danger}}>*</span>
            </label>
            <input value={title} onChange={e=>setTitle(e.target.value)} style={iSt}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:CC.s700, marginBottom:6 }}>الفئة</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {Object.values(TEMPLATE_CATEGORIES).map(cat => (
                <button key={cat.id} onClick={()=>setCategory(cat.id)} className="comm-chip" style={{
                  padding:"7px 12px", borderRadius:20, fontSize:12, fontFamily:"inherit", cursor:"pointer",
                  border:`1.5px solid ${category===cat.id?CC.e600:CC.s200}`,
                  background:category===cat.id?CC.e50:CC.white,
                  color:category===cat.id?CC.e700:CC.s500,
                  fontWeight:category===cat.id?700:400,
                }}>{cat.icon} {cat.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:CC.s700, marginBottom:6 }}>موضوع الرسالة</label>
            <input value={subject} onChange={e=>setSubject(e.target.value)}
              placeholder="يُستخدم في البريد الإلكتروني مستقبلاً" style={iSt}/>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:CC.s700, marginBottom:6 }}>
              نص الرسالة <span style={{color:CC.danger}}>*</span>
            </label>
            <textarea value={body} onChange={e=>setBody(e.target.value)} rows={7}
              placeholder="اكتب نص الرسالة..."
              style={{ ...iSt, resize:"vertical" }}/>
            <div style={{ background:CC.s50, borderRadius:10, padding:"10px 12px", marginTop:8,
              border:`1px solid ${CC.s100}` }}>
              <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:CC.s500 }}>المتغيرات المتاحة:</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                {TEMPLATE_VARIABLES.map(v => (
                  <button key={v.key} onClick={()=>setBody(b=>b+v.key)} className="comm-btn" style={{
                    background:CC.e50, border:`1px solid ${CC.e100}`, borderRadius:6,
                    padding:"3px 8px", fontSize:10, color:CC.e700,
                    cursor:"pointer", fontFamily:"monospace", fontWeight:600,
                  }}>{v.key}</button>
                ))}
              </div>
            </div>
          </div>

          {error && <div style={{ background:CC.dangerBg, border:"1px solid #FECACA", borderRadius:12,
            padding:"10px 14px", fontSize:13, color:CC.danger, marginBottom:12,
            display:"flex", gap:8 }}><span>⚠️</span>{error}</div>}

          <button onClick={save} disabled={saving} style={{
            width:"100%", padding:"14px",
            background:saving?`${CC.e600}70`:`linear-gradient(135deg,${CC.e600},${CC.e800})`,
            color:"#fff", border:"none", borderRadius:14, fontSize:14, fontWeight:800,
            cursor:saving?"not-allowed":"pointer", fontFamily:"inherit",
            boxShadow:saving?"none":`0 4px 14px ${CC.e600}40`,
          }}>{saving?"جاري الحفظ...":"💾 حفظ القالب"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TEMPLATES LIBRARY — logic unchanged
// ═══════════════════════════════════════════════════════
function TemplatesLibrary({ user, isAdmin, onUseTemplate }) {
  const [templates,  setTemplates]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [formTarget, setFormTarget] = useState(null);
  const [filterCat,  setFilterCat]  = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchTemplates();
    setTemplates(data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filterCat === "all")      return templates.filter(t=>t.status==="active");
    if (filterCat === "archived") return templates.filter(t=>t.status==="archived");
    return templates.filter(t=>t.status==="active" && t.category===filterCat);
  }, [templates, filterCat]);

  async function handleArchive(t)   { await archiveTemplate(t.id, user); load(); }
  async function handleDuplicate(t) { await duplicateTemplate(t, user);  load(); }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
        <div>
          <p style={{ margin:0, fontSize:14, fontWeight:800, color:CC.s900 }}>قوالب الرسائل</p>
          <p style={{ margin:"2px 0 0", fontSize:12, color:CC.s500 }}>{filtered.length} قالب</p>
        </div>
        {isAdmin && (
          <button onClick={()=>setFormTarget({})} className="comm-btn" style={{
            background:`linear-gradient(135deg,${CC.e600},${CC.e800})`,
            color:"#fff", border:"none", borderRadius:10, padding:"8px 14px",
            fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            boxShadow:`0 3px 10px ${CC.e600}35`,
          }}>＋ قالب جديد</button>
        )}
      </div>

      <div style={{ display:"flex", gap:5, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
        {[{id:"all",label:"الكل",icon:"📋"},{id:"archived",label:"المؤرشفة",icon:"📦"},
          ...Object.values(TEMPLATE_CATEGORIES)].map(cat => (
          <FilterChip key={cat.id} label={`${cat.icon} ${cat.label}`}
            active={filterCat===cat.id} onClick={()=>setFilterCat(cat.id)}/>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"30px" }}>
          <div style={{ width:32, height:32, borderRadius:"50%", border:`3px solid ${CC.e100}`,
            borderTopColor:CC.e600, animation:"spin 0.7s linear infinite", margin:"0 auto" }}/>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"36px 20px", background:CC.white,
          borderRadius:16, border:`1px solid ${CC.s200}` }}>
          <div style={{ fontSize:36, marginBottom:8 }}>📋</div>
          <p style={{ margin:0, color:CC.s500, fontSize:13 }}>لا توجد قوالب في هذه الفئة</p>
        </div>
      ) : (
        <div className="comm-tmpl-grid">
          {filtered.map((t, idx) => (
            <div key={t.id} className="comm-card comm-in" style={{
              background:CC.white, borderRadius:16, border:`1px solid ${CC.s200}`,
              overflow:"hidden", opacity:t.status==="archived"?0.7:1,
              boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
              animationDelay:`${idx*0.04}s`,
              borderRight:`3px solid ${CC.e500}`,
              display:"flex", flexDirection:"column",
            }}>
              <div style={{ padding:"14px 16px", flex:1, display:"flex", flexDirection:"column" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:0, fontSize:14, fontWeight:700, color:CC.s900 }}>{t.title}</p>
                    <p style={{ margin:"2px 0 0", fontSize:11, color:CC.s400 }}>
                      {TEMPLATE_CATEGORIES[t.category?.toUpperCase()]?.icon}{" "}
                      {TEMPLATE_CATEGORIES[t.category?.toUpperCase()]?.label || t.category}
                    </p>
                  </div>
                  <StatusBadge status={t.status}/>
                </div>
                <p style={{ margin:"0 0 12px", fontSize:12, color:CC.s500, lineHeight:1.6, flex:1 }}>
                  {t.body.slice(0,100)}{t.body.length>100?"...":""}
                </p>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:"auto" }}>
                  {t.status==="active" && onUseTemplate && (
                    <button onClick={()=>onUseTemplate(t)} className="comm-btn" style={{
                      background:`linear-gradient(135deg,${CC.e600},${CC.e800})`,
                      color:"#fff", border:"none", borderRadius:9, padding:"7px 14px",
                      fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                    }}>📨 استخدام</button>
                  )}
                  {isAdmin && t.status==="active" && (
                    <button onClick={()=>setFormTarget(t)} className="comm-btn" style={{
                      background:CC.s100, color:CC.s700, border:"none", borderRadius:9,
                      padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                    }}>✏️ تعديل</button>
                  )}
                  {isAdmin && (
                    <button onClick={()=>handleDuplicate(t)} className="comm-btn" style={{
                      background:CC.s100, color:CC.s700, border:"none", borderRadius:9,
                      padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                    }}>📄 نسخ</button>
                  )}
                  {isAdmin && t.status==="active" && (
                    <button onClick={()=>handleArchive(t)} className="comm-btn" style={{
                      background:CC.dangerBg, color:CC.danger, border:"none", borderRadius:9,
                      padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                    }}>📦 أرشفة</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formTarget && (
        <TemplateForm existing={formTarget.id?formTarget:null} user={user}
          onSaved={()=>{ setFormTarget(null); load(); }} onCancel={()=>setFormTarget(null)}/>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SEND MESSAGE PANEL — logic unchanged
// Phase 3 adds a two-column desktop layout (≥1280px): the
// survey/recipients/message steps on the left, a live summary +
// send action pinned in a sidebar card on the right — purely CSS
// grid, no extra state.
// ═══════════════════════════════════════════════════════
function SendMessagePanel({ surveys, user, isAdmin }) {
  // ── All state & logic unchanged ──
  const [selectedSurvey,   setSelectedSurvey]   = useState(null);
  const [allSchools,       setAllSchools]        = useState([]);
  const [nonRespondents,   setNonRespondents]    = useState([]);
  const [recipients,       setRecipients]        = useState([]);
  const [loadingSchools,   setLoadingSchools]    = useState(false);
  const [messageBody,      setMessageBody]       = useState("");
  const [templates,        setTemplates]         = useState([]);
  const [selectedTemplate, setSelectedTemplate]  = useState(null);
  const [sending,          setSending]           = useState(false);
  const [result,           setResult]            = useState(null);
  const [error,            setError]             = useState("");
  const [stageFilter,   setStageFilter]   = useState("الكل");
  const [sectorFilter,  setSectorFilter]  = useState("الكل");

  useEffect(() => {
    async function loadSchools() {
      setLoadingSchools(true);
      let all=[], from=0;
      while(true) {
        const{data}=await supabase.from("survey_schools").select("id,name,stage,sector,district,principal,phone").range(from,from+999);
        if(!data?.length) break;
        all=all.concat(data); if(data.length<1000) break; from+=1000;
      }
      setAllSchools(all); setLoadingSchools(false);
    }
    loadSchools();
    fetchTemplates().then(({data})=>setTemplates(data.filter(t=>t.status==="active")));
  }, []);

  useEffect(() => {
    if (!selectedSurvey || !allSchools.length) return;
    fetchNonRespondents(selectedSurvey, allSchools).then(nr => {
      setNonRespondents(nr);
      setRecipients(nr);
    });
  }, [selectedSurvey, allSchools]);

  const filteredRecipients = useMemo(() => {
    let list = nonRespondents;
    if (stageFilter  !== "الكل") list = list.filter(s=>s.stage===stageFilter);
    if (sectorFilter !== "الكل") list = list.filter(s=>s.sector===sectorFilter);
    return list;
  }, [nonRespondents, stageFilter, sectorFilter]);

  const stages  = useMemo(()=>[...new Set(nonRespondents.map(s=>s.stage).filter(Boolean))].sort(),  [nonRespondents]);
  const sectors = useMemo(()=>[...new Set(nonRespondents.map(s=>s.sector).filter(Boolean))].sort(), [nonRespondents]);

  function applyTemplate(template) {
    if (!selectedSurvey) return;
    const vars = buildTemplateVariables(selectedSurvey);
    setMessageBody(resolveTemplate(template.body, vars));
    setSelectedTemplate(template);
  }

  async function handleSend() {
    if (!selectedSurvey)    { setError("اختر استبياناً أولاً"); return; }
    if (!recipients.length) { setError("لا يوجد مستلمون محددون"); return; }
    if (!messageBody.trim()){ setError("اكتب نص الرسالة"); return; }
    setSending(true); setError(""); setResult(null);
    const res = await sendCommunication({
      survey: selectedSurvey, recipients: recipients.filter(r=>r.phone),
      messageBody: messageBody.trim(), channel: NOTIFICATION_CHANNELS.WHATSAPP,
      user, templateId: selectedTemplate?.id || null,
    });
    setSending(false); setResult(res);
  }
  // ── End unchanged logic ──

  const phoneCount = recipients.filter(r=>r.phone).length;
  const canSend = !sending && messageBody.trim() && recipients.length;

  // Shared "send" action — rendered inline on mobile, in the sidebar on desktop
  const sendAction = (
    <>
      {error && <div style={{ background:CC.dangerBg, border:"1px solid #FECACA", borderRadius:12,
        padding:"10px 14px", fontSize:13, color:CC.danger, marginBottom:12,
        display:"flex", gap:8 }}><span>⚠️</span>{error}</div>}

      {result && (
        <div style={{ background:result.sent>0?CC.successBg:CC.dangerBg,
          border:`1px solid ${result.sent>0?CC.success+"40":"#FECACA"}`,
          borderRadius:14, padding:16, marginBottom:14 }}>
          <p style={{ margin:"0 0 4px", fontSize:14, fontWeight:800,
            color:result.sent>0?CC.success:CC.danger }}>
            {result.sent>0 ? "✅ تم الإرسال بنجاح" : "❌ فشل الإرسال"}
          </p>
          <p style={{ margin:0, fontSize:12, color:CC.s500 }}>
            أُرسل: {result.sent} · فشل: {result.failed} · تجاوز: {result.skipped}
          </p>
        </div>
      )}

      {selectedSurvey && (
        <button onClick={handleSend} disabled={!canSend}
          style={{
            width:"100%", padding:"14px",
            background: canSend ? `linear-gradient(135deg,${CC.e600},${CC.e800})` : `${CC.e600}50`,
            color:"#fff", border:"none", borderRadius:14, fontSize:14, fontWeight:800,
            cursor: canSend ? "pointer" : "not-allowed",
            fontFamily:"inherit",
            boxShadow: canSend ? `0 4px 16px ${CC.e600}40` : "none",
            display:"flex", alignItems:"center", justifyContent:"center", gap:10,
          }}>
          {sending ? (
            <><div style={{ width:18, height:18, borderRadius:"50%",
              border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff",
              animation:"spin 0.7s linear infinite" }}/>جاري الإرسال...</>
          ) : `📱 إرسال لـ ${phoneCount} مدرسة`}
        </button>
      )}
    </>
  );

  return (
    <div className="comm-send-layout">
      {/* Left / main column */}
      <div>
        <SectionCard title="اختر الاستبيان" step="1">
          <select value={selectedSurvey?.id||""} onChange={e=>{
            const s=surveys.find(sv=>sv.id===e.target.value)||null;
            setSelectedSurvey(s); setResult(null); setStageFilter("الكل"); setSectorFilter("الكل");
          }} style={{ ...iSt, background:CC.white }}>
            <option value="">— اختر استبياناً —</option>
            {surveys.filter(s=>s.approval_status==="approved").map(s=>(
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </SectionCard>

        {selectedSurvey && (
          <SectionCard step="2" title={
            `المستلمون غير المستجيبين · ${filteredRecipients.length} بجوال من ${nonRespondents.length}`
          }>
            {loadingSchools ? (
              <div style={{ textAlign:"center", padding:16 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", border:`3px solid ${CC.e100}`,
                  borderTopColor:CC.e600, animation:"spin 0.7s linear infinite", margin:"0 auto" }}/>
              </div>
            ) : (
              <>
                {stages.length > 0 && (
                  <div style={{ marginBottom:10 }}>
                    <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:CC.s500 }}>المرحلة:</p>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {["الكل",...stages].map(s=>(
                        <FilterChip key={s} label={s} active={stageFilter===s}
                          onClick={()=>{ setStageFilter(s); setRecipients([]); }}/>
                      ))}
                    </div>
                  </div>
                )}
                {sectors.length > 0 && (
                  <div style={{ marginBottom:10 }}>
                    <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:CC.s500 }}>القطاع:</p>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {["الكل",...sectors].map(s=>(
                        <FilterChip key={s} label={s} active={sectorFilter===s}
                          color={CC.purple} onClick={()=>{ setSectorFilter(s); setRecipients([]); }}/>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  <button onClick={()=>setRecipients(filteredRecipients)} className="comm-btn" style={{
                    background:CC.e50, color:CC.e700, border:`1px solid ${CC.e100}`,
                    borderRadius:10, padding:"8px 14px", fontSize:12, fontWeight:700,
                    cursor:"pointer", fontFamily:"inherit",
                  }}>✓ تحديد الكل ({filteredRecipients.length})</button>
                  <button onClick={()=>setRecipients([])} className="comm-btn" style={{
                    background:CC.s100, color:CC.s700, border:"none",
                    borderRadius:10, padding:"8px 14px", fontSize:12, fontWeight:600,
                    cursor:"pointer", fontFamily:"inherit",
                  }}>إلغاء الكل</button>
                </div>
                <div style={{ background:CC.e50, borderRadius:10, padding:"10px 14px",
                  border:`1px solid ${CC.e100}` }}>
                  <p style={{ margin:0, fontSize:12, color:CC.e700, fontWeight:700 }}>
                    📱 سيتم الإرسال لـ <strong>{phoneCount}</strong> مدرسة لديها رقم جوال
                  </p>
                </div>
              </>
            )}
          </SectionCard>
        )}

        {selectedSurvey && (
          <SectionCard step="3" title="اختر قالباً أو اكتب رسالة">
            {templates.length > 0 && (
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
                {templates.map(t=>(
                  <button key={t.id} onClick={()=>applyTemplate(t)} className="comm-chip" style={{
                    padding:"6px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit",
                    cursor:"pointer",
                    border:`1.5px solid ${selectedTemplate?.id===t.id?CC.e600:CC.s200}`,
                    background:selectedTemplate?.id===t.id?CC.e50:CC.white,
                    color:selectedTemplate?.id===t.id?CC.e700:CC.s500,
                    fontWeight:selectedTemplate?.id===t.id?700:400,
                  }}>
                    {TEMPLATE_CATEGORIES[t.category?.toUpperCase()]?.icon||"📋"} {t.title}
                  </button>
                ))}
              </div>
            )}
            <textarea value={messageBody} onChange={e=>setMessageBody(e.target.value)} rows={6}
              placeholder="اكتب نص الرسالة هنا..."
              style={{ ...iSt, resize:"vertical" }}
              onFocus={e=>{e.target.style.borderColor=CC.e600;e.target.style.boxShadow=`0 0 0 3px rgba(5,150,105,0.12)`;}}
              onBlur={e=>{e.target.style.borderColor=CC.s200;e.target.style.boxShadow="none";}}/>
          </SectionCard>
        )}

        {/* On mobile/tablet the send action sits inline after step 3 */}
        <div className="comm-send-mobile-action" style={{ display:"block" }}>
          {sendAction}
        </div>
      </div>

      {/* Right sidebar — desktop only (≥1280px), shows a live summary + same send action */}
      <div style={{ display: "none" }} className="comm-send-sidebar">
        <div style={{ position:"sticky", top:80 }}>
          <SectionCard title="ملخص الإرسال">
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:CC.s500 }}>الاستبيان</span>
                <span style={{ fontSize:12, fontWeight:700, color:CC.s900, maxWidth:180, textAlign:"left", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {selectedSurvey?.title || "—"}
                </span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:CC.s500 }}>المستلمون</span>
                <span style={{ fontSize:12, fontWeight:700, color:CC.e700 }}>{phoneCount}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:CC.s500 }}>طول الرسالة</span>
                <span style={{ fontSize:12, fontWeight:700, color:CC.s900 }}>{messageBody.length} حرف</span>
              </div>
            </div>
            {sendAction}
          </SectionCard>
        </div>
      </div>

      <style>{`
        @media (min-width: 1280px) {
          .comm-send-sidebar { display: block !important; }
          .comm-send-mobile-action { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COMMUNICATION HISTORY — logic unchanged
// ═══════════════════════════════════════════════════════
function CommunicationHistory({ surveys }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    setLoading(true);
    fetchCommunicationLog({ limit:200 }).then(({data})=>{ setLogs(data); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      (l.surveys?.title||"").toLowerCase().includes(q) ||
      (l.sent_by_email||"").toLowerCase().includes(q)
    );
  }, [logs, search]);

  const CHANNEL_LABELS = {
    whatsapp:"📱 واتساب", email:"📧 بريد", sms:"💬 رسالة نصية", in_app:"🔔 إشعار"
  };

  return (
    <div>
      <div style={{ position:"relative", marginBottom:16 }}>
        <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}>🔍</span>
        <input className="comm-search" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="ابحث بعنوان الاستبيان أو المرسل..."
          style={{ ...iSt, padding:"10px 40px 10px 14px", background:CC.s50 }}/>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"30px" }}>
          <div style={{ width:32, height:32, borderRadius:"50%", border:`3px solid ${CC.e100}`,
            borderTopColor:CC.e600, animation:"spin 0.7s linear infinite", margin:"0 auto" }}/>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"36px 20px", background:CC.white,
          borderRadius:16, border:`1px solid ${CC.s200}` }}>
          <div style={{ fontSize:36, marginBottom:8 }}>📜</div>
          <p style={{ margin:0, color:CC.s500, fontSize:13 }}>لا يوجد سجل اتصالات بعد</p>
        </div>
      ) : (
        <div style={{ background:CC.white, borderRadius:16, border:`1px solid ${CC.s200}`,
          overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
          {filtered.map((l, i) => (
            <div key={l.id} style={{ padding:"13px 16px",
              borderBottom:i<filtered.length-1?`1px solid ${CC.s100}`:"none",
              transition:"background 0.1s" }}
              onMouseEnter={e=>e.currentTarget.style.background=CC.s50}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4, gap:10 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:CC.s900, flex:1 }}>
                  {l.surveys?.title || "استبيان محذوف"}
                </p>
                <StatusBadge status={l.status}/>
              </div>
              <p style={{ margin:"3px 0 2px", fontSize:11, color:CC.s500 }}>
                {CHANNEL_LABELS[l.delivery_method]||l.delivery_method} ·{" "}
                {l.recipient_count} مستلم ·{" "}
                {l.sent_by_email||"غير معروف"}
              </p>
              <p style={{ margin:0, fontSize:10, color:CC.s400 }}>
                {new Date(l.sent_at).toLocaleString("ar-SA")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN — Phase 3 enterprise tab bar, logic unchanged
// ═══════════════════════════════════════════════════════
export default function CommunicationCenter({ surveys, user, isAdmin }) {
  const [activeTab, setActiveTab] = useState("send");

  const TABS = [
    { id:"send",      label:"إرسال",  icon:"📨" },
    { id:"templates", label:"القوالب", icon:"📋" },
    { id:"history",   label:"السجل",  icon:"📜" },
  ];

  return (
    <div style={{ direction:"rtl" }}>
      {/* Header */}
      <div style={{ marginBottom:18 }}>
        <h1 style={{ margin:0, fontSize:22, color:CC.s900, fontWeight:800, letterSpacing:"-0.02em" }}>مركز الاتصالات</h1>
        <p style={{ margin:"4px 0 0", fontSize:13, color:CC.s500 }}>إدارة الرسائل والتذكيرات</p>
      </div>

      {/* Pill tab bar — matches Dashboard/SurveysList/Directory/Templates */}
      <div style={{
        display: "inline-flex", background: CC.white, borderRadius: 12,
        padding: 4, marginBottom: 20, border: `1px solid ${CC.s200}`, gap: 2,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        {TABS.map(tab => {
          const isActive = activeTab===tab.id;
          return (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
              padding: "8px 16px", border: "none", borderRadius: 9,
              background: isActive ? CC.e50 : "transparent",
              cursor: "pointer", fontSize: 12, fontFamily: "inherit",
              fontWeight: isActive ? 700 : 500,
              color: isActive ? CC.e700 : CC.s500,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{tab.icon}</span>{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab==="send"      && <SendMessagePanel surveys={surveys} user={user} isAdmin={isAdmin}/>}
      {activeTab==="templates" && <TemplatesLibrary user={user} isAdmin={isAdmin} onUseTemplate={null}/>}
      {activeTab==="history"   && <CommunicationHistory surveys={surveys}/>}
    </div>
  );
}

