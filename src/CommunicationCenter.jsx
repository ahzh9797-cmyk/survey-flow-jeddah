/**
 * CommunicationCenter — مركز الاتصالات
 * Module B1
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

// ═══════════════════════════════════════════════════════
// مكوّنات مشتركة
// ═══════════════════════════════════════════════════════

function StatusBadge({ status }) {
  const cfg = {
    sent:    { label:"✅ تم الإرسال",     color:C.success },
    partial: { label:"⚠️ جزئي",           color:C.warn },
    failed:  { label:"❌ فشل",            color:C.danger },
    active:  { label:"✅ نشط",            color:C.success },
    archived:{ label:"📦 مؤرشف",          color:C.muted },
  }[status] || { label:status, color:C.muted };

  return (
    <span style={{ background:`${cfg.color}15`, color:cfg.color,
      border:`1px solid ${cfg.color}40`, borderRadius:20,
      padding:"2px 10px", fontSize:11, fontWeight:700 }}>
      {cfg.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════
// نموذج القالب
// ═══════════════════════════════════════════════════════
function TemplateForm({ existing, user, onSaved, onCancel }) {
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

  const inputStyle = { width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`,
    borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl",
    boxSizing:"border-box", outline:"none" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200,
      display:"flex", alignItems:"flex-end", direction:"rtl" }}
      onClick={e=>{ if(e.target===e.currentTarget) onCancel(); }}>
      <div style={{ width:"100%", background:C.white, borderRadius:"20px 20px 0 0",
        maxHeight:"90vh", overflowY:"auto", paddingBottom:32 }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0" }}>
          <div style={{ width:40, height:4, background:C.border, borderRadius:4 }}/>
        </div>
        <div style={{ padding:"0 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:17, color:C.dark, fontWeight:800 }}>
              {isEdit ? "تعديل القالب" : "قالب جديد"}
            </h3>
            <button onClick={onCancel} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.muted }}>✕</button>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>
              اسم القالب <span style={{color:C.danger}}>*</span>
            </label>
            <input value={title} onChange={e=>setTitle(e.target.value)} style={inputStyle}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>الفئة</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {Object.values(TEMPLATE_CATEGORIES).map(cat => (
                <button key={cat.id} onClick={()=>setCategory(cat.id)} style={{
                  padding:"7px 14px", borderRadius:20, fontSize:12, fontFamily:"inherit", cursor:"pointer",
                  border:`1.5px solid ${category===cat.id ? C.primary : C.border}`,
                  background:category===cat.id ? C.primaryBg : "#fff",
                  color:category===cat.id ? C.primary : C.muted,
                  fontWeight:category===cat.id ? 700 : 400 }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>
              موضوع الرسالة
            </label>
            <input value={subject} onChange={e=>setSubject(e.target.value)}
              placeholder="يُستخدم في البريد الإلكتروني مستقبلاً" style={inputStyle}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>
              نص الرسالة <span style={{color:C.danger}}>*</span>
            </label>
            <textarea value={body} onChange={e=>setBody(e.target.value)} rows={8}
              placeholder="اكتب نص الرسالة..."
              style={{ ...inputStyle, resize:"vertical" }}/>
            <div style={{ background:C.bg, borderRadius:8, padding:"8px 12px", marginTop:6 }}>
              <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:700, color:C.muted }}>المتغيرات المتاحة:</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                {TEMPLATE_VARIABLES.map(v => (
                  <button key={v.key} onClick={()=>setBody(b=>b+v.key)}
                    style={{ background:C.primaryBg, border:`1px solid ${C.primary}30`,
                      borderRadius:6, padding:"3px 8px", fontSize:10, color:C.primary,
                      cursor:"pointer", fontFamily:"monospace" }}>
                    {v.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ErrorBanner message={error}/>
          <Btn full loading={saving} onClick={save}>💾 حفظ القالب</Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// مكتبة القوالب
// ═══════════════════════════════════════════════════════
function TemplatesLibrary({ user, isAdmin, onUseTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [formTarget, setFormTarget] = useState(null);
  const [filterCat,  setFilterCat] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchTemplates();
    setTemplates(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filterCat === "all") return templates.filter(t=>t.status==="active");
    if (filterCat === "archived") return templates.filter(t=>t.status==="archived");
    return templates.filter(t=>t.status==="active" && t.category===filterCat);
  }, [templates, filterCat]);

  async function handleArchive(t) {
    await archiveTemplate(t.id, user);
    load();
  }

  async function handleDuplicate(t) {
    await duplicateTemplate(t, user);
    load();
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:15, color:C.dark, fontWeight:800 }}>قوالب الرسائل</h3>
        {isAdmin && <Btn sm onClick={()=>setFormTarget({})}>＋ قالب جديد</Btn>}
      </div>

      {/* فلاتر الفئات */}
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        {[{id:"all",label:"الكل",icon:"📋"},{id:"archived",label:"المؤرشفة",icon:"📦"},
          ...Object.values(TEMPLATE_CATEGORIES)].map(cat => (
          <button key={cat.id} onClick={()=>setFilterCat(cat.id)} style={{
            padding:"6px 12px", borderRadius:20, fontSize:12, fontFamily:"inherit",
            cursor:"pointer", whiteSpace:"nowrap",
            border:`1.5px solid ${filterCat===cat.id ? C.primary : C.border}`,
            background:filterCat===cat.id ? C.primaryBg : "#fff",
            color:filterCat===cat.id ? C.primary : C.muted,
            fontWeight:filterCat===cat.id ? 700 : 400 }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign:"center", padding:30 }}><Spinner/></div>
      : filtered.length === 0 ? (
        <Card style={{ textAlign:"center", padding:24 }}>
          <p style={{ margin:0, color:C.muted, fontSize:13 }}>لا توجد قوالب في هذه الفئة</p>
        </Card>
      ) : filtered.map(t => (
        <Card key={t.id} style={{ marginBottom:10, opacity:t.status==="archived"?0.7:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ flex:1 }}>
              <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark }}>{t.title}</p>
              <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>
                {TEMPLATE_CATEGORIES[t.category?.toUpperCase()]?.icon} {TEMPLATE_CATEGORIES[t.category?.toUpperCase()]?.label || t.category}
              </p>
            </div>
            <StatusBadge status={t.status}/>
          </div>
          <p style={{ margin:"0 0 12px", fontSize:12, color:C.muted, lineHeight:1.6 }}>
            {t.body.slice(0,100)}{t.body.length>100?"...":""}
          </p>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {t.status==="active" && onUseTemplate && (
              <Btn sm onClick={()=>onUseTemplate(t)}>📨 استخدام</Btn>
            )}
            {isAdmin && t.status==="active" && (
              <Btn sm variant="secondary" onClick={()=>setFormTarget(t)}>✏️ تعديل</Btn>
            )}
            {isAdmin && (
              <Btn sm variant="secondary" onClick={()=>handleDuplicate(t)}>📄 نسخ</Btn>
            )}
            {isAdmin && t.status==="active" && (
              <Btn sm variant="danger" onClick={()=>handleArchive(t)}>📦 أرشفة</Btn>
            )}
          </div>
        </Card>
      ))}

      {formTarget && (
        <TemplateForm
          existing={formTarget.id ? formTarget : null}
          user={user}
          onSaved={()=>{ setFormTarget(null); load(); }}
          onCancel={()=>setFormTarget(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// إرسال رسالة
// ═══════════════════════════════════════════════════════
function SendMessagePanel({ surveys, user, isAdmin }) {
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

  // فلاتر المستلمين
  const [stageFilter,   setStageFilter]   = useState("الكل");
  const [sectorFilter,  setSectorFilter]  = useState("الكل");

  // جلب المدارس والقوالب
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

  // جلب غير المستجيبين عند اختيار استبيان
  useEffect(() => {
    if (!selectedSurvey || !allSchools.length) return;
    fetchNonRespondents(selectedSurvey, allSchools).then(nr => {
      setNonRespondents(nr);
      setRecipients(nr); // افتراضي: كل غير المستجيبين
    });
  }, [selectedSurvey, allSchools]);

  // تطبيق فلاتر المستلمين
  const filteredRecipients = useMemo(() => {
    let list = nonRespondents;
    if (stageFilter  !== "الكل") list = list.filter(s=>s.stage===stageFilter);
    if (sectorFilter !== "الكل") list = list.filter(s=>s.sector===sectorFilter);
    return list;
  }, [nonRespondents, stageFilter, sectorFilter]);

  const stages  = useMemo(()=>[...new Set(nonRespondents.map(s=>s.stage).filter(Boolean))].sort(), [nonRespondents]);
  const sectors = useMemo(()=>[...new Set(nonRespondents.map(s=>s.sector).filter(Boolean))].sort(), [nonRespondents]);

  // استخدام قالب
  function applyTemplate(template) {
    if (!selectedSurvey) return;
    const vars = buildTemplateVariables(selectedSurvey);
    setMessageBody(resolveTemplate(template.body, vars));
    setSelectedTemplate(template);
  }

  async function handleSend() {
    if (!selectedSurvey) { setError("اختر استبياناً أولاً"); return; }
    if (!recipients.length) { setError("لا يوجد مستلمون محددون"); return; }
    if (!messageBody.trim()) { setError("اكتب نص الرسالة"); return; }

    setSending(true); setError(""); setResult(null);
    const res = await sendCommunication({
      survey:       selectedSurvey,
      recipients:   recipients.filter(r=>r.phone),
      messageBody:  messageBody.trim(),
      channel:      NOTIFICATION_CHANNELS.WHATSAPP,
      user,
      templateId:   selectedTemplate?.id || null,
    });
    setSending(false);
    setResult(res);
  }

  const inputStyle = { width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`,
    borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl",
    boxSizing:"border-box", outline:"none" };

  return (
    <div>
      {/* اختيار الاستبيان */}
      <Card style={{ marginBottom:14 }}>
        <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.dark }}>1. اختر الاستبيان</p>
        <select value={selectedSurvey?.id||""} onChange={e=>{
          const s=surveys.find(sv=>sv.id===e.target.value)||null;
          setSelectedSurvey(s); setResult(null); setStageFilter("الكل"); setSectorFilter("الكل");
        }} style={{ ...inputStyle, background:C.white }}>
          <option value="">— اختر استبياناً —</option>
          {surveys.filter(s=>s.approval_status==="approved").map(s=>(
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </Card>

      {/* المستلمون */}
      {selectedSurvey && (
        <Card style={{ marginBottom:14 }}>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.dark }}>
            2. المستلمون غير المستجيبين
            <span style={{ fontSize:12, fontWeight:400, color:C.muted, marginRight:6 }}>
              ({filteredRecipients.length} بجوال من {nonRespondents.length})
            </span>
          </p>

          {loadingSchools ? <div style={{ textAlign:"center", padding:16 }}><Spinner/></div> : (
            <>
              {/* فلاتر */}
              {stages.length > 0 && (
                <div style={{ marginBottom:10 }}>
                  <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:C.muted }}>المرحلة:</p>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {["الكل",...stages].map(s=>(
                      <button key={s} onClick={()=>{ setStageFilter(s); setRecipients([]); }}
                        style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit",
                          cursor:"pointer", border:`1.5px solid ${stageFilter===s?C.primary:C.border}`,
                          background:stageFilter===s?C.primaryBg:"#fff",
                          color:stageFilter===s?C.primary:C.muted, fontWeight:stageFilter===s?700:400 }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {sectors.length > 0 && (
                <div style={{ marginBottom:10 }}>
                  <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:C.muted }}>القطاع:</p>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {["الكل",...sectors].map(s=>(
                      <button key={s} onClick={()=>{ setSectorFilter(s); setRecipients([]); }}
                        style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit",
                          cursor:"pointer", border:`1.5px solid ${sectorFilter===s?"#7B2D8B":C.border}`,
                          background:sectorFilter===s?"#f5eefa":"#fff",
                          color:sectorFilter===s?"#7B2D8B":C.muted, fontWeight:sectorFilter===s?700:400 }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* أزرار التحديد */}
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                <Btn sm onClick={()=>setRecipients(filteredRecipients)}>
                  ✓ تحديد الكل ({filteredRecipients.length})
                </Btn>
                <Btn sm variant="secondary" onClick={()=>setRecipients([])}>إلغاء الكل</Btn>
              </div>

              <div style={{ background:C.primaryBg, borderRadius:8, padding:"8px 12px" }}>
                <p style={{ margin:0, fontSize:12, color:C.primary, fontWeight:700 }}>
                  📱 سيتم الإرسال لـ <strong>{recipients.filter(r=>r.phone).length}</strong> مدرسة لديها رقم جوال
                </p>
              </div>
            </>
          )}
        </Card>
      )}

      {/* القوالب */}
      {selectedSurvey && (
        <Card style={{ marginBottom:14 }}>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.dark }}>3. اختر قالباً أو اكتب رسالة</p>
          {templates.length > 0 && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              {templates.map(t=>(
                <button key={t.id} onClick={()=>applyTemplate(t)}
                  style={{ padding:"6px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit",
                    cursor:"pointer", border:`1.5px solid ${selectedTemplate?.id===t.id?C.primary:C.border}`,
                    background:selectedTemplate?.id===t.id?C.primaryBg:"#fff",
                    color:selectedTemplate?.id===t.id?C.primary:C.muted }}>
                  {TEMPLATE_CATEGORIES[t.category?.toUpperCase()]?.icon||"📋"} {t.title}
                </button>
              ))}
            </div>
          )}
          <textarea value={messageBody} onChange={e=>setMessageBody(e.target.value)} rows={6}
            placeholder="اكتب نص الرسالة هنا..."
            style={{ ...inputStyle, resize:"vertical" }}/>
        </Card>
      )}

      <ErrorBanner message={error}/>

      {result && (
        <Card style={{ marginBottom:14, background:result.sent>0?C.successBg:"#FFF5F5" }}>
          <p style={{ margin:"0 0 4px", fontSize:14, fontWeight:700,
            color:result.sent>0?C.success:C.danger }}>
            {result.sent>0 ? "✅ تم الإرسال" : "❌ فشل الإرسال"}
          </p>
          <p style={{ margin:0, fontSize:12, color:C.muted }}>
            أُرسل: {result.sent} · فشل: {result.failed} · تجاوز: {result.skipped}
          </p>
        </Card>
      )}

      {selectedSurvey && (
        <Btn full loading={sending} disabled={!messageBody.trim()||!recipients.length} onClick={handleSend}>
          📱 إرسال لـ {recipients.filter(r=>r.phone).length} مدرسة
        </Btn>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// سجل الاتصالات
// ═══════════════════════════════════════════════════════
function CommunicationHistory({ surveys }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    setLoading(true);
    fetchCommunicationLog({ limit:200 }).then(({data})=>{
      setLogs(data); setLoading(false);
    });
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
      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="🔍 ابحث بعنوان الاستبيان أو المرسل..."
        style={{ width:"100%", padding:"10px 14px", border:`1.5px solid ${C.border}`, borderRadius:10,
          fontSize:13, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box",
          outline:"none", marginBottom:14 }}/>

      {loading ? <div style={{ textAlign:"center", padding:30 }}><Spinner/></div>
      : filtered.length===0 ? (
        <Card style={{ textAlign:"center", padding:24 }}>
          <p style={{ margin:0, color:C.muted, fontSize:13 }}>لا يوجد سجل اتصالات بعد</p>
        </Card>
      ) : (
        <Card style={{ padding:0, overflow:"hidden" }}>
          {filtered.map((l,i) => (
            <div key={l.id} style={{ padding:"12px 14px",
              borderBottom:i<filtered.length-1?`1px solid ${C.border}`:undefined }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.dark }}>
                  {l.surveys?.title || "استبيان محذوف"}
                </p>
                <StatusBadge status={l.status}/>
              </div>
              <p style={{ margin:"2px 0", fontSize:12, color:C.muted }}>
                {CHANNEL_LABELS[l.delivery_method]||l.delivery_method} ·
                {l.recipient_count} مستلم ·
                {l.sent_by_email||"غير معروف"}
              </p>
              <p style={{ margin:0, fontSize:11, color:C.muted }}>
                {new Date(l.sent_at).toLocaleString("ar-SA")}
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// الصفحة الرئيسية
// ═══════════════════════════════════════════════════════
export default function CommunicationCenter({ surveys, user, isAdmin }) {
  const [activeTab, setActiveTab] = useState("send");

  const TABS = [
    { id:"send",      label:"📨 إرسال",     component:<SendMessagePanel surveys={surveys} user={user} isAdmin={isAdmin}/> },
    { id:"templates", label:"📋 القوالب",   component:<TemplatesLibrary user={user} isAdmin={isAdmin} onUseTemplate={null}/> },
    { id:"history",   label:"📜 السجل",     component:<CommunicationHistory surveys={surveys}/> },
  ];

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      <h2 style={{ margin:"0 0 4px", fontSize:18, color:C.dark, fontWeight:800 }}>مركز الاتصالات</h2>
      <p style={{ margin:"0 0 16px", fontSize:12, color:C.muted }}>إدارة الرسائل والتذكيرات</p>

      <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginBottom:16 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
            flex:1, padding:"10px 4px", border:"none", background:"none", cursor:"pointer",
            fontSize:12, fontFamily:"inherit", fontWeight:activeTab===tab.id?700:400,
            color:activeTab===tab.id?C.primary:C.muted,
            borderBottom:`2px solid ${activeTab===tab.id?C.primary:"transparent"}`,
            marginBottom:-1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {TABS.find(t=>t.id===activeTab)?.component}
    </div>
  );
}

