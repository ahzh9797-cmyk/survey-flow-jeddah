import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ErrorBanner, logAction } from "./lib.jsx";
import { SURVEY_TYPE_LABELS } from "./SurveyService.jsx";
import { NewSurveyPage } from "./Management.jsx";

// ═══════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════
function useTemplates(user) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("survey_templates")
      .select("*, template_categories(name)")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { templates, loading, refetch: load };
}

function useCategories() {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    supabase.from("template_categories").select("*").order("name")
      .then(({ data }) => setCategories(data || []));
  }, []);
  return categories;
}

// ═══════════════════════════════════════════════════════
// ESTIMATED TIME
// ═══════════════════════════════════════════════════════
function estimateMinutes(questions) {
  if (!questions?.length) return 1;
  const total = questions.reduce((acc, q) => {
    if (q.type === "textarea") return acc + 2;
    if (q.type === "file") return acc + 1.5;
    return acc + 0.5;
  }, 0);
  return Math.max(1, Math.ceil(total));
}

// ═══════════════════════════════════════════════════════
// PREVIEW SHEET
// ═══════════════════════════════════════════════════════
function TemplatePreviewSheet({ template, onUse, onClose }) {
  const qs = template.questions || [];
  const typeCounts = qs.reduce((acc, q) => {
    const label = {
      text: "نص قصير", textarea: "نص طويل", number: "رقم",
      select: "اختيار", rating: "تقييم", file: "ملف"
    }[q.type] || q.type;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  const minutes = estimateMinutes(qs);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200,
      display:"flex", alignItems:"flex-end", direction:"rtl" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", background:C.white, borderRadius:"20px 20px 0 0",
        maxHeight:"88vh", overflowY:"auto", paddingBottom:32 }}>

        {/* مقبض */}
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
              cursor:"pointer", color:C.muted, marginRight:8, flexShrink:0 }}>✕</button>
          </div>

          {/* معلومات سريعة */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
            {[
              { i:"🎯", l:"نوع المستهدف", v: SURVEY_TYPE_LABELS[template.survey_type] || "مدارس" },
              { i:"❓", l:"عدد الأسئلة", v: `${qs.length} سؤال` },
              { i:"⏱️", l:"وقت تقديري", v: `${minutes} دقيقة` },
              { i:"🗂️", l:"الفئة", v: template.template_categories?.name || "غير محدد" },
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
                  <span key={type} style={{ background:C.primaryBg, color:C.primary, borderRadius:20,
                    padding:"4px 12px", fontSize:12, fontWeight:600 }}>
                    {type} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* قائمة الأسئلة */}
          <div style={{ marginBottom:20 }}>
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
                      {{text:"نص قصير",textarea:"نص طويل",number:"رقم",
                        select:"اختيار من قائمة",rating:"تقييم بالنجوم",file:"رفع ملف"}[q.type] || q.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* نطاق */}
          <div style={{ background: template.scope === "system" ? C.primaryBg : "#f5eefa",
            borderRadius:10, padding:"10px 14px", marginBottom:20 }}>
            <p style={{ margin:0, fontSize:12, color: template.scope === "system" ? C.primary : "#7B2D8B", fontWeight:700 }}>
              {template.scope === "system" ? "🌐 قالب عام — متاح لجميع المستخدمين" : "🔒 قالب شخصي — خاص بك"}
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
  const categories = useCategories();
  const [title, setTitle] = useState(survey.title || "");
  const [desc, setDesc] = useState(survey.description || "");
  const [categoryId, setCategoryId] = useState("");
  const [scope, setScope] = useState("personal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!title.trim()) { setError("اسم القالب مطلوب"); return; }
    setSaving(true); setError("");

    const questions = (survey.questions || []).map(q => ({
      type: q.type, label: q.label, required: q.required,
      options: q.options || [],
      allowed_file_types: q.allowed_file_types || null,
    }));

    const { error: err } = await supabase.from("survey_templates").insert({
      title: title.trim(),
      description: desc.trim() || null,
      category_id: categoryId || null,
      survey_type: survey.survey_type || "school",
      scope: isAdmin ? scope : "personal",
      questions,
      default_settings: {
        response_limit: survey.response_limit || "one_per_entity",
      },
      created_by: user?.id,
    });

    setSaving(false);
    if (err) { setError("فشل الحفظ: " + err.message); return; }
    logAction({ user, action:"create", table:"survey_templates", recordLabel: title });
    onSaved();
  }

  const inputStyle = { width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`,
    borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl",
    boxSizing:"border-box", outline:"none" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200,
      display:"flex", alignItems:"flex-end", direction:"rtl" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", background:C.white, borderRadius:"20px 20px 0 0",
        maxHeight:"85vh", overflowY:"auto", padding:"0 0 32px" }}>

        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0" }}>
          <div style={{ width:40, height:4, background:C.border, borderRadius:4 }}/>
        </div>

        <div style={{ padding:"0 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:17, color:C.dark, fontWeight:800 }}>حفظ كقالب</h3>
            <button onClick={onClose} style={{ background:"none", border:"none",
              fontSize:22, cursor:"pointer", color:C.muted }}>✕</button>
          </div>

          <div style={{ background:C.primaryBg, borderRadius:10, padding:"10px 14px", marginBottom:16 }}>
            <p style={{ margin:0, fontSize:12, color:C.primary }}>
              سيتم نسخ الأسئلة والإعدادات فقط — لن تُنسخ الردود أو البيانات.
            </p>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>
              اسم القالب <span style={{ color:C.danger }}>*</span>
            </label>
            <input value={title} onChange={e=>setTitle(e.target.value)} style={inputStyle}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>
              وصف القالب
            </label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2}
              style={{ ...inputStyle, resize:"vertical" }}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>
              الفئة
            </label>
            <select value={categoryId} onChange={e=>setCategoryId(e.target.value)}
              style={{ ...inputStyle, background:C.white }}>
              <option value="">— اختر فئة —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {isAdmin && (
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>
                نطاق القالب
              </label>
              <div style={{ display:"flex", gap:8 }}>
                {[["personal","🔒 شخصي","خاص بك فقط"],["system","🌐 عام","متاح لجميع المستخدمين"]].map(([v,l,sub]) => (
                  <button key={v} onClick={()=>setScope(v)} style={{
                    flex:1, padding:"10px 8px", borderRadius:10, cursor:"pointer", fontFamily:"inherit",
                    border:`2px solid ${scope===v ? C.primary : C.border}`,
                    background: scope===v ? C.primaryBg : "#fff",
                    color: scope===v ? C.primary : C.muted }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{l}</div>
                    <div style={{ fontSize:11, marginTop:2 }}>{sub}</div>
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
function TemplateCard({ template, currentUserId, isAdmin, onPreview, onUse, onEdit, onToggleStatus }) {
  const qs = template.questions || [];
  const minutes = estimateMinutes(qs);
  const isOwner = template.created_by === currentUserId;
  const canEdit = isOwner || isAdmin;

  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, gap:8 }}>
        <div style={{ flex:1 }}>
          <h3 style={{ margin:"0 0 3px", fontSize:15, color:C.dark, fontWeight:700, lineHeight:1.4 }}>
            {template.title}
          </h3>
          {template.description && (
            <p style={{ margin:0, fontSize:12, color:C.muted, lineHeight:1.5 }}>
              {template.description.length > 60 ? template.description.slice(0,60)+"..." : template.description}
            </p>
          )}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0 }}>
          <Tag color={SURVEY_TYPE_LABELS[template.survey_type] ? C.primary : C.accent}>
            {SURVEY_TYPE_LABELS[template.survey_type] || "مدارس"}
          </Tag>
          <Tag color={template.scope === "system" ? C.success : "#7B2D8B"}>
            {template.scope === "system" ? "🌐 عام" : "🔒 شخصي"}
          </Tag>
        </div>
      </div>

      <div style={{ display:"flex", gap:12, marginBottom:12 }}>
        <span style={{ fontSize:12, color:C.muted }}>❓ {qs.length} سؤال</span>
        <span style={{ fontSize:12, color:C.muted }}>⏱️ {minutes} د</span>
        {template.template_categories?.name && (
          <span style={{ fontSize:12, color:C.muted }}>🗂️ {template.template_categories.name}</span>
        )}
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <Btn sm variant="secondary" onClick={()=>onPreview(template)}>👁️ معاينة</Btn>
        <Btn sm onClick={()=>onUse(template)}>✓ استخدام</Btn>
        {canEdit && <Btn sm variant="secondary" onClick={()=>onEdit(template)}>✏️ تعديل</Btn>}
        {canEdit && (
          <Btn sm variant={template.status==="active"?"danger":"secondary"}
            onClick={()=>onToggleStatus(template)}>
            {template.status==="active" ? "🚫 تعطيل" : "✅ تفعيل"}
          </Btn>
        )}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// TEMPLATE FORM (إنشاء / تعديل قالب)
// ═══════════════════════════════════════════════════════
function TemplateFormPage({ existing, user, isAdmin, onSaved, onCancel }) {
  const categories = useCategories();
  const isEdit = !!existing;

  const [title, setTitle] = useState(existing?.title || "");
  const [desc, setDesc] = useState(existing?.description || "");
  const [categoryId, setCategoryId] = useState(existing?.category_id || "");
  const [scope, setScope] = useState(existing?.scope || "personal");
  const [surveyType, setSurveyType] = useState(existing?.survey_type || "school");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // نعيد استخدام NewSurveyPage بوضع template
  // نحتاج فقط لحفظ الأسئلة — نمرر callback
  const [pendingSave, setPendingSave] = useState(null);

  async function handleTemplateSave({ title: sTitle, description: sDesc,
    surveyType: sSurveyType, questions, surveySettings }) {

    if (!title.trim()) { setError("اسم القالب مطلوب"); return; }
    setSaving(true); setError("");

    const payload = {
      title: title.trim(),
      description: desc.trim() || null,
      category_id: categoryId || null,
      survey_type: sSurveyType || surveyType,
      scope: isAdmin ? scope : "personal",
      questions: questions.map(q => ({
        type: q.type, label: q.label, required: q.required,
        options: q.options || [],
        allowed_file_types: q.allowed_file_types || null,
      })),
      default_settings: {
        response_limit: surveySettings?.response_limit || "one_per_entity",
      },
      updated_at: new Date().toISOString(),
    };

    let err;
    if (isEdit) {
      ({ error: err } = await supabase.from("survey_templates").update(payload).eq("id", existing.id));
    } else {
      ({ error: err } = await supabase.from("survey_templates").insert({ ...payload, created_by: user?.id }));
    }

    setSaving(false);
    if (err) { setError("فشل الحفظ: " + err.message); return; }
    logAction({ user, action: isEdit?"update":"create", table:"survey_templates", recordLabel: title });
    onSaved();
  }

  const inputStyle = { width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`,
    borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl",
    boxSizing:"border-box", outline:"none" };

  return (
    <div style={{ padding:16, direction:"rtl" }}>
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

        {isAdmin && (
          <div>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>نطاق القالب</label>
            <div style={{ display:"flex", gap:8 }}>
              {[["personal","🔒 شخصي"],["system","🌐 عام"]].map(([v,l]) => (
                <button key={v} onClick={()=>setScope(v)} style={{
                  flex:1, padding:"9px 0", borderRadius:10, cursor:"pointer", fontFamily:"inherit",
                  border:`2px solid ${scope===v ? C.primary : C.border}`,
                  background: scope===v ? C.primaryBg : "#fff",
                  color: scope===v ? C.primary : C.muted, fontWeight: scope===v ? 700 : 400 }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <ErrorBanner message={error}/>

      {/* نعيد استخدام NewSurveyPage في وضع القالب */}
      <NewSurveyPage
        templateMode
        templateMeta={{ title, desc, categoryId, scope, surveyType }}
        existingSurvey={isEdit ? {
          title: existing.title,
          description: existing.description,
          survey_type: existing.survey_type,
          questions: existing.questions,
          response_limit: existing.default_settings?.response_limit,
        } : null}
        onTemplateSave={handleTemplateSave}
        onCancel={onCancel}
        user={user}
        isAdmin={isAdmin}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN TEMPLATES PAGE
// ═══════════════════════════════════════════════════════
export default function TemplatesPage({ user, isAdmin, onUseTemplate, onBack }) {
  const { templates, loading, refetch } = useTemplates(user);
  const categories = useCategories();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterScope, setFilterScope] = useState("");
  const [preview, setPreview] = useState(null);
  const [formTarget, setFormTarget] = useState(undefined); // undefined=hidden, null=new, obj=edit

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
    if (filterType) list = list.filter(t => t.survey_type === filterType);
    if (filterScope) list = list.filter(t => t.scope === filterScope);
    return list;
  }, [templates, search, filterCategory, filterType, filterScope]);

  async function toggleStatus(template) {
    const newStatus = template.status === "active" ? "disabled" : "active";
    await supabase.from("survey_templates").update({ status: newStatus }).eq("id", template.id);
    logAction({ user, action:"update", table:"survey_templates", recordLabel:`${template.title} → ${newStatus}` });
    refetch();
  }

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
      {/* رأس الصفحة */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, color:C.dark, fontWeight:800 }}>مكتبة القوالب</h2>
          <p style={{ margin:"2px 0 0", fontSize:12, color:C.muted }}>{templates.length} قالب متاح</p>
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
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}
          style={{ padding:"7px 10px", border:`1.5px solid ${filterCategory?C.primary:C.border}`,
            borderRadius:20, fontSize:12, fontFamily:"inherit", background:"#fff",
            color: filterCategory ? C.primary : C.muted, cursor:"pointer" }}>
          <option value="">كل الفئات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={filterType} onChange={e=>setFilterType(e.target.value)}
          style={{ padding:"7px 10px", border:`1.5px solid ${filterType?C.primary:C.border}`,
            borderRadius:20, fontSize:12, fontFamily:"inherit", background:"#fff",
            color: filterType ? C.primary : C.muted, cursor:"pointer" }}>
          <option value="">كل الأنواع</option>
          {Object.entries(SURVEY_TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select value={filterScope} onChange={e=>setFilterScope(e.target.value)}
          style={{ padding:"7px 10px", border:`1.5px solid ${filterScope?C.primary:C.border}`,
            borderRadius:20, fontSize:12, fontFamily:"inherit", background:"#fff",
            color: filterScope ? C.primary : C.muted, cursor:"pointer" }}>
          <option value="">الكل</option>
          <option value="system">🌐 عام</option>
          <option value="personal">🔒 شخصي</option>
        </select>
      </div>

      {/* قائمة القوالب */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40 }}><Spinner size={28}/></div>
      ) : filtered.length === 0 ? (
        <Card style={{ textAlign:"center", padding:32 }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
          <p style={{ margin:0, color:C.muted, fontSize:13 }}>
            {templates.length === 0 ? "لا توجد قوالب بعد — أنشئ أول قالب!" : "لا توجد نتائج مطابقة"}
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
            onUse={t => onUseTemplate(t)}
            onEdit={t => setFormTarget(t)}
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
