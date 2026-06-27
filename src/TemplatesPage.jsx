import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ErrorBanner, logAction } from "./lib.jsx";
import { SURVEY_TYPE_LABELS } from "./SurveyService.jsx";
import { genId, deepClone } from "./utils.js";

// ═══════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════
function useTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("survey_templates")
      .select("*, template_categories(name)")
      .order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { templates, loading, refetch: load };
}

function useCategories() {
  const [categories, setCategories] = useState([]);
  const reload = useCallback(async () => {
    const { data } = await supabase.from("template_categories").select("*").order("name");
    setCategories(data || []);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { categories, reload };
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function estimateMinutes(questions) {
  if (!questions?.length) return 1;
  const total = questions.reduce((acc, q) => {
    if (q.type === "textarea") return acc + 2;
    if (q.type === "file")     return acc + 1.5;
    return acc + 0.5;
  }, 0);
  return Math.max(1, Math.ceil(total));
}

const TYPE_LABELS = {
  text: "نص قصير", textarea: "نص طويل", number: "رقم",
  select: "اختيار", rating: "تقييم", file: "ملف",
};

const SCOPE_CONFIG = {
  system:   { label:"🌐 عام",     color: C.success,  bg: C.successBg,  desc:"متاح لجميع المستخدمين" },
  personal: { label:"🔒 شخصي",   color: "#7B2D8B",  bg: "#f5eefa",    desc:"خاص بك فقط" },
};

// ═══════════════════════════════════════════════════════
// PREVIEW SHEET
// ═══════════════════════════════════════════════════════
function TemplatePreviewSheet({ template, onUse, onClose }) {
  const qs = template.questions || [];
  const minutes = estimateMinutes(qs);
  const scope = SCOPE_CONFIG[template.scope] || SCOPE_CONFIG.personal;

  const typeCounts = qs.reduce((acc, q) => {
    const label = TYPE_LABELS[q.type] || q.type;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200,
      display:"flex", alignItems:"flex-end", direction:"rtl" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", background:C.white, borderRadius:"20px 20px 0 0",
        maxHeight:"90vh", overflowY:"auto", paddingBottom:32 }}>

        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0" }}>
          <div style={{ width:40, height:4, background:C.border, borderRadius:4 }}/>
        </div>

        <div style={{ padding:"0 16px" }}>
          {/* رأس */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div style={{ flex:1 }}>
              <h3 style={{ margin:"0 0 4px", fontSize:17, color:C.dark, fontWeight:800 }}>{template.title}</h3>
              {template.description && (
                <p style={{ margin:0, fontSize:13, color:C.muted, lineHeight:1.6 }}>{template.description}</p>
              )}
            </div>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22,
              cursor:"pointer", color:C.muted, flexShrink:0, marginRight:8 }}>✕</button>
          </div>

          {/* بطاقات معلومات */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
            {[
              { i:"🎯", l:"نوع المستهدف", v: SURVEY_TYPE_LABELS[template.survey_type] || "مدارس" },
              { i:"❓", l:"عدد الأسئلة",  v: `${qs.length} سؤال` },
              { i:"⏱️", l:"وقت تقديري",   v: `${minutes} دقيقة` },
              { i:"🗂️", l:"الفئة",         v: template.template_categories?.name || "غير محدد" },
            ].map((x, i) => (
              <div key={i} style={{ background:C.bg, borderRadius:12, padding:12, textAlign:"center" }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{x.i}</div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>{x.l}</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{x.v}</div>
              </div>
            ))}
          </div>

          {/* أنواع الأسئلة */}
          {Object.keys(typeCounts).length > 0 && (
            <div style={{ marginBottom:16 }}>
              <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.dark }}>أنواع الأسئلة</p>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {Object.entries(typeCounts).map(([type, count]) => (
                  <span key={type} style={{ background:C.primaryBg, color:C.primary,
                    borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:600 }}>
                    {type} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* قائمة الأسئلة */}
          {qs.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.dark }}>الأسئلة</p>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {qs.map((q, i) => (
                  <div key={i} style={{ background:C.bg, borderRadius:10, padding:"10px 14px",
                    display:"flex", alignItems:"flex-start", gap:10 }}>
                    <span style={{ color:C.primary, fontWeight:700, fontSize:13, flexShrink:0 }}>{i+1}.</span>
                    <div style={{ flex:1 }}>
                      <p style={{ margin:0, fontSize:13, color:C.dark, lineHeight:1.5 }}>
                        {q.label || "سؤال بدون نص"}
                        {q.required && <span style={{ color:C.danger, marginRight:4 }}>*</span>}
                      </p>
                      <p style={{ margin:"3px 0 0", fontSize:11, color:C.muted }}>
                        {TYPE_LABELS[q.type] || q.type}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* نطاق القالب */}
          <div style={{ background:scope.bg, borderRadius:10, padding:"10px 14px", marginBottom:20 }}>
            <p style={{ margin:0, fontSize:12, color:scope.color, fontWeight:700 }}>
              {scope.label} — {scope.desc}
            </p>
          </div>

          <Btn full onClick={onUse}>✓ استخدام هذا القالب</Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SAVE AS TEMPLATE SHEET
// ═══════════════════════════════════════════════════════
export function SaveAsTemplateSheet({ survey, user, isAdmin, onSaved, onClose }) {
  const { categories } = useCategories();
  const [title, setTitle]         = useState(survey.title || "");
  const [desc, setDesc]           = useState(survey.description || "");
  const [categoryId, setCategoryId] = useState("");
  const [scope, setScope]         = useState("personal");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [done, setDone]           = useState(false);

  async function save() {
    if (!title.trim()) { setError("اسم القالب مطلوب"); return; }
    setSaving(true); setError("");

    const questions = (survey.questions || []).map(q => ({
      ...deepClone(q),
      // حذف الحقول الخاصة بالاستبيان، ليست جزءاً من القالب
      id: undefined,
      survey_id: undefined,
      order_index: undefined,
    }));

    const { error: err } = await supabase.from("survey_templates").insert({
      title:            title.trim(),
      description:      desc.trim() || null,
      category_id:      categoryId || null,
      survey_type:      survey.survey_type || "school",
      scope:            isAdmin ? scope : "personal",
      questions,
      default_settings: {
        response_limit: survey.response_limit || "one_per_entity",
      },
      created_by: user?.id,
    });

    setSaving(false);
    if (err) { setError("فشل الحفظ: " + err.message); return; }
    logAction({ user, action:"create", table:"survey_templates", recordLabel: title });
    setDone(true);
  }

  const inputStyle = { width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`,
    borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl",
    boxSizing:"border-box", outline:"none" };

  if (done) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center", padding:24, direction:"rtl" }}>
      <div style={{ background:C.white, borderRadius:20, padding:32, textAlign:"center", maxWidth:320, width:"100%" }}>
        <div style={{ fontSize:52, marginBottom:12 }}>✅</div>
        <h3 style={{ margin:"0 0 8px", color:C.dark }}>تم حفظ القالب</h3>
        <p style={{ margin:"0 0 20px", fontSize:13, color:C.muted }}>يمكنك الآن استخدامه عند إنشاء استبيانات جديدة</p>
        <Btn full onClick={onSaved}>تم</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200,
      display:"flex", alignItems:"flex-end", direction:"rtl" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", background:C.white, borderRadius:"20px 20px 0 0",
        maxHeight:"85vh", overflowY:"auto", paddingBottom:32 }}>

        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0" }}>
          <div style={{ width:40, height:4, background:C.border, borderRadius:4 }}/>
        </div>

        <div style={{ padding:"0 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <h3 style={{ margin:0, fontSize:17, color:C.dark, fontWeight:800 }}>حفظ كقالب</h3>
            <button onClick={onClose} style={{ background:"none", border:"none",
              fontSize:22, cursor:"pointer", color:C.muted }}>✕</button>
          </div>

          <div style={{ background:C.primaryBg, borderRadius:10, padding:"10px 14px", marginBottom:16 }}>
            <p style={{ margin:0, fontSize:12, color:C.primary, lineHeight:1.7 }}>
              سيتم نسخ <strong>الأسئلة والإعدادات فقط</strong> — لن تُنسخ الردود أو الإحصائيات.
            </p>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>
              اسم القالب <span style={{ color:C.danger }}>*</span>
            </label>
            <input value={title} onChange={e=>setTitle(e.target.value)} style={inputStyle}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>وصف</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2}
              style={{ ...inputStyle, resize:"vertical" }}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>الفئة</label>
            <select value={categoryId} onChange={e=>setCategoryId(e.target.value)}
              style={{ ...inputStyle, background:C.white }}>
              <option value="">— اختر فئة —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {isAdmin && (
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>نطاق القالب</label>
              <div style={{ display:"flex", gap:8 }}>
                {Object.entries(SCOPE_CONFIG).map(([v, cfg]) => (
                  <button key={v} onClick={()=>setScope(v)} style={{
                    flex:1, padding:"10px 8px", borderRadius:10, cursor:"pointer", fontFamily:"inherit",
                    border:`2px solid ${scope===v ? cfg.color : C.border}`,
                    background: scope===v ? cfg.bg : "#fff",
                    color: scope===v ? cfg.color : C.muted,
                    fontWeight: scope===v ? 700 : 400, textAlign:"center" }}>
                    <div style={{ fontSize:13 }}>{cfg.label}</div>
                    <div style={{ fontSize:11, marginTop:2 }}>{cfg.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ErrorBanner message={error}/>
          <Btn full loading={saving} onClick={save}>💾 حفظ القالب</Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TEMPLATE CARD
// ═══════════════════════════════════════════════════════
function TemplateCard({ template, currentUserId, isAdmin, onPreview, onUse, onEdit, onDuplicate, onToggleStatus }) {
  const qs      = template.questions || [];
  const minutes = estimateMinutes(qs);
  const isOwner = template.created_by === currentUserId;
  const canEdit = isOwner || isAdmin;
  const scope   = SCOPE_CONFIG[template.scope] || SCOPE_CONFIG.personal;
  const isActive = template.status === "active";

  return (
    <Card style={{ marginBottom:12, opacity: isActive ? 1 : 0.65 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, gap:8 }}>
        <div style={{ flex:1 }}>
          <h3 style={{ margin:"0 0 3px", fontSize:15, color:C.dark, fontWeight:700, lineHeight:1.4 }}>
            {template.title}
          </h3>
          {template.description && (
            <p style={{ margin:0, fontSize:12, color:C.muted, lineHeight:1.5 }}>
              {template.description.length > 70
                ? template.description.slice(0,70) + "..."
                : template.description}
            </p>
          )}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0 }}>
          <Tag color={C.primary}>{SURVEY_TYPE_LABELS[template.survey_type] || "🏫 مدارس"}</Tag>
          <Tag color={scope.color}>{scope.label}</Tag>
          {!isActive && <Tag color={C.muted}>🚫 معطّل</Tag>}
        </div>
      </div>

      <div style={{ display:"flex", gap:14, marginBottom:12 }}>
        <span style={{ fontSize:12, color:C.muted }}>❓ {qs.length} سؤال</span>
        <span style={{ fontSize:12, color:C.muted }}>⏱️ {minutes} د</span>
        {template.template_categories?.name && (
          <span style={{ fontSize:12, color:C.muted }}>🗂️ {template.template_categories.name}</span>
        )}
        {template.updated_at && (
          <span style={{ fontSize:12, color:C.muted }}>
            🕐 {new Date(template.updated_at).toLocaleDateString("ar-SA")}
          </span>
        )}
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <Btn sm variant="secondary" onClick={()=>onPreview(template)}>👁️ معاينة</Btn>
        {isActive && <Btn sm onClick={()=>onUse(template)}>✓ استخدام</Btn>}
        {canEdit && <Btn sm variant="secondary" onClick={()=>onEdit(template)}>✏️ تعديل</Btn>}
        {canEdit && <Btn sm variant="secondary" onClick={()=>onDuplicate(template)}>📄 نسخ</Btn>}
        {canEdit && (
          <Btn sm variant={isActive ? "danger" : "secondary"} onClick={()=>onToggleStatus(template)}>
            {isActive ? "🚫 تعطيل" : "✅ تفعيل"}
          </Btn>
        )}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// TEMPLATE FORM PAGE (إنشاء / تعديل)
// ═══════════════════════════════════════════════════════
function TemplateFormPage({ existing, user, isAdmin, onSaved, onCancel }) {
  const { categories } = useCategories();
  const isEdit = !!existing;

  const [title, setTitle]           = useState(existing?.title || "");
  const [desc, setDesc]             = useState(existing?.description || "");
  const [categoryId, setCategoryId] = useState(existing?.category_id || "");
  const [scope, setScope]           = useState(existing?.scope || "personal");
  const [surveyType, setSurveyType] = useState(existing?.survey_type || "school");
  const [qs, setQs]                 = useState(() => {
    if (existing?.questions?.length) {
      return existing.questions.map(q => ({
        ...deepClone(q),
        id: genId(),
        options: q.options || [],
        allowedFileTypes: q.allowed_file_types || "pdf,xlsx",
      }));
    }
    return [{ id: genId(), type:"text", label:"", required:true, options:[], allowedFileTypes:"pdf,xlsx" }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const upd = (id, f, v) => setQs(p => p.map(q => q.id === id ? { ...q, [f]: v } : q));
  const removeQ = id => setQs(p => p.filter(q => q.id !== id));
  const addQ    = ()  => setQs(p => [...p, { id:genId(), type:"text", label:"", required:false, options:[], allowedFileTypes:"pdf,xlsx" }]);

  const types = [
    {v:"text",l:"نص قصير"},{v:"textarea",l:"نص طويل"},
    {v:"number",l:"رقم"},{v:"select",l:"اختيار من قائمة"},
    {v:"rating",l:"تقييم بالنجوم"},{v:"file",l:"رفع ملف"},
  ];

  async function save() {
    if (!title.trim()) { setError("اسم القالب مطلوب"); return; }
    if (!qs.length)    { setError("أضف سؤالاً واحداً على الأقل"); return; }
    setSaving(true); setError("");

    const questions = qs.map(q => ({
      type:    q.type,
      label:   q.label,
      required: q.required,
      options:  deepClone(q.options || []),
      allowed_file_types: q.type === "file" ? (q.allowedFileTypes || "pdf,xlsx") : null,
    }));

    const payload = {
      title:            title.trim(),
      description:      desc.trim() || null,
      category_id:      categoryId || null,
      survey_type:      surveyType,
      scope:            isAdmin ? scope : "personal",
      questions,
      default_settings: {},
      updated_at:       new Date().toISOString(),
    };

    let err;
    if (isEdit) {
      ({ error: err } = await supabase.from("survey_templates").update(payload).eq("id", existing.id));
    } else {
      ({ error: err } = await supabase.from("survey_templates").insert({ ...payload, created_by: user?.id }));
    }

    setSaving(false);
    if (err) { setError("فشل الحفظ: " + err.message); return; }
    logAction({ user, action: isEdit ? "update" : "create", table:"survey_templates", recordLabel: title });
    onSaved();
  }

  const inputStyle = { width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`,
    borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl",
    boxSizing:"border-box", outline:"none" };

  // نفس ألوان نوع الاستبيان من Management.jsx
  const typeColors = { school:C.primary, supervisor:"#7B2D8B", administrator:"#B7791F", open:C.accent };

  return (
    <div style={{ padding:16, direction:"rtl", paddingBottom:80 }}>
      <button onClick={onCancel} style={{ background:"none", border:"none", color:C.primary,
        fontSize:14, cursor:"pointer", padding:"0 0 14px", fontFamily:"inherit",
        display:"flex", alignItems:"center", gap:4 }}>← إلغاء</button>

      <h2 style={{ margin:"0 0 16px", fontSize:18, color:C.dark, fontWeight:800 }}>
        {isEdit ? "تعديل القالب" : "قالب جديد"}
      </h2>

      {/* معلومات القالب */}
      <Card style={{ marginBottom:14 }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>معلومات القالب</p>

        <div style={{ marginBottom:10 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>
            اسم القالب <span style={{ color:C.danger }}>*</span>
          </label>
          <input value={title} onChange={e=>setTitle(e.target.value)}
            placeholder="مثال: استبيان رضا أولياء الأمور" style={inputStyle}/>
        </div>

        <div style={{ marginBottom:10 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>وصف</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2}
            placeholder="وصف مختصر للقالب..."
            style={{ ...inputStyle, resize:"vertical" }}/>
        </div>

        <div style={{ marginBottom:10 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>الفئة</label>
          <select value={categoryId} onChange={e=>setCategoryId(e.target.value)}
            style={{ ...inputStyle, background:C.white }}>
            <option value="">— اختر فئة —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* نوع المستهدف */}
        <div style={{ marginBottom: isAdmin ? 10 : 0 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>نوع المستهدف</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {Object.entries(SURVEY_TYPE_LABELS).map(([v, l]) => (
              <button key={v} onClick={()=>setSurveyType(v)} style={{
                padding:"8px 14px", borderRadius:10, fontSize:12, fontFamily:"inherit", cursor:"pointer",
                border:`1.5px solid ${surveyType===v ? (typeColors[v]||C.primary) : C.border}`,
                background: surveyType===v ? `${typeColors[v]||C.primary}15` : "#fff",
                color: surveyType===v ? (typeColors[v]||C.primary) : C.muted,
                fontWeight: surveyType===v ? 700 : 400 }}>{l}</button>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div style={{ marginTop:10 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>نطاق القالب</label>
            <div style={{ display:"flex", gap:8 }}>
              {Object.entries(SCOPE_CONFIG).map(([v, cfg]) => (
                <button key={v} onClick={()=>setScope(v)} style={{
                  flex:1, padding:"9px 8px", borderRadius:10, cursor:"pointer", fontFamily:"inherit",
                  border:`2px solid ${scope===v ? cfg.color : C.border}`,
                  background: scope===v ? cfg.bg : "#fff",
                  color: scope===v ? cfg.color : C.muted,
                  fontWeight: scope===v ? 700 : 400, textAlign:"center" }}>
                  <div style={{ fontSize:13 }}>{cfg.label}</div>
                  <div style={{ fontSize:11, marginTop:2 }}>{cfg.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* بناء الأسئلة — نفس نمط NewSurveyPage */}
      {qs.map((q, i) => (
        <Card key={q.id} style={{ marginBottom:12 }} accent={C.primary}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.primary }}>السؤال {i+1}</span>
            {qs.length > 1 && (
              <button onClick={()=>removeQ(q.id)}
                style={{ background:"none", border:"none", cursor:"pointer", color:C.danger, fontSize:18 }}>🗑</button>
            )}
          </div>
          <input value={q.label} onChange={e=>upd(q.id,"label",e.target.value)}
            placeholder="نص السؤال..."
            style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${C.border}`, borderRadius:10,
              fontSize:14, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box",
              outline:"none", marginBottom:10 }}/>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <select value={q.type} onChange={e=>upd(q.id,"type",e.target.value)}
              style={{ flex:1, minWidth:140, padding:"9px 10px", border:`1.5px solid ${C.border}`,
                borderRadius:10, fontSize:13, fontFamily:"inherit", color:C.text, background:C.white }}>
              {types.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, cursor:"pointer" }}>
              <input type="checkbox" checked={q.required}
                onChange={e=>upd(q.id,"required",e.target.checked)} style={{width:16,height:16}}/>
              مطلوب
            </label>
          </div>
          {q.type === "select" && (
            <textarea value={(q.options||[]).join("\n")}
              onChange={e=>upd(q.id,"options",e.target.value.split("\n").filter(Boolean))}
              rows={3} placeholder={"خيار 1\nخيار 2\nخيار 3"}
              style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${C.border}`, borderRadius:10,
                fontSize:13, fontFamily:"inherit", direction:"rtl", resize:"none",
                boxSizing:"border-box", outline:"none", marginTop:8 }}/>
          )}
          {q.type === "file" && (
            <div style={{ marginTop:8 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:5 }}>
                أنواع الملفات:
              </label>
              <div style={{ display:"flex", gap:10 }}>
                {[["pdf","PDF"],["xlsx","Excel"]].map(([v,l]) => (
                  <label key={v} style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, cursor:"pointer" }}>
                    <input type="checkbox"
                      checked={(q.allowedFileTypes||"pdf,xlsx").includes(v)}
                      onChange={e => {
                        const cur  = (q.allowedFileTypes||"pdf,xlsx").split(",").filter(Boolean);
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
        <Btn sm variant="secondary" onClick={addQ}>＋ سؤال</Btn>
        <Btn sm disabled={!title.trim()} loading={saving} onClick={save}>✓ حفظ القالب</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN TEMPLATES PAGE
// ═══════════════════════════════════════════════════════
export default function TemplatesPage({ user, isAdmin, onUseTemplate }) {
  const { templates, loading, refetch } = useTemplates();
  const { categories }                  = useCategories();

  const [search,         setSearch]         = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType,     setFilterType]     = useState("");
  const [filterScope,    setFilterScope]    = useState("");
  const [preview,        setPreview]        = useState(null);
  const [formTarget,     setFormTarget]     = useState(undefined); // undefined=hidden, null=new, obj=edit

  const filtered = useMemo(() => {
    let list = templates;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description||"").toLowerCase().includes(q)
      );
    }
    if (filterCategory) list = list.filter(t => t.category_id === filterCategory);
    if (filterType)     list = list.filter(t => t.survey_type === filterType);
    if (filterScope)    list = list.filter(t => t.scope === filterScope);
    return list;
  }, [templates, search, filterCategory, filterType, filterScope]);

  async function toggleStatus(template) {
    const newStatus = template.status === "active" ? "disabled" : "active";
    await supabase.from("survey_templates")
      .update({ status: newStatus }).eq("id", template.id);
    logAction({ user, action:"update", table:"survey_templates",
      recordLabel:`${template.title} → ${newStatus}` });
    refetch();
  }

  async function duplicate(template) {
    const { error } = await supabase.from("survey_templates").insert({
      title:            `نسخة من ${template.title}`,
      description:      template.description,
      category_id:      template.category_id,
      survey_type:      template.survey_type,
      scope:            "personal",
      questions:        deepClone(template.questions || []),
      default_settings: deepClone(template.default_settings || {}),
      status:           "active",
      created_by:       user?.id,
    });
    if (!error) {
      logAction({ user, action:"create", table:"survey_templates", recordLabel:`نسخة: ${template.title}` });
      refetch();
    }
  }

  // عرض نموذج الإنشاء/التعديل
  if (formTarget !== undefined) {
    return (
      <TemplateFormPage
        existing={formTarget}
        user={user}
        isAdmin={isAdmin}
        onSaved={() => { setFormTarget(undefined); refetch(); }}
        onCancel={() => setFormTarget(undefined)}
      />
    );
  }

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      {/* رأس */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, color:C.dark, fontWeight:800 }}>مكتبة القوالب</h2>
          <p style={{ margin:"2px 0 0", fontSize:12, color:C.muted }}>{templates.length} قالب</p>
        </div>
        <Btn sm onClick={()=>setFormTarget(null)}>＋ قالب جديد</Btn>
      </div>

      {/* بحث */}
      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="🔍 ابحث باسم القالب أو الوصف..."
        style={{ width:"100%", padding:"10px 14px", border:`1.5px solid ${C.border}`, borderRadius:10,
          fontSize:13, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box",
          outline:"none", marginBottom:10 }}/>

      {/* فلاتر */}
      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
        <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:20, fontSize:12, fontFamily:"inherit",
            border:`1.5px solid ${filterCategory ? C.primary : C.border}`,
            background:"#fff", color: filterCategory ? C.primary : C.muted, cursor:"pointer" }}>
          <option value="">كل الفئات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={filterType} onChange={e=>setFilterType(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:20, fontSize:12, fontFamily:"inherit",
            border:`1.5px solid ${filterType ? C.primary : C.border}`,
            background:"#fff", color: filterType ? C.primary : C.muted, cursor:"pointer" }}>
          <option value="">كل الأنواع</option>
          {Object.entries(SURVEY_TYPE_LABELS).map(([v,l]) =>
            <option key={v} value={v}>{l}</option>)}
        </select>

        <select value={filterScope} onChange={e=>setFilterScope(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:20, fontSize:12, fontFamily:"inherit",
            border:`1.5px solid ${filterScope ? C.primary : C.border}`,
            background:"#fff", color: filterScope ? C.primary : C.muted, cursor:"pointer" }}>
          <option value="">الكل</option>
          <option value="system">🌐 عام</option>
          <option value="personal">🔒 شخصي</option>
        </select>

        {(filterCategory || filterType || filterScope || search) && (
          <button onClick={()=>{ setSearch(""); setFilterCategory(""); setFilterType(""); setFilterScope(""); }}
            style={{ padding:"7px 14px", borderRadius:20, fontSize:12, fontFamily:"inherit",
              border:`1.5px solid ${C.danger}`, background:C.dangerBg, color:C.danger, cursor:"pointer" }}>
            ✕ مسح
          </button>
        )}
      </div>

      {/* محتوى */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40 }}><Spinner size={28}/></div>
      ) : filtered.length === 0 ? (
        <Card style={{ textAlign:"center", padding:32 }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🗂️</div>
          <p style={{ margin:0, color:C.muted, fontSize:13 }}>
            {templates.length === 0
              ? "لا توجد قوالب بعد — أنشئ أول قالب!"
              : "لا توجد نتائج مطابقة"}
          </p>
        </Card>
      ) : (
        filtered.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            currentUserId={user?.id}
            isAdmin={isAdmin}
            onPreview={setPreview}
            onUse={onUseTemplate}
            onEdit={t => setFormTarget(t)}
            onDuplicate={duplicate}
            onToggleStatus={toggleStatus}
          />
        ))
      )}

      {/* معاينة */}
      {preview && (
        <TemplatePreviewSheet
          template={preview}
          onUse={() => { onUseTemplate(preview); setPreview(null); }}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

