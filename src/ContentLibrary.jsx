/**
 * ContentLibrary.jsx
 * Full content library UI — Questions, Sections, Conditions, Variables
 * Independent component — no modification to existing files
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Spinner, ErrorBanner } from "./lib.jsx";
import { genId, deepClone } from "./utils.js";
import {
  SMART_VARIABLES, detectVariables, resolveVariables,
  fetchCategories, createCategory, deleteCategory,
  fetchLibraryQuestions, saveLibraryQuestion, updateLibraryQuestion,
  deleteLibraryQuestion, toggleQuestionFavorite, fetchQuestionVersions,
  fetchLibrarySections, saveLibrarySection, updateLibrarySection,
  deleteLibrarySection, toggleSectionFavorite, fetchSectionVersions,
  fetchLibraryConditions, saveLibraryCondition, updateLibraryCondition,
  deleteLibraryCondition, toggleConditionFavorite,
  exportLibraryToJSON, importLibraryFromJSON, exportLibraryToExcel,
} from "./ContentLibraryService.js";

// ── Design tokens (match app) ────────────────────────
const L = {
  e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
  e100:"#D1FAE5",e50:"#ECFDF5",
  gold:"#C9A84C",goldL:"#FEF3C7",
  s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
  s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
  white:"#FFFFFF",bg:"#F0F4F8",
  danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
  success:"#059669",successBg:"#ECFDF5",purple:"#7B2D8B",purpleBg:"#F5EEFA",
};

if (typeof document !== "undefined" && !document.getElementById("lib-premium-styles")) {
  const _s = document.createElement("style");
  _s.id = "lib-premium-styles";
  _s.textContent = `
    .lib-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .lib-card:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; }
    .lib-btn { transition: all 0.12s ease; }
    .lib-btn:active { transform: scale(0.95); }
    .lib-search:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; outline:none; }
    @keyframes lib-in { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
    .lib-in { animation: lib-in 0.2s ease both; }
    @keyframes spin { to{transform:rotate(360deg)} }
  `;
  document.head.appendChild(_s);
}

// ── Shared UI ────────────────────────────────────────
const iSt = (extra={}) => ({
  width:"100%", padding:"10px 12px", border:`1.5px solid ${L.s200}`,
  borderRadius:10, fontSize:13, fontFamily:"inherit", direction:"rtl",
  boxSizing:"border-box", outline:"none", background:L.white, color:L.s900,
  ...extra,
});

function LBtn({ children, onClick, variant="primary", sm, disabled, loading, style={} }) {
  const base = {
    border:"none", borderRadius:10, cursor:disabled||loading?"not-allowed":"pointer",
    fontFamily:"inherit", fontWeight:700, display:"inline-flex", alignItems:"center",
    justifyContent:"center", gap:6, opacity:disabled||loading?0.6:1,
    padding: sm ? "6px 12px" : "10px 16px",
    fontSize: sm ? 11 : 13,
    transition:"all 0.12s ease",
  };
  const variants = {
    primary: { background:`linear-gradient(135deg,${L.e600},${L.e800})`, color:"#fff", boxShadow:`0 3px 10px ${L.e600}35` },
    secondary: { background:L.s100, color:L.s700 },
    danger: { background:L.dangerBg, color:L.danger },
    ghost: { background:"none", color:L.s500 },
    gold: { background:`linear-gradient(135deg,${L.gold},#b8902a)`, color:"#fff" },
  };
  return (
    <button onClick={onClick} disabled={disabled||loading} className="lib-btn"
      style={{ ...base, ...variants[variant], ...style }}>
      {loading ? <span style={{ width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.7s linear infinite" }}/> : children}
    </button>
  );
}

function Tag({ children, color = L.e700, bg = L.e50 }) {
  return (
    <span style={{ background:bg, color, borderRadius:20, padding:"2px 8px",
      fontSize:10, fontWeight:600, border:`1px solid ${color}25` }}>{children}</span>
  );
}

function EmptyState({ icon="📚", title, sub, action, onAction }) {
  return (
    <div style={{ textAlign:"center", padding:"40px 20px", background:L.white,
      borderRadius:18, border:`1px solid ${L.s200}` }}>
      <div style={{ fontSize:44, marginBottom:10 }}>{icon}</div>
      <p style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:L.s900 }}>{title}</p>
      {sub && <p style={{ margin:"0 0 16px", fontSize:12, color:L.s500 }}>{sub}</p>}
      {action && <LBtn sm onClick={onAction}>{action}</LBtn>}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position:"relative", marginBottom:10 }}>
      <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", fontSize:14 }}>🔍</span>
      <input className="lib-search" value={value} onChange={onChange} placeholder={placeholder}
        style={{ ...iSt(), padding:"10px 36px 10px 12px", marginBottom:0 }}/>
      {value && <button onClick={()=>onChange({target:{value:""}})} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:L.s400, cursor:"pointer", fontSize:14 }}>✕</button>}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"flex-end", direction:"rtl" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", background:L.bg, borderRadius:"24px 24px 0 0",
        maxHeight:"92vh", overflowY:"auto", paddingBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"14px 0 4px" }}>
          <div style={{ width:44, height:4, background:L.s200, borderRadius:4 }}/>
        </div>
        <div style={{ padding:"4px 18px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:16, color:L.s900, fontWeight:800 }}>{title}</h3>
            <button onClick={onClose} style={{ background:L.s100, border:"none", borderRadius:10, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, cursor:"pointer", color:L.s500 }}>✕</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Question type options ─────────────────────────────
const Q_TYPES = [
  {v:"text",l:"نص قصير",icon:"✏️"},{v:"textarea",l:"نص طويل",icon:"📝"},
  {v:"number",l:"رقم",icon:"🔢"},{v:"select",l:"اختيار",icon:"☑️"},
  {v:"rating",l:"تقييم",icon:"⭐"},{v:"file",l:"رفع ملف",icon:"📎"},
];

// ══════════════════════════════════════════════════════
// QUESTION FORM MODAL
// ══════════════════════════════════════════════════════
function QuestionFormModal({ initial, categories, user, onSaved, onClose }) {
  const isEdit = !!initial?.id;
  const [name,         setName]         = useState(initial?.name || "");
  const [categoryId,   setCategoryId]   = useState(initial?.category_id || "");
  const [description,  setDescription]  = useState(initial?.description || "");
  const [tags,         setTags]         = useState((initial?.tags||[]).join("، "));
  const [changeNote,   setChangeNote]   = useState("");
  const [qData,        setQData]        = useState(initial?.question_data || { type:"text", label:"", required:false, options:[], allowedFileTypes:"pdf,xlsx" });
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  const detected = useMemo(()=>detectVariables(qData.label),[qData.label]);

  async function save() {
    if (!name.trim() || !qData.label?.trim()) { setError("الاسم ونص السؤال مطلوبان"); return; }
    setSaving(true); setError("");
    const tagArr = tags.split(/[،,\n]/).map(t=>t.trim()).filter(Boolean);
    const payload = { name:name.trim(), categoryId, description, tags:tagArr, questionData:qData, userId:user?.id, userEmail:user?.email, changeNote };
    const { error:err } = isEdit
      ? await updateLibraryQuestion(initial.id, payload)
      : await saveLibraryQuestion(payload);
    setSaving(false);
    if (err) { setError("فشل الحفظ: " + err.message); return; }
    onSaved();
  }

  return (
    <Modal title={isEdit ? "تعديل السؤال" : "حفظ سؤال في المكتبة"} onClose={onClose}>
      {error && <div style={{ background:L.dangerBg, border:"1px solid #FECACA", borderRadius:10, padding:"10px 14px", fontSize:12, color:L.danger, marginBottom:12 }}>{error}</div>}

      <div style={{ marginBottom:10 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الاسم <span style={{color:L.danger}}>*</span></label>
        <input value={name} onChange={e=>setName(e.target.value)} style={iSt()}/>
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الفئة</label>
        <select value={categoryId} onChange={e=>setCategoryId(e.target.value)} style={{ ...iSt(), background:L.white }}>
          <option value="">— بدون فئة —</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      <div style={{ background:L.white, borderRadius:14, border:`1px solid ${L.s200}`, padding:14, marginBottom:10 }}>
        <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:L.s700 }}>السؤال</p>
        <input value={qData.label||""} onChange={e=>setQData(p=>({...p,label:e.target.value}))}
          placeholder="نص السؤال..." style={{ ...iSt(), marginBottom:8 }}/>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
          <select value={qData.type} onChange={e=>setQData(p=>({...p,type:e.target.value}))}
            style={{ ...iSt({flex:1}), marginBottom:0 }}>
            {Q_TYPES.map(t=><option key={t.v} value={t.v}>{t.icon} {t.l}</option>)}
          </select>
          <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, cursor:"pointer", whiteSpace:"nowrap" }}>
            <input type="checkbox" checked={!!qData.required} onChange={e=>setQData(p=>({...p,required:e.target.checked}))} style={{width:14,height:14}}/>مطلوب
          </label>
        </div>
        {qData.type==="select" && (
          <textarea value={(qData.options||[]).join("\n")} rows={3}
            onChange={e=>setQData(p=>({...p,options:e.target.value.split("\n").filter(Boolean)}))}
            placeholder="خيار 1\nخيار 2" style={{ ...iSt(), resize:"none" }}/>
        )}
        {/* Smart variables detected */}
        {detected.length > 0 && (
          <div style={{ background:L.e50, border:`1px solid ${L.e100}`, borderRadius:8, padding:"8px 10px", marginTop:8 }}>
            <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:700, color:L.e700 }}>متغيرات ذكية مكتشفة:</p>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {detected.map(v=><Tag key={v}>{v}</Tag>)}
            </div>
          </div>
        )}
      </div>

      {/* Smart Variables helper */}
      <div style={{ background:L.s50, border:`1px solid ${L.s200}`, borderRadius:12, padding:12, marginBottom:10 }}>
        <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, color:L.s500 }}>➕ أدرج متغيراً ذكياً:</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {SMART_VARIABLES.map(v=>(
            <button key={v.key} onClick={()=>setQData(p=>({...p,label:(p.label||"")+v.key}))}
              style={{ background:L.white, border:`1px solid ${L.s200}`, borderRadius:6,
                padding:"3px 8px", fontSize:10, color:L.s700, cursor:"pointer",
                fontFamily:"monospace" }}>
              {v.key}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الوصف</label>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2}
          style={{ ...iSt(), resize:"vertical" }}/>
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الوسوم (مفصولة بفاصلة)</label>
        <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="مثال: مدارس، قيادة، جودة" style={iSt()}/>
      </div>

      {isEdit && (
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>ملاحظة التغيير</label>
          <input value={changeNote} onChange={e=>setChangeNote(e.target.value)} style={iSt()}/>
        </div>
      )}

      <div style={{ display:"flex", gap:8 }}>
        <LBtn variant="secondary" onClick={onClose} style={{ flex:1 }}>إلغاء</LBtn>
        <LBtn onClick={save} loading={saving} style={{ flex:2 }}>💾 {isEdit?"حفظ التعديلات":"إضافة للمكتبة"}</LBtn>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════
// VERSION HISTORY MODAL
// ══════════════════════════════════════════════════════
function VersionHistoryModal({ type, itemId, onRestore, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(()=>{
    const fn = type==="question" ? fetchQuestionVersions : fetchSectionVersions;
    fn(itemId).then(({data})=>{ setVersions(data); setLoading(false); });
  },[itemId, type]);

  return (
    <Modal title="تاريخ الإصدارات" onClose={onClose}>
      {loading ? <div style={{textAlign:"center",padding:30}}><Spinner/></div>
      : versions.length===0 ? <EmptyState icon="📋" title="لا يوجد تاريخ بعد"/>
      : versions.map((v,i)=>(
        <div key={v.id} style={{ background:i===0?L.e50:L.white, border:`1px solid ${i===0?L.e100:L.s200}`,
          borderRadius:12, padding:12, marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <span style={{ fontSize:13, fontWeight:800, color:i===0?L.e700:L.s700 }}>
              {i===0?"✅ ":""}النسخة {v.version}
            </span>
            <span style={{ fontSize:10, color:L.s400 }}>
              {new Date(v.created_at).toLocaleDateString("ar-SA")}
            </span>
          </div>
          {v.change_note && <p style={{ margin:"0 0 8px", fontSize:11, color:L.s500 }}>{v.change_note}</p>}
          {v.created_by_email && <p style={{ margin:"0 0 8px", fontSize:10, color:L.s400 }}>{v.created_by_email}</p>}
          {i > 0 && (
            <LBtn sm variant="secondary" onClick={()=>onRestore(v)}>↩️ استعادة هذه النسخة</LBtn>
          )}
        </div>
      ))}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════
// QUESTION LIBRARY TAB
// ══════════════════════════════════════════════════════
function QuestionLibraryTab({ categories, user, onInsert }) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [catFilter,  setCatFilter]  = useState("");
  const [favOnly,    setFavOnly]    = useState(false);
  const [formTarget, setFormTarget] = useState(null);
  const [versionFor, setVersionFor] = useState(null);
  const [error,      setError]      = useState("");

  const load = useCallback(async()=>{
    setLoading(true);
    const{data}=await fetchLibraryQuestions({categoryId:catFilter||undefined, search, favoritesOnly:favOnly});
    setItems(data);setLoading(false);
  },[catFilter,search,favOnly]);

  useEffect(()=>{load();},[load]);

  async function handleDelete(id) {
    if (!confirm("حذف هذا السؤال من المكتبة؟")) return;
    await deleteLibraryQuestion(id); load();
  }
  async function handleFav(item) {
    await toggleQuestionFavorite(item.id, item.is_favorite); load();
  }
  async function handleDuplicate(item) {
    await saveLibraryQuestion({
      name: item.name + " (نسخة)", categoryId: item.category_id,
      description: item.description, tags: item.tags,
      questionData: deepClone(item.question_data),
      userId: user?.id, userEmail: user?.email,
    });
    load();
  }
  async function handleRestoreVersion(item, version) {
    await updateLibraryQuestion(item.id, {
      name: item.name, categoryId: item.category_id,
      description: item.description, tags: item.tags,
      questionData: version.question_data,
      userEmail: user?.email, changeNote: `استعادة النسخة ${version.version}`,
    });
    setVersionFor(null); load();
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <p style={{ margin:0, fontSize:14, fontWeight:800, color:L.s900 }}>مكتبة الأسئلة</p>
          <p style={{ margin:"2px 0 0", fontSize:11, color:L.s500 }}>{items.length} سؤال محفوظ</p>
        </div>
        <LBtn sm onClick={()=>setFormTarget({})}>＋ سؤال جديد</LBtn>
      </div>

      <SearchInput value={search} onChange={e=>{setSearch(e.target.value);}} placeholder="ابحث في الأسئلة..."/>

      <div style={{ display:"flex", gap:5, marginBottom:10, overflowX:"auto", paddingBottom:4 }}>
        <button onClick={()=>setCatFilter("")} style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", border:`1.5px solid ${!catFilter?L.e600:L.s200}`, background:!catFilter?L.e50:L.white, color:!catFilter?L.e700:L.s500, fontWeight:!catFilter?700:400 }}>الكل</button>
        <button onClick={()=>setFavOnly(p=>!p)} style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", border:`1.5px solid ${favOnly?L.gold:L.s200}`, background:favOnly?L.goldL:L.white, color:favOnly?L.gold:L.s500, fontWeight:favOnly?700:400 }}>⭐ المفضلة</button>
        {categories.map(c=>(
          <button key={c.id} onClick={()=>setCatFilter(catFilter===c.id?"":c.id)} style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", border:`1.5px solid ${catFilter===c.id?c.color:L.s200}`, background:catFilter===c.id?`${c.color}15`:L.white, color:catFilter===c.id?c.color:L.s500, fontWeight:catFilter===c.id?700:400 }}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {loading ? <div style={{textAlign:"center",padding:30}}><div style={{width:32,height:32,borderRadius:"50%",border:`3px solid ${L.e100}`,borderTopColor:L.e600,animation:"spin 0.7s linear infinite",margin:"0 auto"}}/></div>
      : items.length===0 ? <EmptyState icon="❓" title="لا توجد أسئلة في المكتبة" sub="اضغط ＋ لإضافة أول سؤال" action="＋ إضافة سؤال" onAction={()=>setFormTarget({})}/>
      : items.map((item,idx)=>(
        <div key={item.id} className="lib-card lib-in"
          style={{ background:L.white, borderRadius:16, border:`1px solid ${L.s200}`,
            marginBottom:10, boxShadow:"0 2px 6px rgba(0,0,0,0.05)",
            borderRight:`3px solid ${item.library_categories?.color||L.e500}`,
            animationDelay:`${idx*0.03}s` }}>
          <div style={{ padding:"12px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:L.s900 }}>{item.name}</p>
                <p style={{ margin:"2px 0 4px", fontSize:11, color:L.s500, lineHeight:1.5 }}>
                  {item.question_data?.label?.slice(0,60)}{(item.question_data?.label||"").length>60?"...":""}
                </p>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {item.library_categories && <Tag color={item.library_categories.color} bg={`${item.library_categories.color}15`}>{item.library_categories.icon} {item.library_categories.name}</Tag>}
                  <Tag bg={L.s100} color={L.s500}>{Q_TYPES.find(t=>t.v===item.question_data?.type)?.icon} {Q_TYPES.find(t=>t.v===item.question_data?.type)?.l||item.question_data?.type}</Tag>
                  {(item.tags||[]).map(t=><Tag key={t} bg={L.s50} color={L.s400}>{t}</Tag>)}
                  {(item.variables||[]).length>0 && <Tag bg={L.e50} color={L.e700}>✨ {item.variables.length} متغير</Tag>}
                  <Tag bg={L.s50} color={L.s300}>v{item.version}</Tag>
                </div>
              </div>
              <button onClick={()=>handleFav(item)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", flexShrink:0, color:item.is_favorite?L.gold:L.s200 }}>⭐</button>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", borderTop:`1px solid ${L.s100}`, paddingTop:8, marginTop:4 }}>
              {onInsert && <LBtn sm onClick={()=>onInsert("question", item)}>📥 إدراج</LBtn>}
              <LBtn sm variant="secondary" onClick={()=>setFormTarget(item)}>✏️ تعديل</LBtn>
              <LBtn sm variant="secondary" onClick={()=>handleDuplicate(item)}>📄 نسخ</LBtn>
              <LBtn sm variant="secondary" onClick={()=>setVersionFor(item)}>🕐 الإصدارات</LBtn>
              <LBtn sm variant="danger" onClick={()=>handleDelete(item.id)}>🗑️</LBtn>
            </div>
          </div>
        </div>
      ))}

      {formTarget !== null && (
        <QuestionFormModal
          initial={formTarget.id ? formTarget : null}
          categories={categories}
          user={user}
          onSaved={()=>{ setFormTarget(null); load(); }}
          onClose={()=>setFormTarget(null)}
        />
      )}

      {versionFor && (
        <VersionHistoryModal
          type="question"
          itemId={versionFor.id}
          onRestore={v=>handleRestoreVersion(versionFor,v)}
          onClose={()=>setVersionFor(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SECTION FORM MODAL
// ══════════════════════════════════════════════════════
function SectionFormModal({ initial, categories, user, onSaved, onClose }) {
  const isEdit = !!initial?.id;
  const [name,        setName]        = useState(initial?.name || "");
  const [categoryId,  setCategoryId]  = useState(initial?.category_id || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [tags,        setTags]        = useState((initial?.tags||[]).join("، "));
  const [questions,   setQuestions]   = useState(initial?.questions || [{ id:genId(), type:"text", label:"", required:false, options:[] }]);
  const [changeNote,  setChangeNote]  = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  function addQ()   { setQuestions(p=>[...p,{id:genId(),type:"text",label:"",required:false,options:[]}]); }
  function removeQ(id) { setQuestions(p=>p.filter(q=>q.id!==id)); }
  function updQ(id,f,v){ setQuestions(p=>p.map(q=>q.id===id?{...q,[f]:v}:q)); }

  async function save() {
    if (!name.trim() || !questions.length) { setError("الاسم والأسئلة مطلوبة"); return; }
    setSaving(true); setError("");
    const tagArr = tags.split(/[،,\n]/).map(t=>t.trim()).filter(Boolean);
    const payload = { name:name.trim(), categoryId, description, tags:tagArr, questions, userId:user?.id, userEmail:user?.email, changeNote };
    const { error:err } = isEdit
      ? await updateLibrarySection(initial.id, payload)
      : await saveLibrarySection(payload);
    setSaving(false);
    if (err) { setError("فشل الحفظ: " + err.message); return; }
    onSaved();
  }

  return (
    <Modal title={isEdit ? "تعديل القسم" : "حفظ قسم في المكتبة"} onClose={onClose}>
      {error && <div style={{ background:L.dangerBg, border:"1px solid #FECACA", borderRadius:10, padding:"10px 14px", fontSize:12, color:L.danger, marginBottom:12 }}>{error}</div>}

      <div style={{ marginBottom:10 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>اسم القسم <span style={{color:L.danger}}>*</span></label>
        <input value={name} onChange={e=>setName(e.target.value)} style={iSt()}/>
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الفئة</label>
        <select value={categoryId} onChange={e=>setCategoryId(e.target.value)} style={{ ...iSt(), background:L.white }}>
          <option value="">— بدون فئة —</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الوصف</label>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} style={{ ...iSt(), resize:"vertical" }}/>
      </div>

      <div style={{ marginBottom:12 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الوسوم</label>
        <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="مثال: مدارس، قيادة" style={iSt()}/>
      </div>

      {/* Questions in section */}
      <div style={{ background:L.white, borderRadius:14, border:`1px solid ${L.s200}`, padding:14, marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <p style={{ margin:0, fontSize:12, fontWeight:700, color:L.s700 }}>الأسئلة ({questions.length})</p>
          <LBtn sm onClick={addQ}>＋ سؤال</LBtn>
        </div>
        {questions.map((q,i)=>(
          <div key={q.id} style={{ background:L.s50, borderRadius:10, padding:10, marginBottom:8, border:`1px solid ${L.s100}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <span style={{ fontSize:11, fontWeight:700, color:L.s400 }}>{i+1}</span>
              <input value={q.label} onChange={e=>updQ(q.id,"label",e.target.value)}
                placeholder="نص السؤال..." style={{ ...iSt({flex:1}), marginBottom:0, fontSize:12 }}/>
              {questions.length>1 && (
                <button onClick={()=>removeQ(q.id)} style={{ background:"none", border:"none", color:L.danger, cursor:"pointer", fontSize:16, flexShrink:0 }}>🗑</button>
              )}
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <select value={q.type} onChange={e=>updQ(q.id,"type",e.target.value)}
                style={{ ...iSt({flex:1}), marginBottom:0, fontSize:11, padding:"6px 8px" }}>
                {Q_TYPES.map(t=><option key={t.v} value={t.v}>{t.icon} {t.l}</option>)}
              </select>
              <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, cursor:"pointer" }}>
                <input type="checkbox" checked={!!q.required} onChange={e=>updQ(q.id,"required",e.target.checked)} style={{width:13,height:13}}/>مطلوب
              </label>
            </div>
            {q.type==="select" && (
              <textarea value={(q.options||[]).join("\n")} rows={2}
                onChange={e=>updQ(q.id,"options",e.target.value.split("\n").filter(Boolean))}
                placeholder="خيار 1\nخيار 2" style={{ ...iSt({marginTop:6}), resize:"none", fontSize:11 }}/>
            )}
          </div>
        ))}
      </div>

      {isEdit && (
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>ملاحظة التغيير</label>
          <input value={changeNote} onChange={e=>setChangeNote(e.target.value)} style={iSt()}/>
        </div>
      )}

      <div style={{ display:"flex", gap:8 }}>
        <LBtn variant="secondary" onClick={onClose} style={{ flex:1 }}>إلغاء</LBtn>
        <LBtn onClick={save} loading={saving} style={{ flex:2 }}>💾 {isEdit?"حفظ التعديلات":"إضافة للمكتبة"}</LBtn>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════
// SECTION LIBRARY TAB
// ══════════════════════════════════════════════════════
function SectionLibraryTab({ categories, user, onInsert }) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [catFilter,  setCatFilter]  = useState("");
  const [favOnly,    setFavOnly]    = useState(false);
  const [formTarget, setFormTarget] = useState(null);
  const [versionFor, setVersionFor] = useState(null);

  const load = useCallback(async()=>{
    setLoading(true);
    const{data}=await fetchLibrarySections({categoryId:catFilter||undefined,search,favoritesOnly:favOnly});
    setItems(data);setLoading(false);
  },[catFilter,search,favOnly]);

  useEffect(()=>{load();},[load]);

  async function handleDelete(id) { if(!confirm("حذف هذا القسم؟"))return; await deleteLibrarySection(id); load(); }
  async function handleFav(item) { await toggleSectionFavorite(item.id,item.is_favorite); load(); }
  async function handleDuplicate(item) {
    await saveLibrarySection({ name:item.name+" (نسخة)", categoryId:item.category_id, description:item.description, tags:item.tags, questions:deepClone(item.questions), userId:user?.id, userEmail:user?.email });
    load();
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <p style={{ margin:0, fontSize:14, fontWeight:800, color:L.s900 }}>مكتبة الأقسام</p>
          <p style={{ margin:"2px 0 0", fontSize:11, color:L.s500 }}>{items.length} قسم محفوظ</p>
        </div>
        <LBtn sm onClick={()=>setFormTarget({})}>＋ قسم جديد</LBtn>
      </div>

      <SearchInput value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في الأقسام..."/>

      <div style={{ display:"flex", gap:5, marginBottom:10, overflowX:"auto", paddingBottom:4 }}>
        <button onClick={()=>setCatFilter("")} style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", border:`1.5px solid ${!catFilter?L.e600:L.s200}`, background:!catFilter?L.e50:L.white, color:!catFilter?L.e700:L.s500 }}>الكل</button>
        <button onClick={()=>setFavOnly(p=>!p)} style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", border:`1.5px solid ${favOnly?L.gold:L.s200}`, background:favOnly?L.goldL:L.white, color:favOnly?L.gold:L.s500 }}>⭐ المفضلة</button>
        {categories.map(c=>(
          <button key={c.id} onClick={()=>setCatFilter(catFilter===c.id?"":c.id)} style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", border:`1.5px solid ${catFilter===c.id?c.color:L.s200}`, background:catFilter===c.id?`${c.color}15`:L.white, color:catFilter===c.id?c.color:L.s500 }}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {loading ? <div style={{textAlign:"center",padding:30}}><div style={{width:32,height:32,borderRadius:"50%",border:`3px solid ${L.e100}`,borderTopColor:L.e600,animation:"spin 0.7s linear infinite",margin:"0 auto"}}/></div>
      : items.length===0 ? <EmptyState icon="📂" title="لا توجد أقسام في المكتبة" sub="احفظ مجموعة أسئلة كقسم قابل للإعادة" action="＋ إضافة قسم" onAction={()=>setFormTarget({})}/>
      : items.map((item,idx)=>(
        <div key={item.id} className="lib-card lib-in"
          style={{ background:L.white, borderRadius:16, border:`1px solid ${L.s200}`,
            marginBottom:10, boxShadow:"0 2px 6px rgba(0,0,0,0.05)",
            borderRight:`3px solid ${item.library_categories?.color||L.purple}`,
            animationDelay:`${idx*0.03}s` }}>
          <div style={{ padding:"12px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:L.s900 }}>{item.name}</p>
                <p style={{ margin:"2px 0 4px", fontSize:11, color:L.s500 }}>{(item.questions||[]).length} سؤال</p>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {item.library_categories && <Tag color={item.library_categories.color} bg={`${item.library_categories.color}15`}>{item.library_categories.icon} {item.library_categories.name}</Tag>}
                  {(item.tags||[]).map(t=><Tag key={t} bg={L.s50} color={L.s400}>{t}</Tag>)}
                  {(item.variables||[]).length>0 && <Tag bg={L.e50} color={L.e700}>✨ {item.variables.length} متغير</Tag>}
                  <Tag bg={L.s50} color={L.s300}>v{item.version}</Tag>
                </div>
              </div>
              <button onClick={()=>handleFav(item)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", flexShrink:0, color:item.is_favorite?L.gold:L.s200 }}>⭐</button>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", borderTop:`1px solid ${L.s100}`, paddingTop:8 }}>
              {onInsert && <LBtn sm onClick={()=>onInsert("section", item)}>📥 إدراج الكل</LBtn>}
              <LBtn sm variant="secondary" onClick={()=>setFormTarget(item)}>✏️ تعديل</LBtn>
              <LBtn sm variant="secondary" onClick={()=>handleDuplicate(item)}>📄 نسخ</LBtn>
              <LBtn sm variant="secondary" onClick={()=>setVersionFor(item)}>🕐 الإصدارات</LBtn>
              <LBtn sm variant="danger" onClick={()=>handleDelete(item.id)}>🗑️</LBtn>
            </div>
          </div>
        </div>
      ))}

      {formTarget!==null && <SectionFormModal initial={formTarget.id?formTarget:null} categories={categories} user={user} onSaved={()=>{setFormTarget(null);load();}} onClose={()=>setFormTarget(null)}/>}
      {versionFor && <VersionHistoryModal type="section" itemId={versionFor.id} onRestore={()=>{setVersionFor(null);load();}} onClose={()=>setVersionFor(null)}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// CONDITIONS TAB
// ══════════════════════════════════════════════════════
function ConditionsTab({ categories, user }) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [formOpen,   setFormOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [formName,   setFormName]   = useState("");
  const [formDesc,   setFormDesc]   = useState("");
  const [formCat,    setFormCat]    = useState("");
  const [formGate,   setFormGate]   = useState("");
  const [formValue,  setFormValue]  = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  const load = useCallback(async()=>{
    setLoading(true);
    const{data}=await fetchLibraryConditions({search});
    setItems(data);setLoading(false);
  },[search]);
  useEffect(()=>{load();},[load]);

  function openForm(item=null) {
    setEditTarget(item);
    setFormName(item?.name||"");setFormDesc(item?.description||"");setFormCat(item?.category_id||"");
    setFormGate(item?.condition_data?.gate_question_label||"");setFormValue(item?.condition_data?.gate_required_value||"");
    setFormOpen(true);
  }

  async function save() {
    if (!formName.trim()) { setError("الاسم مطلوب"); return; }
    setSaving(true); setError("");
    const payload = { name:formName.trim(), categoryId:formCat, description:formDesc, tags:[], conditionData:{ gate_question_label:formGate, gate_required_value:formValue }, userId:user?.id, userEmail:user?.email };
    const { error:err } = editTarget
      ? await updateLibraryCondition(editTarget.id, { name:payload.name, category_id:payload.categoryId, description:payload.description, condition_data:payload.conditionData })
      : await saveLibraryCondition(payload);
    setSaving(false);
    if (err) { setError("فشل الحفظ"); return; }
    setFormOpen(false); load();
  }

  async function handleDelete(id) { if(!confirm("حذف هذا الشرط؟"))return; await deleteLibraryCondition(id); load(); }
  async function handleFav(item) { await toggleConditionFavorite(item.id,item.is_favorite); load(); }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div><p style={{ margin:0, fontSize:14, fontWeight:800, color:L.s900 }}>قوالب الشروط</p><p style={{ margin:"2px 0 0", fontSize:11, color:L.s500 }}>{items.length} قالب</p></div>
        <LBtn sm onClick={()=>openForm()}>＋ شرط جديد</LBtn>
      </div>
      <SearchInput value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في الشروط..."/>
      {loading ? <div style={{textAlign:"center",padding:30}}><div style={{width:32,height:32,borderRadius:"50%",border:`3px solid ${L.e100}`,borderTopColor:L.e600,animation:"spin 0.7s linear infinite",margin:"0 auto"}}/></div>
      : items.length===0 ? <EmptyState icon="🔀" title="لا توجد قوالب شروط" sub="احفظ منطق التفريع لإعادة استخدامه" action="＋ إضافة شرط" onAction={()=>openForm()}/>
      : items.map((item,idx)=>(
        <div key={item.id} className="lib-card lib-in" style={{ background:L.white, borderRadius:16, border:`1px solid ${L.s200}`, marginBottom:10, boxShadow:"0 2px 6px rgba(0,0,0,0.05)", borderRight:`3px solid ${L.warn}`, animationDelay:`${idx*0.03}s` }}>
          <div style={{ padding:"12px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:L.s900 }}>{item.name}</p>
                {item.description && <p style={{ margin:"2px 0 0", fontSize:11, color:L.s500 }}>{item.description}</p>}
                {item.condition_data?.gate_question_label && (
                  <div style={{ marginTop:6, background:L.warnBg, borderRadius:8, padding:"6px 10px" }}>
                    <p style={{ margin:0, fontSize:11, color:L.warn }}>
                      🚪 إذا: <strong>{item.condition_data.gate_question_label}</strong> = <strong>{item.condition_data.gate_required_value}</strong>
                    </p>
                  </div>
                )}
              </div>
              <button onClick={()=>handleFav(item)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:item.is_favorite?L.gold:L.s200 }}>⭐</button>
            </div>
            <div style={{ display:"flex", gap:6, borderTop:`1px solid ${L.s100}`, paddingTop:8 }}>
              <LBtn sm variant="secondary" onClick={()=>openForm(item)}>✏️ تعديل</LBtn>
              <LBtn sm variant="danger" onClick={()=>handleDelete(item.id)}>🗑️</LBtn>
            </div>
          </div>
        </div>
      ))}

      {formOpen && (
        <Modal title={editTarget?"تعديل الشرط":"قالب شرط جديد"} onClose={()=>setFormOpen(false)}>
          {error && <div style={{ background:L.dangerBg, borderRadius:10, padding:"10px 14px", fontSize:12, color:L.danger, marginBottom:12 }}>{error}</div>}
          <div style={{ marginBottom:10 }}><label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الاسم *</label><input value={formName} onChange={e=>setFormName(e.target.value)} style={iSt()}/></div>
          <div style={{ marginBottom:10 }}><label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الفئة</label><select value={formCat} onChange={e=>setFormCat(e.target.value)} style={{ ...iSt(), background:L.white }}><option value="">— بدون فئة —</option>{categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
          <div style={{ background:L.warnBg, border:`1px solid ${L.warn}30`, borderRadius:12, padding:14, marginBottom:12 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:L.warn }}>🚪 منطق الشرط</p>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>نص السؤال الشرطي</label>
            <input value={formGate} onChange={e=>setFormGate(e.target.value)} placeholder="مثال: هل يوجد نظام حضور إلكتروني؟" style={{ ...iSt(), marginBottom:8 }}/>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الإجابة المطلوبة للمتابعة</label>
            <input value={formValue} onChange={e=>setFormValue(e.target.value)} placeholder="مثال: نعم" style={iSt()}/>
          </div>
          <div style={{ marginBottom:14 }}><label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>الوصف</label><textarea value={formDesc} onChange={e=>setFormDesc(e.target.value)} rows={2} style={{ ...iSt(), resize:"vertical" }}/></div>
          <div style={{ display:"flex", gap:8 }}>
            <LBtn variant="secondary" onClick={()=>setFormOpen(false)} style={{ flex:1 }}>إلغاء</LBtn>
            <LBtn onClick={save} loading={saving} style={{ flex:2 }}>💾 حفظ الشرط</LBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SMART VARIABLES TAB
// ══════════════════════════════════════════════════════
function SmartVariablesTab() {
  const [preview, setPreview] = useState({
    school_name:"مدرسة الأمل الابتدائية", school_stage:"الابتدائية",
    sector:"شمال جدة", district:"حي النزهة",
    principal_name:"أحمد محمد العمري", supervisor_name:"سارة عبدالله",
    administrator_name:"خالد الزهراني",
  });
  const [sampleText, setSampleText] = useState("مرحباً بك في {{school_name}} — المرحلة: {{school_stage}} — يوم {{today}}");
  const resolved = resolveVariables(sampleText, preview);

  return (
    <div>
      <div style={{ background:L.e50, border:`1px solid ${L.e100}`, borderRadius:16, padding:16, marginBottom:16 }}>
        <p style={{ margin:"0 0 10px", fontSize:14, fontWeight:800, color:L.e700 }}>✨ المتغيرات الذكية</p>
        <p style={{ margin:0, fontSize:12, color:L.s500, lineHeight:1.7 }}>
          استخدم هذه المتغيرات في نصوص الأسئلة. تُستبدل تلقائياً عند فتح الاستبيان.
        </p>
      </div>

      <div style={{ background:L.white, borderRadius:16, border:`1px solid ${L.s200}`, overflow:"hidden", marginBottom:16 }}>
        <div style={{ padding:"12px 16px", background:L.s50, borderBottom:`1px solid ${L.s100}` }}>
          <p style={{ margin:0, fontSize:13, fontWeight:700, color:L.s700 }}>قائمة المتغيرات</p>
        </div>
        {SMART_VARIABLES.map((v,i)=>(
          <div key={v.key} style={{ padding:"10px 16px", borderBottom:i<SMART_VARIABLES.length-1?`1px solid ${L.s100}`:"none", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <code style={{ background:L.e50, color:L.e700, padding:"2px 8px", borderRadius:6, fontSize:12, fontFamily:"monospace" }}>{v.key}</code>
              <span style={{ fontSize:12, color:L.s700, marginRight:10 }}>{v.label}</span>
            </div>
            <span style={{ fontSize:11, color:L.s400 }}>{v.example}</span>
          </div>
        ))}
      </div>

      {/* Live Preview */}
      <div style={{ background:L.white, borderRadius:16, border:`1px solid ${L.s200}`, padding:16 }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:800, color:L.s900 }}>🔍 معاينة تفاعلية</p>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:L.s700, marginBottom:5 }}>نص يحتوي متغيرات:</label>
        <textarea value={sampleText} onChange={e=>setSampleText(e.target.value)} rows={3}
          style={{ ...iSt(), resize:"vertical", marginBottom:12, fontFamily:"monospace", fontSize:12 }}/>
        <div style={{ background:L.e50, border:`1px solid ${L.e100}`, borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
          <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:700, color:L.e700 }}>النص بعد الاستبدال:</p>
          <p style={{ margin:0, fontSize:13, color:L.s900, lineHeight:1.7 }}>{resolved}</p>
        </div>
        <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:L.s700 }}>قيم المعاينة:</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {Object.entries(preview).map(([k,v])=>(
            <div key={k}>
              <label style={{ display:"block", fontSize:10, color:L.s400, marginBottom:2 }}>
                {"{{"}{k}{"}}"}
              </label>
              <input value={v} onChange={e=>setPreview(p=>({...p,[k]:e.target.value}))}
                style={{ ...iSt({ padding:"6px 8px", fontSize:11 }), marginBottom:0 }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// CATEGORIES MANAGER
// ══════════════════════════════════════════════════════
function CategoriesManager({ categories, onReload }) {
  const [name,    setName]    = useState("");
  const [icon,    setIcon]    = useState("📁");
  const [color,   setColor]   = useState("#059669");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const { error:err } = await createCategory({ name:name.trim(), icon, color, sort_order:categories.length+1 });
    setSaving(false);
    if (err) { setError("الاسم موجود مسبقاً أو حدث خطأ"); return; }
    setName(""); onReload();
  }

  return (
    <div>
      <p style={{ margin:"0 0 12px", fontSize:14, fontWeight:800, color:L.s900 }}>إدارة الفئات</p>
      <div style={{ background:L.white, borderRadius:16, border:`1px solid ${L.s200}`, overflow:"hidden", marginBottom:14 }}>
        {categories.map((c,i)=>(
          <div key={c.id} style={{ padding:"10px 14px", borderBottom:i<categories.length-1?`1px solid ${L.s100}`:"none", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:18 }}>{c.icon}</span>
            <span style={{ flex:1, fontSize:13, color:L.s900 }}>{c.name}</span>
            <div style={{ width:12, height:12, borderRadius:"50%", background:c.color }}/>
          </div>
        ))}
      </div>
      {error && <div style={{ background:L.dangerBg, borderRadius:10, padding:"8px 12px", fontSize:12, color:L.danger, marginBottom:10 }}>{error}</div>}
      <div style={{ background:L.white, borderRadius:14, border:`1px solid ${L.s200}`, padding:14 }}>
        <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:L.s700 }}>＋ فئة جديدة</p>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <input value={icon} onChange={e=>setIcon(e.target.value)} placeholder="🎓" style={{ ...iSt({width:50}), textAlign:"center", marginBottom:0 }}/>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="اسم الفئة" style={{ ...iSt({flex:1}), marginBottom:0 }}/>
          <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{ width:40, height:40, border:"none", borderRadius:8, cursor:"pointer", padding:2 }}/>
        </div>
        <LBtn onClick={save} loading={saving} sm>إضافة الفئة</LBtn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// IMPORT/EXPORT TAB
// ══════════════════════════════════════════════════════
function ImportExportTab({ user }) {
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState("");

  async function handleExportJSON() {
    const [{ data:qs }, { data:ss }, { data:cs }] = await Promise.all([
      fetchLibraryQuestions(), fetchLibrarySections(), fetchLibraryConditions()
    ]);
    exportLibraryToJSON(qs, ss, cs);
  }

  async function handleExportExcel() {
    const [{ data:qs }, { data:ss }] = await Promise.all([fetchLibraryQuestions(), fetchLibrarySections()]);
    exportLibraryToExcel(qs, ss);
  }

  async function handleImport(file) {
    if (!file) return;
    setImporting(true); setError(""); setResult(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await importLibraryFromJSON(json, user?.id, user?.email);
      setResult(res);
    } catch(e) {
      setError("فشل قراءة الملف: " + e.message);
    }
    setImporting(false);
  }

  return (
    <div>
      <p style={{ margin:"0 0 14px", fontSize:14, fontWeight:800, color:L.s900 }}>استيراد وتصدير المكتبة</p>

      <div style={{ background:L.white, borderRadius:16, border:`1px solid ${L.s200}`, padding:16, marginBottom:12 }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:L.s700 }}>📤 تصدير</p>
        <div style={{ display:"flex", gap:8 }}>
          <LBtn onClick={handleExportJSON} style={{ flex:1 }}>📄 تصدير JSON</LBtn>
          <LBtn variant="secondary" onClick={handleExportExcel} style={{ flex:1 }}>📊 تصدير Excel</LBtn>
        </div>
      </div>

      <div style={{ background:L.white, borderRadius:16, border:`1px solid ${L.s200}`, padding:16 }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:L.s700 }}>📥 استيراد من JSON</p>
        {error && <div style={{ background:L.dangerBg, borderRadius:10, padding:"8px 12px", fontSize:12, color:L.danger, marginBottom:10 }}>{error}</div>}
        {result && (
          <div style={{ background:L.successBg, border:`1px solid ${L.success}30`, borderRadius:12, padding:14, marginBottom:12 }}>
            <p style={{ margin:"0 0 6px", fontSize:13, fontWeight:700, color:L.success }}>✅ تم الاستيراد</p>
            <p style={{ margin:0, fontSize:12, color:L.s500 }}>أسئلة: {result.questions} · أقسام: {result.sections} · شروط: {result.conditions}</p>
            {result.errors.length > 0 && <p style={{ margin:"4px 0 0", fontSize:11, color:L.warn }}>تعذر استيراد: {result.errors.join("، ")}</p>}
          </div>
        )}
        <label style={{ display:"block", padding:"20px", border:`2px dashed ${L.s200}`, borderRadius:12, textAlign:"center", cursor:"pointer", background:L.s50 }}>
          <input type="file" accept=".json" onChange={e=>handleImport(e.target.files?.[0])} style={{ display:"none" }}/>
          {importing ? <div style={{ width:24, height:24, borderRadius:"50%", border:`3px solid ${L.e100}`, borderTopColor:L.e600, animation:"spin 0.7s linear infinite", margin:"0 auto" }}/> : <>
            <div style={{ fontSize:28, marginBottom:6 }}>📂</div>
            <p style={{ margin:0, fontSize:13, color:L.s500 }}>اختر ملف JSON للاستيراد</p>
          </>}
        </label>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MAIN CONTENT LIBRARY COMPONENT
// ══════════════════════════════════════════════════════
export default function ContentLibrary({ user, onInsertQuestion, onInsertSection }) {
  const [activeTab,  setActiveTab]  = useState("questions");
  const [categories, setCategories] = useState([]);
  const [catLoaded,  setCatLoaded]  = useState(false);

  const loadCategories = useCallback(async()=>{
    const{data}=await fetchCategories();
    setCategories(data); setCatLoaded(true);
  },[]);

  useEffect(()=>{ loadCategories(); },[loadCategories]);

  function handleInsert(type, item) {
    if (type==="question" && onInsertQuestion) onInsertQuestion(item.question_data);
    if (type==="section"  && onInsertSection)  onInsertSection(item.questions);
  }

  const TABS = [
    { id:"questions",  label:"❓ الأسئلة" },
    { id:"sections",   label:"📂 الأقسام" },
    { id:"conditions", label:"🔀 الشروط" },
    { id:"variables",  label:"✨ المتغيرات" },
    { id:"categories", label:"🏷️ الفئات" },
    { id:"io",         label:"📦 استيراد/تصدير" },
  ];

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:18, color:L.s900, fontWeight:800 }}>مكتبة المحتوى</h2>
        <p style={{ margin:"2px 0 0", fontSize:12, color:L.s500 }}>أسئلة · أقسام · شروط · متغيرات ذكية</p>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", background:L.s100, borderRadius:14, padding:4, marginBottom:16, gap:2, overflowX:"auto" }}>
        {TABS.map(tab=>{
          const isActive = activeTab===tab.id;
          return (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
              flex:"0 0 auto", padding:"8px 10px", border:"none",
              background:isActive?L.white:"transparent",
              cursor:"pointer", fontFamily:"inherit", fontSize:11,
              fontWeight:isActive?700:500, color:isActive?L.e700:L.s500,
              borderRadius:10, boxShadow:isActive?"0 1px 4px rgba(0,0,0,0.08)":"none",
              whiteSpace:"nowrap", transition:"all 0.15s",
            }}>{tab.label}</button>
          );
        })}
      </div>

      {/* Tab content */}
      {!catLoaded ? <div style={{textAlign:"center",padding:40}}><div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${L.e100}`,borderTopColor:L.e600,animation:"spin 0.7s linear infinite",margin:"0 auto"}}/></div>
      : activeTab==="questions"  ? <QuestionLibraryTab categories={categories} user={user} onInsert={handleInsert}/>
      : activeTab==="sections"   ? <SectionLibraryTab  categories={categories} user={user} onInsert={handleInsert}/>
      : activeTab==="conditions" ? <ConditionsTab       categories={categories} user={user}/>
      : activeTab==="variables"  ? <SmartVariablesTab/>
      : activeTab==="categories" ? <CategoriesManager  categories={categories} onReload={loadCategories}/>
      : <ImportExportTab user={user}/>}
    </div>
  );
}

