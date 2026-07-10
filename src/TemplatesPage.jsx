import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ErrorBanner, logAction } from "./lib.jsx";
import { SURVEY_TYPE_LABELS } from "./SurveyService.jsx";
import { genId, deepClone } from "./utils.js";

// Enterprise styles — Phase 3, matches Dashboard/SurveysList/Directory 
if (typeof document !== "undefined" && !document.getElementById("templates-enterprise-styles")) {
 const _s = document.createElement("style");
 _s.id = "templates-enterprise-styles";
 _s.textContent = `
 .tmpl-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
 .tmpl-card:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.10) !important; }
 .tmpl-card:active { transform: scale(0.99); }
 .tmpl-btn { transition: all 0.12s ease; }
 .tmpl-btn:active { transform: scale(0.94); }
 .tmpl-search:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; outline: none; }
 @keyframes tmpl-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
 .tmpl-in { animation: tmpl-in 0.22s ease both; }
 @keyframes spin { to { transform: rotate(360deg) } }

 /* Desktop grid — shown ≥1024px, single column below */
 .tmpl-grid {
 display: grid;
 grid-template-columns: 1fr;
 gap: 12px;
 }
 @media (min-width: 1024px) {
 .tmpl-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
 }
 @media (min-width: 1440px) {
 .tmpl-grid { grid-template-columns: repeat(3, 1fr); }
 }
 `;
 document.head.appendChild(_s);
}

const TT = {
 e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
 e100:"#D1FAE5",e50:"#ECFDF5",
 gold:"#C9A84C",goldL:"#FEF3C7",
 s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
 s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
 white:"#FFFFFF",bg:"#F0F4F8",
 danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
 success:"#059669",successBg:"#ECFDF5",purple:"#7B2D8B",purpleBg:"#F5EEFA",amber:"#B7791F",
};

// 
// HOOKS — unchanged
// 
function useTemplates() {
 const [templates, setTemplates] = useState([]);
 const [loading, setLoading] = useState(true);
 const load = useCallback(async () => {
 setLoading(true);
 const { data } = await supabase.from("survey_templates").select("*, template_categories(name)").order("created_at", { ascending: false });
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

// 
// HELPERS — unchanged
// 
function estimateMinutes(questions) {
 if (!questions?.length) return 1;
 const total = questions.reduce((acc, q) => {
 if (q.type === "textarea") return acc + 2;
 if (q.type === "file") return acc + 1.5;
 return acc + 0.5;
 }, 0);
 return Math.max(1, Math.ceil(total));
}

const TYPE_LABELS = {
 text:"نص قصير", textarea:"نص طويل", number:"رقم",
 select:"اختيار", rating:"تقييم", file:"ملف",
};

const SCOPE_CONFIG = {
 system: { label:" عام", color:TT.success, bg:TT.successBg, desc:"متاح لجميع المستخدمين" },
 personal: { label:"شخصي", color:TT.purple, bg:TT.purpleBg, desc:"خاص بك فقط" },
};

const TYPE_COLORS = {
 school: { color:TT.e700, bg:TT.e50 },
 supervisor: { color:TT.purple, bg:TT.purpleBg},
 administrator: { color:TT.amber, bg:TT.warnBg },
 open: { color:TT.gold, bg:TT.goldL },
};

// 
// PREVIEW SHEET — logic unchanged
// 
function TemplatePreviewSheet({ template, onUse, onClose }) {
 const qs = template.questions || [];
 const minutes = estimateMinutes(qs);
 const scope = SCOPE_CONFIG[template.scope] || SCOPE_CONFIG.personal;
 const tc = TYPE_COLORS[template.survey_type] || TYPE_COLORS.school;

 const typeCounts = qs.reduce((acc, q) => {
 const label = TYPE_LABELS[q.type] || q.type;
 acc[label] = (acc[label] || 0) + 1;
 return acc;
 }, {});

 return (
 <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200,
 display:"flex", alignItems:"flex-end", direction:"rtl" }}
 onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
 <div style={{ width:"100%", maxWidth:560, margin:"0 auto", background:TT.white, borderRadius:"24px 24px 0 0",
 maxHeight:"90vh", overflowY:"auto", paddingBottom:32 }}>

 <div style={{ display:"flex", justifyContent:"center", padding:"14px 0 4px" }}>
 <div style={{ width:44, height:4, background:TT.s200, borderRadius:4 }}/>
 </div>

 <div style={{ padding:"12px 18px 0" }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
 <div style={{ flex:1 }}>
 <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
 <span style={{ background:tc.bg, color:tc.color, border:`1px solid ${tc.color}30`,
 borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700 }}>
 {SURVEY_TYPE_LABELS[template.survey_type] || " مدارس"}
 </span>
 <span style={{ background:scope.bg, color:scope.color, border:`1px solid ${scope.color}30`,
 borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700 }}>
 {scope.label}
 </span>
 </div>
 <h3 style={{ margin:"0 0 4px", fontSize:18, color:TT.s900, fontWeight:800 }}>{template.title}</h3>
 {template.description && (
 <p style={{ margin:0, fontSize:13, color:TT.s500, lineHeight:1.6 }}>{template.description}</p>
 )}
 </div>
 <button onClick={onClose} style={{ background:TT.s100, border:"none", borderRadius:10,
 width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center",
 fontSize:18, cursor:"pointer", color:TT.s500, flexShrink:0, marginRight:6 }}></button>
 </div>

 <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
 {[
 { i:"", l:"الأسئلة", v:`${qs.length}` },
 { i:"⏱", l:"الوقت", v:`${minutes} د` },
 { i:"", l:"الفئة", v: template.template_categories?.name || "—" },
 ].map((x, i) => (
 <div key={i} style={{ background:TT.s50, borderRadius:12, padding:"12px 8px", textAlign:"center", border:`1px solid ${TT.s100}` }}>
 <div style={{ fontSize:20, marginBottom:4 }}>{x.i}</div>
 <div style={{ fontSize:18, fontWeight:800, color:TT.s900 }}>{x.v}</div>
 <div style={{ fontSize:10, color:TT.s400, marginTop:2 }}>{x.l}</div>
 </div>
 ))}
 </div>

 {Object.keys(typeCounts).length > 0 && (
 <div style={{ marginBottom:14 }}>
 <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:TT.s700 }}>أنواع الأسئلة</p>
 <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
 {Object.entries(typeCounts).map(([type, count]) => (
 <span key={type} style={{ background:TT.e50, color:TT.e700,
 border:`1px solid ${TT.e100}`, borderRadius:20, padding:"4px 12px",
 fontSize:11, fontWeight:700 }}>{type} ({count})</span>
 ))}
 </div>
 </div>
 )}

 {qs.length > 0 && (
 <div style={{ marginBottom:16 }}>
 <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:TT.s700 }}>الأسئلة</p>
 <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
 {qs.map((q, i) => (
 <div key={i} style={{ background:TT.s50, borderRadius:10, padding:"10px 14px",
 display:"flex", alignItems:"flex-start", gap:10,
 border:`1px solid ${TT.s100}` }}>
 <span style={{ background:TT.e50, color:TT.e700, borderRadius:8,
 width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center",
 fontSize:11, fontWeight:800, flexShrink:0 }}>{i+1}</span>
 <div style={{ flex:1 }}>
 <p style={{ margin:0, fontSize:13, color:TT.s900, lineHeight:1.5, fontWeight:q.required?600:400 }}>
 {q.label || "سؤال بدون نص"}
 {q.required && <span style={{ color:TT.danger, marginRight:4 }}>*</span>}
 </p>
 <p style={{ margin:"2px 0 0", fontSize:10, color:TT.s400 }}>{TYPE_LABELS[q.type] || q.type}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 <button onClick={onUse} style={{
 width:"100%", padding:"14px 24px",
 background:`linear-gradient(135deg,${TT.e600},${TT.e800})`,
 color:"#fff", border:"none", borderRadius:14,
 fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
 boxShadow:`0 4px 16px ${TT.e600}40`,
 }}>استخدام هذا القالب</button>
 </div>
 </div>
 </div>
 );
}

// 
// SAVE AS TEMPLATE SHEET — logic unchanged
// 
export function SaveAsTemplateSheet({ survey, user, isAdmin, onSaved, onClose }) {
 const { categories } = useCategories();
 const [title, setTitle] = useState(survey.title || "");
 const [desc, setDesc] = useState(survey.description || "");
 const [categoryId, setCategoryId] = useState("");
 const [scope, setScope] = useState("personal");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 const [done, setDone] = useState(false);

 async function save() {
 if (!title.trim()) { setError("اسم القالب مطلوب"); return; }
 setSaving(true); setError("");
 const questions = (survey.questions || []).map(q => ({
 ...deepClone(q), id:undefined, survey_id:undefined, order_index:undefined,
 }));
 const { error: err } = await supabase.from("survey_templates").insert({
 title:title.trim(), description:desc.trim()||null, category_id:categoryId||null,
 survey_type:survey.survey_type||"school", scope:isAdmin?scope:"personal",
 questions, default_settings:{ response_limit:survey.response_limit||"one_per_entity" },
 created_by:user?.id,
 });
 setSaving(false);
 if (err) { setError("فشل الحفظ: "+err.message); return; }
 logAction({ user, action:"create", table:"survey_templates", recordLabel:title });
 setDone(true);
 }

 const inputStyle = { width:"100%", padding:"12px 14px", border:`1.5px solid ${TT.s200}`,
 borderRadius:12, fontSize:14, fontFamily:"inherit", direction:"rtl",
 boxSizing:"border-box", outline:"none", background:TT.s50, color:TT.s900, transition:"border-color 0.2s" };

 if (done) return (
 <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200,
 display:"flex", alignItems:"center", justifyContent:"center", padding:24, direction:"rtl" }}>
 <div style={{ background:TT.white, borderRadius:24, padding:32, textAlign:"center", maxWidth:320, width:"100%",
 boxShadow:"0 24px 64px rgba(0,0,0,0.2)" }}>
 <div style={{ width:72, height:72, borderRadius:"50%", background:TT.successBg,
 display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, margin:"0 auto 16px" }}></div>
 <h3 style={{ margin:"0 0 8px", color:TT.s900, fontWeight:800 }}>تم حفظ القالب</h3>
 <p style={{ margin:"0 0 24px", fontSize:13, color:TT.s500 }}>يمكنك الآن استخدامه عند إنشاء استبيانات جديدة</p>
 <button onClick={onSaved} style={{ width:"100%", padding:"13px", background:`linear-gradient(135deg,${TT.e600},${TT.e800})`,
 color:"#fff", border:"none", borderRadius:12, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>تم</button>
 </div>
 </div>
 );

 return (
 <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200,
 display:"flex", alignItems:"flex-end", direction:"rtl" }}
 onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
 <div style={{ width:"100%", maxWidth:560, margin:"0 auto", background:TT.white, borderRadius:"24px 24px 0 0",
 maxHeight:"85vh", overflowY:"auto", paddingBottom:32 }}>
 <div style={{ display:"flex", justifyContent:"center", padding:"14px 0 4px" }}>
 <div style={{ width:44, height:4, background:TT.s200, borderRadius:4 }}/>
 </div>
 <div style={{ padding:"8px 18px 0" }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
 <h3 style={{ margin:0, fontSize:17, color:TT.s900, fontWeight:800 }}>حفظ كقالب</h3>
 <button onClick={onClose} style={{ background:TT.s100, border:"none", borderRadius:10,
 width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center",
 fontSize:16, cursor:"pointer", color:TT.s500 }}></button>
 </div>
 <div style={{ background:TT.e50, borderRadius:12, padding:"10px 14px", marginBottom:16, border:`1px solid ${TT.e100}` }}>
 <p style={{ margin:0, fontSize:12, color:TT.e700, lineHeight:1.7 }}>
 سيتم نسخ <strong>الأسئلة والإعدادات فقط</strong> — لن تُنسخ الردود أو الإحصائيات.
 </p>
 </div>
 <div style={{ marginBottom:12 }}>
 <label style={{ display:"block", fontSize:12, fontWeight:700, color:TT.s700, marginBottom:6 }}>
 اسم القالب <span style={{ color:TT.danger }}>*</span>
 </label>
 <input value={title} onChange={e=>setTitle(e.target.value)} style={inputStyle}/>
 </div>
 <div style={{ marginBottom:12 }}>
 <label style={{ display:"block", fontSize:12, fontWeight:700, color:TT.s700, marginBottom:6 }}>وصف</label>
 <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={{ ...inputStyle, resize:"vertical" }}/>
 </div>
 <div style={{ marginBottom:12 }}>
 <label style={{ display:"block", fontSize:12, fontWeight:700, color:TT.s700, marginBottom:6 }}>الفئة</label>
 <select value={categoryId} onChange={e=>setCategoryId(e.target.value)} style={{ ...inputStyle, background:TT.white }}>
 <option value="">— اختر فئة —</option>
 {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 </div>
 {isAdmin && (
 <div style={{ marginBottom:16 }}>
 <label style={{ display:"block", fontSize:12, fontWeight:700, color:TT.s700, marginBottom:8 }}>نطاق القالب</label>
 <div style={{ display:"flex", gap:8 }}>
 {Object.entries(SCOPE_CONFIG).map(([v,cfg])=>(
 <button key={v} onClick={()=>setScope(v)} style={{
 flex:1, padding:"10px 8px", borderRadius:12, cursor:"pointer", fontFamily:"inherit",
 border:`2px solid ${scope===v?cfg.color:TT.s200}`,
 background:scope===v?cfg.bg:TT.white, color:scope===v?cfg.color:TT.s500,
 fontWeight:scope===v?700:400, textAlign:"center", transition:"all 0.15s" }}>
 <div style={{ fontSize:13 }}>{cfg.label}</div>
 <div style={{ fontSize:10, marginTop:2 }}>{cfg.desc}</div>
 </button>
 ))}
 </div>
 </div>
 )}
 {error && <div style={{ background:TT.dangerBg, border:"1px solid #FECACA", borderRadius:10, padding:"10px 14px", fontSize:13, color:TT.danger, marginBottom:12, display:"flex", gap:8 }}><span></span>{error}</div>}
 <button onClick={save} disabled={saving} style={{
 width:"100%", padding:"14px", background:saving?`${TT.e600}80`:`linear-gradient(135deg,${TT.e600},${TT.e800})`,
 color:"#fff", border:"none", borderRadius:14, fontSize:15, fontWeight:800,
 cursor:saving?"not-allowed":"pointer", fontFamily:"inherit",
 boxShadow:saving?"none":`0 4px 16px ${TT.e600}40`,
 }}>{saving?"جاري الحفظ...":"حفظ القالب"}</button>
 </div>
 </div>
 </div>
 );
}

// 
// TEMPLATE CARD — logic unchanged
// 
function TemplateCard({ template, currentUserId, isAdmin, onPreview, onUse, onEdit, onDuplicate, onToggleStatus }) {
 const qs = template.questions || [];
 const minutes = estimateMinutes(qs);
 const isOwner = template.created_by === currentUserId;
 const canEdit = isOwner || isAdmin;
 const scope = SCOPE_CONFIG[template.scope] || SCOPE_CONFIG.personal;
 const isActive = template.status === "active";
 const tc = TYPE_COLORS[template.survey_type] || TYPE_COLORS.school;

 return (
 <div className="tmpl-card tmpl-in" style={{
 background:TT.white, borderRadius:18, border:`1px solid ${TT.s200}`,
 overflow:"hidden", opacity:isActive?1:0.65,
 boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
 borderRight:`4px solid ${tc.color}`,
 display:"flex", flexDirection:"column", height:"100%",
 }}>
 <div style={{ padding:"14px 16px", flex:1, display:"flex", flexDirection:"column" }}>
 <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
 <span style={{ background:tc.bg, color:tc.color, border:`1px solid ${tc.color}30`,
 borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
 {SURVEY_TYPE_LABELS[template.survey_type] || " مدارس"}
 </span>
 <span style={{ background:scope.bg, color:scope.color, border:`1px solid ${scope.color}30`,
 borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
 {scope.label}
 </span>
 {!isActive && <span style={{ background:TT.s100, color:TT.s400, border:`1px solid ${TT.s200}`,
 borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>معطّل</span>}
 </div>

 <h3 style={{ margin:"0 0 4px", fontSize:15, color:TT.s900, fontWeight:700, lineHeight:1.4 }}>{template.title}</h3>
 {template.description && (
 <p style={{ margin:"0 0 10px", fontSize:12, color:TT.s500, lineHeight:1.5, flex:1 }}>
 {template.description.length>80 ? template.description.slice(0,80)+"..." : template.description}
 </p>
 )}

 <div style={{ display:"flex", gap:12, marginBottom:12, flexWrap:"wrap" }}>
 <span style={{ fontSize:11, color:TT.s400, display:"flex", alignItems:"center", gap:3 }}> {qs.length} سؤال</span>
 <span style={{ fontSize:11, color:TT.s400, display:"flex", alignItems:"center", gap:3 }}>⏱ {minutes} د</span>
 {template.template_categories?.name && (
 <span style={{ fontSize:11, color:TT.s400, display:"flex", alignItems:"center", gap:3 }}> {template.template_categories.name}</span>
 )}
 </div>

 <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:"auto" }}>
 <TBtn icon="" label="معاينة" onClick={()=>onPreview(template)} color={TT.e700} bg={TT.e50}/>
 {isActive && <TBtn icon="" label="استخدام" onClick={()=>onUse(template)} color="#fff" bg={TT.e600} gradient/>}
 {canEdit && <TBtn icon="" label="تعديل" onClick={()=>onEdit(template)}/>}
 {canEdit && <TBtn icon="" label="نسخ" onClick={()=>onDuplicate(template)}/>}
 {canEdit && <TBtn icon={isActive?"":""} label={isActive?"تعطيل":"تفعيل"}
 onClick={()=>onToggleStatus(template)} color={isActive?TT.danger:TT.success} bg={isActive?TT.dangerBg:TT.successBg}/>}
 </div>
 </div>
 </div>
 );
}

function TBtn({ icon, label, onClick, color, bg, gradient }) {
 return (
 <button onClick={onClick} className="tmpl-btn" style={{
 background: gradient ? `linear-gradient(135deg,${bg},#047857)` : (bg||TT.s100),
 color: color || TT.s700,
 border: `1px solid ${color&&!gradient ? color+"25" : "transparent"}`,
 borderRadius:9, padding:"7px 12px",
 fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
 display:"inline-flex", alignItems:"center", gap:5,
 boxShadow: gradient ? `0 2px 10px ${bg}50` : "none",
 }}>
 <span style={{ fontSize:13 }}>{icon}</span>{label}
 </button>
 );
}

// 
// TEMPLATE FORM — logic unchanged
// 
function TemplateFormPage({ existing, user, isAdmin, onSaved, onCancel }) {
 const { categories } = useCategories();
 const isEdit = !!existing;
 const [title, setTitle] = useState(existing?.title||"");
 const [desc, setDesc] = useState(existing?.description||"");
 const [categoryId, setCategoryId] = useState(existing?.category_id||"");
 const [scope, setScope] = useState(existing?.scope||"personal");
 const [surveyType, setSurveyType] = useState(existing?.survey_type||"school");
 const [qs, setQs] = useState(()=>{
 if(existing?.questions?.length) return existing.questions.map(q=>({...deepClone(q),id:genId(),options:q.options||[],allowedFileTypes:q.allowed_file_types||"pdf,xlsx"}));
 return [{ id:genId(), type:"text", label:"", required:true, options:[], allowedFileTypes:"pdf,xlsx" }];
 });
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");

 const upd=(id,f,v)=>setQs(p=>p.map(q=>q.id===id?{...q,[f]:v}:q));
 const removeQ=id=>setQs(p=>p.filter(q=>q.id!==id));
 const addQ=()=>setQs(p=>[...p,{id:genId(),type:"text",label:"",required:false,options:[],allowedFileTypes:"pdf,xlsx"}]);
 const types=[{v:"text",l:"نص قصير"},{v:"textarea",l:"نص طويل"},{v:"number",l:"رقم"},{v:"select",l:"اختيار"},{v:"rating",l:"تقييم"},{v:"file",l:"ملف"}];

 async function save() {
 if(!title.trim()){setError("اسم القالب مطلوب");return;}
 if(!qs.length){setError("أضف سؤالاً واحداً على الأقل");return;}
 setSaving(true); setError("");
 const questions=qs.map(q=>({type:q.type,label:q.label,required:q.required,options:deepClone(q.options||[]),allowed_file_types:q.type==="file"?(q.allowedFileTypes||"pdf,xlsx"):null}));
 const payload={title:title.trim(),description:desc.trim()||null,category_id:categoryId||null,survey_type:surveyType,scope:isAdmin?scope:"personal",questions,default_settings:{},updated_at:new Date().toISOString()};
 let err;
 if(isEdit){({error:err}=await supabase.from("survey_templates").update(payload).eq("id",existing.id));}
 else{({error:err}=await supabase.from("survey_templates").insert({...payload,created_by:user?.id}));}
 setSaving(false);
 if(err){setError("فشل الحفظ: "+err.message);return;}
 logAction({user,action:isEdit?"update":"create",table:"survey_templates",recordLabel:title});
 onSaved();
 }

 const inputStyle={width:"100%",padding:"11px 13px",border:`1.5px solid ${TT.s200}`,borderRadius:12,fontSize:14,fontFamily:"inherit",direction:"rtl",boxSizing:"border-box",outline:"none",background:TT.s50,color:TT.s900};

 return (
 <div style={{ direction:"rtl", maxWidth:760, margin:"0 auto" }}>
 <button onClick={onCancel} style={{ background:"none", border:"none", color:TT.e700, fontSize:14, cursor:"pointer", padding:"0 0 14px", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>إلغاء</button>
 <h1 style={{ margin:"0 0 18px", fontSize:20, color:TT.s900, fontWeight:800, letterSpacing:"-0.02em" }}>{isEdit?"تعديل القالب":"قالب جديد"}</h1>

 <div style={{ background:TT.white, borderRadius:18, border:`1px solid ${TT.s200}`, padding:18, marginBottom:14, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
 <p style={{ margin:"0 0 14px", fontSize:13, fontWeight:700, color:TT.s700 }}>معلومات القالب</p>
 <div style={{ marginBottom:12 }}>
 <label style={{ display:"block", fontSize:12, fontWeight:700, color:TT.s700, marginBottom:6 }}>اسم القالب <span style={{ color:TT.danger }}>*</span></label>
 <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: استبيان رضا أولياء الأمور" style={inputStyle}/>
 </div>
 <div style={{ marginBottom:12 }}>
 <label style={{ display:"block", fontSize:12, fontWeight:700, color:TT.s700, marginBottom:6 }}>وصف</label>
 <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={{ ...inputStyle, resize:"vertical" }}/>
 </div>
 <div style={{ marginBottom:12 }}>
 <label style={{ display:"block", fontSize:12, fontWeight:700, color:TT.s700, marginBottom:6 }}>الفئة</label>
 <select value={categoryId} onChange={e=>setCategoryId(e.target.value)} style={{ ...inputStyle, background:TT.white }}>
 <option value="">— اختر فئة —</option>
 {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 </div>
 <div style={{ marginBottom:isAdmin?12:0 }}>
 <label style={{ display:"block", fontSize:12, fontWeight:700, color:TT.s700, marginBottom:8 }}>نوع المستهدف</label>
 <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
 {Object.entries(SURVEY_TYPE_LABELS).map(([v,l])=>{
 const tc2=TYPE_COLORS[v]||TYPE_COLORS.school;
 return <button key={v} onClick={()=>setSurveyType(v)} style={{ padding:"8px 14px", borderRadius:10, fontSize:12, fontFamily:"inherit", cursor:"pointer", border:`1.5px solid ${surveyType===v?tc2.color:TT.s200}`, background:surveyType===v?tc2.bg:TT.white, color:surveyType===v?tc2.color:TT.s500, fontWeight:surveyType===v?700:400 }}>{l}</button>
 })}
 </div>
 </div>
 {isAdmin && (
 <div style={{ marginTop:12 }}>
 <label style={{ display:"block", fontSize:12, fontWeight:700, color:TT.s700, marginBottom:8 }}>نطاق القالب</label>
 <div style={{ display:"flex", gap:8 }}>
 {Object.entries(SCOPE_CONFIG).map(([v,cfg])=>(
 <button key={v} onClick={()=>setScope(v)} style={{ flex:1, padding:"10px 8px", borderRadius:12, cursor:"pointer", fontFamily:"inherit", border:`2px solid ${scope===v?cfg.color:TT.s200}`, background:scope===v?cfg.bg:TT.white, color:scope===v?cfg.color:TT.s500, fontWeight:scope===v?700:400, textAlign:"center" }}>
 <div style={{ fontSize:13 }}>{cfg.label}</div>
 <div style={{ fontSize:10, marginTop:2 }}>{cfg.desc}</div>
 </button>
 ))}
 </div>
 </div>
 )}
 </div>

 {qs.map((q,i)=>(
 <div key={q.id} style={{ background:TT.white, borderRadius:16, border:`1px solid ${TT.s200}`, padding:14, marginBottom:10, borderRight:`3px solid ${TT.e600}`, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
 <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
 <span style={{ fontSize:12, fontWeight:700, color:TT.e700, background:TT.e50, borderRadius:8, padding:"3px 10px" }}>السؤال {i+1}</span>
 {qs.length>1 && <button onClick={()=>removeQ(q.id)} style={{ background:"none", border:"none", cursor:"pointer", color:TT.danger, fontSize:18 }}></button>}
 </div>
 <input value={q.label} onChange={e=>upd(q.id,"label",e.target.value)} placeholder="نص السؤال..."
 style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${TT.s200}`, borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none", marginBottom:10, background:TT.s50 }}/>
 <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
 <select value={q.type} onChange={e=>upd(q.id,"type",e.target.value)} style={{ flex:1, minWidth:140, padding:"9px 10px", border:`1.5px solid ${TT.s200}`, borderRadius:10, fontSize:13, fontFamily:"inherit", color:TT.s900, background:TT.white }}>
 {types.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
 </select>
 <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, cursor:"pointer", color:TT.s700 }}>
 <input type="checkbox" checked={q.required} onChange={e=>upd(q.id,"required",e.target.checked)} style={{width:16,height:16}}/> مطلوب
 </label>
 </div>
 {q.type==="select" && (
 <textarea value={(q.options||[]).join("\n")} onChange={e=>upd(q.id,"options",e.target.value.split("\n").filter(Boolean))} rows={3} placeholder={"خيار 1\nخيار 2\nخيار 3"}
 style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${TT.s200}`, borderRadius:10, fontSize:13, fontFamily:"inherit", direction:"rtl", resize:"none", boxSizing:"border-box", outline:"none", marginTop:8, background:TT.s50 }}/>
 )}
 {q.type==="file" && (
 <div style={{ marginTop:8 }}>
 <label style={{ display:"block", fontSize:11, fontWeight:700, color:TT.s500, marginBottom:5 }}>أنواع الملفات:</label>
 <div style={{ display:"flex", gap:10 }}>
 {[["pdf","PDF"],["xlsx","Excel"]].map(([v,l])=>(
 <label key={v} style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, cursor:"pointer" }}>
 <input type="checkbox" checked={(q.allowedFileTypes||"pdf,xlsx").includes(v)} onChange={e=>{ const cur=(q.allowedFileTypes||"pdf,xlsx").split(",").filter(Boolean); const next=e.target.checked?[...new Set([...cur,v])]:cur.filter(x=>x!==v); upd(q.id,"allowedFileTypes",next.join(",")); }} style={{width:16,height:16}}/>{l}
 </label>
 ))}
 </div>
 </div>
 )}
 </div>
 ))}

 {error && <div style={{ background:TT.dangerBg, border:"1px solid #FECACA", borderRadius:10, padding:"10px 14px", fontSize:13, color:TT.danger, marginBottom:12, display:"flex", gap:8 }}><span></span>{error}</div>}
 <div style={{ display:"flex", gap:10, marginBottom:20 }}>
 <button onClick={addQ} style={{ background:TT.e50, color:TT.e700, border:`1px solid ${TT.e100}`, borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}> سؤال</button>
 <button onClick={save} disabled={!title.trim()||saving} style={{ flex:1, background:saving||!title.trim()?`${TT.e600}70`:`linear-gradient(135deg,${TT.e600},${TT.e800})`, color:"#fff", border:"none", borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:800, cursor:saving||!title.trim()?"not-allowed":"pointer", fontFamily:"inherit" }}>
 {saving?"جاري الحفظ...":"حفظ القالب"}
 </button>
 </div>
 </div>
 );
}

// 
// MAIN TEMPLATES PAGE — Phase 3 enterprise redesign
// Logic: filtering, status toggle, duplicate — 100% unchanged.
// Adds a responsive grid (1 col mobile → 2 cols ≥1024px → 3 cols
// ≥1440px) via CSS only, replacing the single-column stack.
// 
export default function TemplatesPage({ user, isAdmin, onUseTemplate }) {
 const { templates, loading, refetch } = useTemplates();
 const { categories } = useCategories();
 const [search, setSearch] = useState("");
 const [filterCategory, setFilterCategory] = useState("");
 const [filterType, setFilterType] = useState("");
 const [filterScope, setFilterScope] = useState("");
 const [preview, setPreview] = useState(null);
 const [formTarget, setFormTarget] = useState(undefined);

 const filtered = useMemo(()=>{
 let list=templates;
 if(search.trim()){const q=search.toLowerCase();list=list.filter(t=>t.title.toLowerCase().includes(q)||(t.description||"").toLowerCase().includes(q));}
 if(filterCategory) list=list.filter(t=>t.category_id===filterCategory);
 if(filterType) list=list.filter(t=>t.survey_type===filterType);
 if(filterScope) list=list.filter(t=>t.scope===filterScope);
 return list;
 },[templates,search,filterCategory,filterType,filterScope]);

 async function toggleStatus(template) {
 const newStatus=template.status==="active"?"disabled":"active";
 await supabase.from("survey_templates").update({status:newStatus}).eq("id",template.id);
 logAction({user,action:"update",table:"survey_templates",recordLabel:`${template.title} → ${newStatus}`});
 refetch();
 }

 async function duplicate(template) {
 const{error}=await supabase.from("survey_templates").insert({title:`نسخة من ${template.title}`,description:template.description,category_id:template.category_id,survey_type:template.survey_type,scope:"personal",questions:deepClone(template.questions||[]),default_settings:deepClone(template.default_settings||{}),status:"active",created_by:user?.id});
 if(!error){logAction({user,action:"create",table:"survey_templates",recordLabel:`نسخة: ${template.title}`});refetch();}
 }

 if (formTarget !== undefined) {
 return <TemplateFormPage existing={formTarget} user={user} isAdmin={isAdmin} onSaved={()=>{setFormTarget(undefined);refetch();}} onCancel={()=>setFormTarget(undefined)}/>;
 }

 const hasFilters = search||filterCategory||filterType||filterScope;

 return (
 <div style={{ direction:"rtl" }}>
 {/* Header */}
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:12 }}>
 <div>
 <h1 style={{ margin:0, fontSize:22, color:TT.s900, fontWeight:800, letterSpacing:"-0.02em" }}>مكتبة القوالب</h1>
 <p style={{ margin:"4px 0 0", fontSize:13, color:TT.s500 }}>{templates.length} قالب</p>
 </div>
 <button onClick={()=>setFormTarget(null)} style={{
 background:`linear-gradient(135deg,${TT.e600},${TT.e800})`,
 color:"#fff", border:"none", borderRadius:10, padding:"10px 18px",
 fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
 boxShadow:`0 3px 10px ${TT.e600}35`, display:"flex", alignItems:"center", gap:6,
 }}><span style={{ fontSize:16 }}></span> قالب جديد</button>
 </div>

 {/* Search + filters bar */}
 <div style={{
 background:TT.white, borderRadius:16, border:`1px solid ${TT.s200}`,
 padding:14, marginBottom:18, boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
 }}>
 <div style={{ position:"relative", marginBottom:12 }}>
 <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}></span>
 <input className="tmpl-search" value={search} onChange={e=>setSearch(e.target.value)}
 placeholder="ابحث باسم القالب أو الوصف..."
 style={{ width:"100%", padding:"10px 40px 10px 14px", border:`1.5px solid ${TT.s200}`, borderRadius:10, fontSize:13, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", background:TT.s50, color:TT.s900, transition:"all 0.2s" }}/>
 {search && <button onClick={()=>setSearch("")} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:TT.s400, cursor:"pointer", fontSize:16 }}></button>}
 </div>

 <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:2 }}>
 <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} style={{ padding:"7px 10px", borderRadius:20, fontSize:12, fontFamily:"inherit", border:`1.5px solid ${filterCategory?TT.e600:TT.s200}`, background:TT.white, color:filterCategory?TT.e700:TT.s500, cursor:"pointer" }}>
 <option value="">كل الفئات</option>
 {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ padding:"7px 10px", borderRadius:20, fontSize:12, fontFamily:"inherit", border:`1.5px solid ${filterType?TT.e600:TT.s200}`, background:TT.white, color:filterType?TT.e700:TT.s500, cursor:"pointer" }}>
 <option value="">كل الأنواع</option>
 {Object.entries(SURVEY_TYPE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
 </select>
 <select value={filterScope} onChange={e=>setFilterScope(e.target.value)} style={{ padding:"7px 10px", borderRadius:20, fontSize:12, fontFamily:"inherit", border:`1.5px solid ${filterScope?TT.e600:TT.s200}`, background:TT.white, color:filterScope?TT.e700:TT.s500, cursor:"pointer" }}>
 <option value="">الكل</option>
 <option value="system"> عام</option>
 <option value="personal">شخصي</option>
 </select>
 {hasFilters && (
 <button onClick={()=>{setSearch("");setFilterCategory("");setFilterType("");setFilterScope("");}}
 style={{ padding:"7px 14px", borderRadius:20, fontSize:12, fontFamily:"inherit", border:`1.5px solid ${TT.danger}30`, background:TT.dangerBg, color:TT.danger, cursor:"pointer", whiteSpace:"nowrap" }}>
 مسح
 </button>
 )}
 </div>
 </div>

 {/* Content */}
 {loading ? (
 <div style={{ textAlign:"center", padding:"50px 20px" }}>
 <div style={{ width:40, height:40, borderRadius:"50%", border:`3px solid ${TT.e100}`, borderTopColor:TT.e600, animation:"spin 0.7s linear infinite", margin:"0 auto 12px" }}/>
 <p style={{ color:TT.s500, fontSize:13, margin:0 }}>جاري التحميل...</p>
 </div>
 ) : filtered.length === 0 ? (
 <div style={{ textAlign:"center", padding:"48px 20px", background:TT.white, borderRadius:20, border:`1px solid ${TT.s200}` }}>
 <div style={{ fontSize:48, marginBottom:12 }}></div>
 <p style={{ margin:"0 0 6px", fontSize:15, fontWeight:700, color:TT.s900 }}>
 {templates.length===0 ? "لا توجد قوالب بعد" : "لا توجد نتائج مطابقة"}
 </p>
 <p style={{ margin:0, fontSize:13, color:TT.s500 }}>
 {templates.length===0 ? "اضغط قالب جديد لإنشاء أول قالب" : "جرب تغيير الفلاتر"}
 </p>
 </div>
 ) : (
 <div className="tmpl-grid">
 {filtered.map((t,idx) => (
 <div key={t.id} style={{ animationDelay:`${idx*0.04}s` }}>
 <TemplateCard
 template={t} currentUserId={user?.id} isAdmin={isAdmin}
 onPreview={setPreview} onUse={onUseTemplate}
 onEdit={t=>setFormTarget(t)} onDuplicate={duplicate} onToggleStatus={toggleStatus}/>
 </div>
 ))}
 </div>
 )}

 {preview && (
 <TemplatePreviewSheet template={preview}
 onUse={()=>{onUseTemplate(preview);setPreview(null);}}
 onClose={()=>setPreview(null)}/>
 )}
 </div>
 );
}

