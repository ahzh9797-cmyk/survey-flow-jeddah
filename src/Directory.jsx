import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase, C, Btn, Card, Tag, Spinner, ErrorBanner,
 ensureXLSX, tsStamp, logAction } from "./lib.jsx";

// Enterprise styles — Phase 3, matches Dashboard/SurveysList 
if (typeof document !== "undefined" && !document.getElementById("directory-enterprise-styles")) {
 const _s = document.createElement("style");
 _s.id = "directory-enterprise-styles";
 _s.textContent = `
 .dir-row { transition: background 0.12s ease; }
 .dir-row:hover { background: #F8FAFC !important; }
 .dir-tab { transition: all 0.15s ease; }
 .dir-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
 .dir-card:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; }
 .dir-btn { transition: all 0.12s ease; }
 .dir-btn:active { transform: scale(0.95); }
 .dir-search:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; outline: none; }
 @keyframes dir-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
 .dir-in { animation: dir-in 0.2s ease both; }
 @keyframes spin { to { transform: rotate(360deg) } }

 /* Desktop table view — shown ≥1024px, hidden below */
 .dir-table-view { display: none; }
 .dir-list-view { display: block; }
 @media (min-width: 1024px) {
 .dir-table-view { display: block; }
 .dir-list-view { display: none; }
 }
 `;
 document.head.appendChild(_s);
}

const D = {
 e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
 e100:"#D1FAE5",e50:"#ECFDF5",
 gold:"#C9A84C",goldL:"#FEF3C7",
 s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
 s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
 white:"#FFFFFF",bg:"#F0F4F8",
 danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
 success:"#059669",successBg:"#ECFDF5",
 purple:"#7B2D8B",purpleBg:"#F5EEFA",amber:"#B7791F",amberBg:"#FFFBEB",
};

// unchanged constants 
const STAGES = ["الابتدائية", "المتوسطة", "الثانوية"];
const STATUS_ACTIVE = "نشط";
const STATUS_DISABLED = "معطل";
const PER_PAGE = 30;

// shared input styles 
const iStyle = {
 width:"100%", padding:"11px 13px",
 border:`1.5px solid ${D.s200}`, borderRadius:12,
 fontSize:14, fontFamily:"inherit", direction:"rtl",
 boxSizing:"border-box", outline:"none", marginBottom:10,
 background:D.white, color:D.s900, transition:"border-color 0.2s",
};
const lStyle = { fontSize:12, fontWeight:700, color:D.s700, marginBottom:5, display:"block" };

// Premium sub-components 

function StatusBadge({ status }) {
 const active = status === STATUS_ACTIVE || !status;
 return (
 <span style={{
 background: active ? D.successBg : D.s100,
 color: active ? D.success : D.s400,
 border: `1px solid ${active ? D.success+"40" : D.s200}`,
 borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:700, whiteSpace:"nowrap",
 }}>
 {active ? "نشط" : "معطل"}
 </span>
 );
}

function StageBadge({ stage }) {
 const colors = { "الابتدائية": D.e700, "المتوسطة": D.purple, "الثانوية": D.amber };
 const bgs = { "الابتدائية": D.e50, "المتوسطة": D.purpleBg, "الثانوية": D.amberBg };
 return stage ? (
 <span style={{ background:bgs[stage]||D.s100, color:colors[stage]||D.s500,
 border:`1px solid ${colors[stage]||D.s200}30`,
 borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>{stage}</span>
 ) : null;
}

function IconBtn({ icon, label, onClick, color = D.e700, bg = D.e50, danger }) {
 return (
 <button onClick={onClick} className="dir-btn" title={!label ? icon : undefined} style={{
 background: danger ? D.dangerBg : bg,
 color: danger ? D.danger : color,
 border: `1px solid ${danger ? "#FECACA" : color+"25"}`,
 borderRadius:9, padding: label ? "6px 12px" : "6px 9px", fontSize:11,
 fontWeight:700, cursor:"pointer", fontFamily:"inherit",
 display:"inline-flex", alignItems:"center", gap:4,
 }}>
 <span>{icon}</span>{label && <span>{label}</span>}
 </button>
 );
}

function SearchInput({ value, onChange, placeholder }) {
 return (
 <div style={{ position:"relative", marginBottom:10 }}>
 <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}></span>
 <input className="dir-search" value={value} onChange={onChange} placeholder={placeholder}
 style={{ ...iStyle, padding:"11px 42px 11px 14px", marginBottom:0 }}/>
 {value && (
 <button onClick={()=>onChange({target:{value:""}})} style={{
 position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
 background:"none", border:"none", color:D.s400, cursor:"pointer", fontSize:16,
 }}></button>
 )}
 </div>
 );
}

function FilterChip({ label, active, color = D.e600, bg, onClick }) {
 return (
 <button onClick={onClick} className="dir-btn" style={{
 padding:"6px 14px", borderRadius:20, fontSize:11, fontFamily:"inherit",
 cursor:"pointer", whiteSpace:"nowrap", fontWeight:active ? 700 : 500,
 border:`1.5px solid ${active ? color : D.s200}`,
 background: active ? (bg || `${color}10`) : D.white,
 color: active ? color : D.s500, transition:"all 0.15s",
 }}>{label}</button>
 );
}

function LoadingState() {
 return (
 <div style={{ textAlign:"center", padding:"50px 20px" }}>
 <div style={{ width:40, height:40, borderRadius:"50%", border:`3px solid ${D.e100}`,
 borderTopColor:D.e600, animation:"spin 0.7s linear infinite", margin:"0 auto 12px" }}/>
 <p style={{ margin:0, color:D.s500, fontSize:13 }}>جاري التحميل...</p>
 </div>
 );
}

function EmptyState({ icon="", title="لا توجد نتائج", sub="" }) {
 return (
 <div style={{ textAlign:"center", padding:"40px 20px", background:D.white,
 borderRadius:18, border:`1px solid ${D.s200}` }}>
 <div style={{ fontSize:44, marginBottom:10 }}>{icon}</div>
 <p style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:D.s900 }}>{title}</p>
 {sub && <p style={{ margin:0, fontSize:12, color:D.s500 }}>{sub}</p>}
 </div>
 );
}

function InfoBanner({ message, type="success" }) {
 if (!message) return null;
 const c = type==="success" ? D.success : D.danger;
 const bg = type==="success" ? D.successBg : D.dangerBg;
 const border = type==="success" ? D.success+"40" : "#FECACA";
 return (
 <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:12,
 padding:"10px 14px", fontSize:13, color:c, marginBottom:12,
 display:"flex", gap:8, alignItems:"center" }}>
 <span>{type==="success" ? "" : ""}</span>{message}
 </div>
 );
}

// Premium FieldInput 
function FieldInput({ label, value, onChange, type="text", disabled=false, required=false, dir="rtl", placeholder="" }) {
 return (
 <div style={{ marginBottom:2 }}>
 <label style={lStyle}>{label}{required && <span style={{color:D.danger}}> *</span>}</label>
 <input type={type} value={value||""} onChange={e=>onChange(e.target.value)}
 disabled={disabled} placeholder={placeholder}
 style={{ ...iStyle, direction:dir, background:disabled?"#F8FAFC":D.white,
 color:disabled?D.s400:D.s900 }}/>
 </div>
 );
}

function SegmentedPicker({ label, options, value, onChange }) {
 return (
 <div style={{ marginBottom:12 }}>
 <label style={lStyle}>{label}</label>
 <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
 {options.map(opt => (
 <button key={opt} onClick={()=>onChange(opt)} style={{
 padding:"8px 16px", borderRadius:10, fontSize:12, fontFamily:"inherit", cursor:"pointer",
 border:`1.5px solid ${value===opt ? D.e600 : D.s200}`,
 background: value===opt ? D.e50 : D.white,
 color: value===opt ? D.e700 : D.s500,
 fontWeight: value===opt ? 700 : 400, transition:"all 0.15s",
 }}>{opt}</button>
 ))}
 </div>
 </div>
 );
}

function PaginationBar({ page, total, perPage, onChange }) {
 const totalPages = Math.ceil(total / perPage);
 if (totalPages <= 1) return null;
 return (
 <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:10, marginTop:16 }}>
 <button onClick={()=>onChange(page-1)} disabled={page===1} style={{
 background:page===1?D.s100:`linear-gradient(135deg,${D.e600},${D.e800})`,
 color:page===1?D.s400:"#fff", border:"none", borderRadius:10,
 padding:"8px 18px", fontSize:12, fontWeight:700, cursor:page===1?"not-allowed":"pointer",
 fontFamily:"inherit",
 }}>السابق</button>
 <span style={{ fontSize:13, color:D.s500, fontWeight:600 }}>{page} / {totalPages}</span>
 <button onClick={()=>onChange(page+1)} disabled={page>=totalPages} style={{
 background:page>=totalPages?D.s100:`linear-gradient(135deg,${D.e600},${D.e800})`,
 color:page>=totalPages?D.s400:"#fff", border:"none", borderRadius:10,
 padding:"8px 18px", fontSize:12, fontWeight:700, cursor:page>=totalPages?"not-allowed":"pointer",
 fontFamily:"inherit",
 }}>التالي</button>
 </div>
 );
}

// 
// IMPORT ENGINE — logic unchanged, UI unchanged (already premium)
// 
// 
// Smart ImportEngine — Ministry Edition
// Features:
// 1. رفع Excel / CSV
// 2. كشف تلقائي للأعمدة
// 3. Mapping مرن (سحب وإفلات الأعمدة)
// 4. معاينة البيانات قبل الاستيراد
// 5. إحصاءات: جديد / مكرر / سيُحدَّث
// 6. استيراد دفعي مع progress bar
// 

// Target fields per entity type
const ENTITY_FIELDS = {
 schools: [
 { key:"name", label:"اسم المدرسة", required:true },
 { key:"ministry_number", label:"الرقم الوزاري", required:false },
 { key:"phone", label:"رقم الجوال", required:false },
 { key:"email", label:"البريد الإلكتروني", required:false },
 { key:"principal", label:"مدير المدرسة", required:false },
 { key:"stage", label:"المرحلة الدراسية", required:false },
 { key:"gender", label:"النوع", required:false },
 { key:"sector", label:"القطاع", required:false },
 { key:"district", label:"الحي / المنطقة", required:false },
 { key:"status", label:"الحالة", required:false },
 ],
 supervisors: [
 { key:"full_name", label:"الاسم الكامل", required:true },
 { key:"phone", label:"رقم الجوال", required:false },
 { key:"email", label:"البريد الإلكتروني", required:false },
 { key:"department", label:"الإدارة / القسم", required:false },
 { key:"section", label:"الشعبة", required:false },
 { key:"id_number", label:"رقم الهوية", required:false },
 { key:"status", label:"الحالة", required:false },
 ],
 administrators: [
 { key:"full_name", label:"الاسم الكامل", required:true },
 { key:"phone", label:"رقم الجوال", required:false },
 { key:"email", label:"البريد الإلكتروني", required:false },
 { key:"school_name", label:"اسم المدرسة", required:false },
 { key:"position", label:"المسمى الوظيفي", required:false },
 { key:"id_number", label:"رقم الهوية", required:false },
 { key:"status", label:"الحالة", required:false },
 ],
};

// Auto-detect column mapping using fuzzy matching
function autoDetectMapping(excelColumns, entityType) {
 const fields = ENTITY_FIELDS[entityType] || [];
 const mapping = {};
 
 const ALIASES = {
 name: ["اسم المدرسة","المدرسة","الاسم","name","school","school_name"],
 full_name: ["الاسم","اسم المشرف","اسم المدير","الاسم الكامل","full_name","name"],
 ministry_number: ["الرقم الوزاري","رقم وزاري","ministry_number","وزاري","الرقم"],
 phone: ["الجوال","رقم الجوال","هاتف","phone","mobile","جوال","رقم"],
 email: ["البريد","email","الإيميل","بريد","email_address"],
 principal: ["المدير","مدير المدرسة","principal","اسم المدير"],
 stage: ["المرحلة","stage","المرحلة الدراسية","مرحلة"],
 gender: ["النوع","gender","الجنس","نوع"],
 sector: ["القطاع","sector","قطاع"],
 district: ["الحي","district","المنطقة","الحي / المنطقة"],
 status: ["الحالة","status","حالة"],
 department: ["الإدارة","القسم","department","إدارة"],
 section: ["الشعبة","section","شعبة"],
 id_number: ["رقم الهوية","هوية","id_number","national_id","هويه","الهوية"],
 position: ["المسمى","المنصب","الوظيفة","position"],
 school_name: ["المدرسة","school_name","اسم المدرسة"],
 };

 fields.forEach(field => {
 const aliases = ALIASES[field.key] || [field.label];
 const matched = excelColumns.find(col => {
 const colLower = col.trim().toLowerCase().replace(/\s+/g," ");
 return aliases.some(alias => {
 const aliasLower = alias.toLowerCase().replace(/\s+/g," ");
 return colLower === aliasLower || colLower.includes(aliasLower) || aliasLower.includes(colLower);
 });
 });
 if (matched) mapping[field.key] = matched;
 });
 
 return mapping;
}

function ImportEngine({ config, onDone, onCancel, user }) {
 const [step, setStep] = useState("upload"); // upload → mapping → preview → importing → done
 const [excelRows, setExcelRows] = useState([]); // raw rows from file
 const [excelCols, setExcelCols] = useState([]); // column names from file
 const [mapping, setMapping] = useState({}); // fieldKey → excelCol
 const [parsed, setParsed] = useState([]); // mapped rows
 const [importing, setImporting] = useState(false);
 const [progress, setProgress] = useState(0);
 const [importMode, setImportMode] = useState("new_only"); // new_only | update
 const [existingKeys,setExistingKeys]= useState(new Set());
 const [result, setResult] = useState(null);
 const [error, setError] = useState("");
 const [parsing, setParsing] = useState(false);
 const fileRef = useRef();

 const entityType = config.entityType || "schools";
 const fields = ENTITY_FIELDS[entityType] || [];

 // Load existing primary keys to detect duplicates
 async function loadExistingKeys() {
 let all = [], from = 0;
 while (true) {
 const { data } = await supabase.from(config.table).select(config.primaryKey).range(from, from+999);
 if (!data?.length) break;
 data.forEach(r => all.push(r[config.primaryKey]));
 if (data.length < 1000) break;
 from += 1000;
 }
 setExistingKeys(new Set(all));
 }

 // Parse uploaded file
 async function handleFile(file) {
 if (!file) return;
 setParsing(true); setError("");
 try {
 const XLSX = await ensureXLSX();
 const ab = await file.arrayBuffer();
 const wb = XLSX.read(ab);
 const ws = wb.Sheets[wb.SheetNames[0]];
 const rows = XLSX.utils.sheet_to_json(ws, { defval:"", raw:false });
 if (!rows.length) { setError("الملف فارغ أو لا يحتوي بيانات."); setParsing(false); return; }
 const cols = Object.keys(rows[0]);
 setExcelRows(rows);
 setExcelCols(cols);
 // Auto-detect mapping
 const autoMap = autoDetectMapping(cols, entityType);
 setMapping(autoMap);
 await loadExistingKeys();
 setStep("mapping");
 } catch (e) { setError("فشل قراءة الملف: " + e.message); }
 setParsing(false);
 }

 // Apply mapping to rows
 function applyMapping() {
 const requiredFields = fields.filter(f => f.required);
 const missing = requiredFields.filter(f => !mapping[f.key]);
 if (missing.length) {
 setError("يرجى تعيين الأعمدة المطلوبة: " + missing.map(f=>f.label).join("، "));
 return;
 }
 const rows = excelRows.map(r => {
 const obj = { ...config.defaultValues };
 Object.entries(mapping).forEach(([fieldKey, excelCol]) => {
 if (excelCol && r[excelCol] !== undefined) {
 obj[fieldKey] = String(r[excelCol]).trim();
 }
 });
 return obj;
 }).filter(r => requiredFields.every(f => r[f.key] && String(r[f.key]).trim()));
 if (!rows.length) { setError("لا توجد صفوف صالحة بعد تطبيق التعيين."); return; }
 setError("");
 setParsed(rows);
 setStep("preview");
 }

 const newRecords = useMemo(() => parsed.filter(r => !existingKeys.has(r[config.primaryKey])), [parsed, existingKeys, config.primaryKey]);
 const duplicates = useMemo(() => parsed.filter(r => existingKeys.has(r[config.primaryKey])), [parsed, existingKeys, config.primaryKey]);
 const toImport = importMode === "update" ? parsed : newRecords;

 // Run import
 async function runImport() {
 setImporting(true); setError(""); setProgress(0);
 let inserted=0, updated=0;
 const BATCH = 100;
 const total = toImport.length;
 for (let i=0; i<total; i+=BATCH) {
 const batch = toImport.slice(i, i+BATCH);
 if (importMode === "update") {
 const { error:e } = await supabase.from(config.table).upsert(batch, { onConflict: config.conflictColumn });
 if (e) { setError("خطأ في الاستيراد: " + e.message); setImporting(false); return; }
 const nib = batch.filter(r => !existingKeys.has(r[config.primaryKey])).length;
 inserted += nib; updated += batch.length - nib;
 } else {
 const { error:e } = await supabase.from(config.table).insert(batch);
 if (e) { setError("خطأ في الاستيراد: " + e.message); setImporting(false); return; }
 inserted += batch.length;
 }
 setProgress(Math.round((i+batch.length)/total*100));
 }
 logAction({ user, action:"bulk_import", table:config.table, details:{ inserted, updated, total } });
 setResult({ inserted, updated, skipped:duplicates.length });
 setStep("done"); setImporting(false);
 }

 // Shared styles 
 const card = { background:"#fff", borderRadius:12, border:"1px solid #E2E8F0", padding:16, marginBottom:12, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" };
 const btnPrimary = { background:"#006B54", color:"#fff", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" };
 const btnSecondary = { background:"#F1F5F9", color:"#334155", border:"1px solid #E2E8F0", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" };

 // STEP 1: Upload 
 if (step === "upload") return (
 <div style={{ padding:16, direction:"rtl" }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
 <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"#0F172A" }}>استيراد بيانات</h2>
 <button onClick={onCancel} style={{ ...btnSecondary, padding:"6px 12px" }}>إلغاء</button>
 </div>

 <div style={{ ...card, border:"2px dashed #CBD5E1", textAlign:"center", padding:"32px 16px",
 cursor:"pointer", background:"#F8FAFC" }}
 onClick={() => fileRef.current?.click()}
 onDragOver={e=>e.preventDefault()}
 onDrop={e=>{ e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
 <div style={{ width:52, height:52, borderRadius:12, background:"#EBF7F4",
 display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
 <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#006B54" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
 </svg>
 </div>
 {parsing ? (
 <p style={{ margin:0, fontSize:13, color:"#006B54", fontWeight:600 }}>جاري قراءة الملف...</p>
 ) : (
 <>
 <p style={{ margin:"0 0 4px", fontSize:14, fontWeight:600, color:"#0F172A" }}>اسحب الملف هنا أو اضغط للرفع</p>
 <p style={{ margin:0, fontSize:12, color:"#64748B" }}>Excel (.xlsx, .xls) أو CSV — الحد الأقصى 5000 صف</p>
 </>
 )}
 </div>
 <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }}
 onChange={e=>handleFile(e.target.files?.[0])}/>
 {error && <p style={{ color:"#DC2626", fontSize:12, marginTop:8 }}>{error}</p>}

 <div style={{ ...card, marginTop:12 }}>
 <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:"#334155" }}>الأعمدة المتوقعة لـ {config.label || "المدارس"}:</p>
 <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
 {fields.map(f => (
 <span key={f.key} style={{
 padding:"3px 10px", borderRadius:20, fontSize:11,
 background: f.required ? "#EBF7F4" : "#F1F5F9",
 color: f.required ? "#006B54" : "#64748B",
 border: f.required ? "1px solid #D6EFE9" : "1px solid #E2E8F0",
 fontWeight: f.required ? 600 : 400,
 }}>
 {f.label}{f.required ? " *" : ""}
 </span>
 ))}
 </div>
 </div>
 </div>
 );

 // STEP 2: Column Mapping 
 if (step === "mapping") return (
 <div style={{ padding:16, direction:"rtl" }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
 <div>
 <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"#0F172A" }}>تعيين الأعمدة</h2>
 <p style={{ margin:"3px 0 0", fontSize:12, color:"#64748B" }}>{excelRows.length} صف في الملف — عيّن كل حقل للعمود المقابل</p>
 </div>
 <button onClick={()=>setStep("upload")} style={{ ...btnSecondary, padding:"6px 12px" }}>رجوع</button>
 </div>

 {/* Auto-detect banner */}
 {Object.keys(mapping).length > 0 && (
 <div style={{ background:"#EBF7F4", border:"1px solid #D6EFE9", borderRadius:8,
 padding:"8px 12px", marginBottom:12, fontSize:12, color:"#006B54", fontWeight:500,
 display:"flex", alignItems:"center", gap:6 }}>
 <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
 تم الكشف التلقائي عن {Object.keys(mapping).length} أعمدة — راجع التعيين وعدّله إذا لزم
 </div>
 )}

 <div style={{ display:"grid", gap:8 }}>
 {fields.map(field => (
 <div key={field.key} style={{ ...card, display:"flex", alignItems:"center", gap:12, padding:"10px 14px" }}>
 <div style={{ flex:"0 0 140px" }}>
 <p style={{ margin:0, fontSize:12, fontWeight:600, color:"#0F172A" }}>{field.label}</p>
 {field.required && <p style={{ margin:0, fontSize:10, color:"#DC2626" }}>مطلوب</p>}
 </div>
 <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
 <path d="M9 18l6-6-6-6"/>
 </svg>
 <select value={mapping[field.key] || ""} onChange={e => setMapping(p=>({...p,[field.key]:e.target.value||undefined}))}
 style={{ flex:1, padding:"8px 10px", border:`1.5px solid ${mapping[field.key]?"#006B54":"#E2E8F0"}`,
 borderRadius:8, fontSize:12, fontFamily:"inherit", direction:"rtl",
 background: mapping[field.key] ? "#EBF7F4" : "#fff",
 color: mapping[field.key] ? "#006B54" : "#64748B",
 outline:"none" }}>
 <option value="">— لا يوجد —</option>
 {excelCols.map(col => <option key={col} value={col}>{col}</option>)}
 </select>
 {mapping[field.key] && (
 <span style={{ fontSize:10, color:"#94A3B8", flexShrink:0, maxWidth:80, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
 {excelRows[0]?.[mapping[field.key]] ? `مثال: ${String(excelRows[0][mapping[field.key]]).slice(0,15)}` : ""}
 </span>
 )}
 </div>
 ))}
 </div>

 {error && <p style={{ color:"#DC2626", fontSize:12, marginTop:8 }}>{error}</p>}

 <div style={{ display:"flex", gap:8, marginTop:16 }}>
 <button onClick={applyMapping} style={{ ...btnPrimary, flex:1 }}>
 معاينة البيانات
 </button>
 <button onClick={onCancel} style={{ ...btnSecondary }}>إلغاء</button>
 </div>
 </div>
 );

 // STEP 3: Preview 
 if (step === "preview") return (
 <div style={{ padding:16, direction:"rtl" }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
 <div>
 <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"#0F172A" }}>معاينة البيانات</h2>
 <p style={{ margin:"3px 0 0", fontSize:12, color:"#64748B" }}>{parsed.length} صف جاهز للاستيراد</p>
 </div>
 <button onClick={()=>setStep("mapping")} style={{ ...btnSecondary, padding:"6px 12px" }}>رجوع</button>
 </div>

 {/* Stats */}
 <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
 {[
 { label:"جديد", value:newRecords.length, color:"#006B54", bg:"#EBF7F4" },
 { label:"مكرر", value:duplicates.length, color:"#D97706", bg:"#FFFBEB" },
 { label:"الإجمالي", value:parsed.length, color:"#0F172A", bg:"#F1F5F9" },
 ].map(s=>(
 <div key={s.label} style={{ background:s.bg, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
 <p style={{ margin:0, fontSize:20, fontWeight:800, color:s.color }}>{s.value}</p>
 <p style={{ margin:0, fontSize:11, color:s.color }}>{s.label}</p>
 </div>
 ))}
 </div>

 {/* Import mode */}
 {duplicates.length > 0 && (
 <div style={{ ...card, marginBottom:12 }}>
 <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:600, color:"#334155" }}>كيف تتعامل مع السجلات المكررة؟</p>
 <div style={{ display:"flex", gap:8 }}>
 {[
 { v:"new_only", l:"تجاهل المكررة" },
 { v:"update", l:"تحديث المكررة" },
 ].map(opt=>(
 <button key={opt.v} onClick={()=>setImportMode(opt.v)} style={{
 flex:1, padding:"8px", borderRadius:8, cursor:"pointer", fontFamily:"inherit",
 fontSize:12, fontWeight:importMode===opt.v?700:400,
 border:`1.5px solid ${importMode===opt.v?"#006B54":"#E2E8F0"}`,
 background:importMode===opt.v?"#EBF7F4":"#fff",
 color:importMode===opt.v?"#006B54":"#64748B",
 }}>{opt.l}</button>
 ))}
 </div>
 </div>
 )}

 {/* Preview table */}
 <div style={{ overflowX:"auto", borderRadius:10, border:"1px solid #E2E8F0", marginBottom:14 }}>
 <table style={{ width:"100%", borderCollapse:"collapse", minWidth:400 }}>
 <thead>
 <tr style={{ background:"#EBF7F4" }}>
 {fields.filter(f=>mapping[f.key]).slice(0,5).map(f=>(
 <th key={f.key} style={{ padding:"8px 12px", fontSize:11, fontWeight:700, color:"#006B54", textAlign:"right", whiteSpace:"nowrap" }}>
 {f.label}
 </th>
 ))}
 <th style={{ padding:"8px 12px", fontSize:11, fontWeight:700, color:"#006B54", textAlign:"right" }}>الحالة</th>
 </tr>
 </thead>
 <tbody>
 {parsed.slice(0,15).map((row,i)=>{
 const isDup = existingKeys.has(row[config.primaryKey]);
 return (
 <tr key={i} style={{ borderBottom:"1px solid #F1F5F9", background:isDup?"#FFFBEB":"#fff" }}>
 {fields.filter(f=>mapping[f.key]).slice(0,5).map(f=>(
 <td key={f.key} style={{ padding:"8px 12px", fontSize:12, color:"#334155", whiteSpace:"nowrap", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis" }}>
 {row[f.key] || "—"}
 </td>
 ))}
 <td style={{ padding:"8px 12px" }}>
 <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20,
 background:isDup?"#FEF3C7":"#ECFDF5", color:isDup?"#D97706":"#059669" }}>
 {isDup ? "مكرر" : "جديد"}
 </span>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 {parsed.length > 15 && (
 <p style={{ textAlign:"center", padding:8, fontSize:11, color:"#94A3B8", margin:0 }}>
 عرض 15 من {parsed.length} صف
 </p>
 )}
 </div>

 {error && <p style={{ color:"#DC2626", fontSize:12, marginBottom:8 }}>{error}</p>}

 <div style={{ display:"flex", gap:8 }}>
 <button onClick={runImport} disabled={toImport.length===0} style={{
 ...btnPrimary, flex:1,
 opacity:toImport.length===0?0.5:1,
 cursor:toImport.length===0?"not-allowed":"pointer",
 }}>
 استيراد {toImport.length} سجل
 </button>
 <button onClick={onCancel} style={{ ...btnSecondary }}>إلغاء</button>
 </div>
 </div>
 );

 // STEP 4: Importing (progress) 
 if (step === "importing" || importing) return (
 <div style={{ padding:32, textAlign:"center", direction:"rtl" }}>
 <div style={{ width:48, height:48, borderRadius:"50%", border:"3px solid #D6EFE9",
 borderTopColor:"#006B54", animation:"spin 0.7s linear infinite", margin:"0 auto 16px" }}/>
 <p style={{ margin:"0 0 16px", fontSize:14, fontWeight:600, color:"#0F172A" }}>
 جاري الاستيراد... {progress}%
 </p>
 <div style={{ height:8, background:"#F1F5F9", borderRadius:6, overflow:"hidden", maxWidth:300, margin:"0 auto" }}>
 <div style={{ height:"100%", background:"linear-gradient(90deg,#006B54,#008A6A)",
 borderRadius:6, width:`${progress}%`, transition:"width 0.3s" }}/>
 </div>
 </div>
 );

 // STEP 5: Done 
 if (step === "done" && result) return (
 <div style={{ padding:24, textAlign:"center", direction:"rtl" }}>
 <div style={{ width:56, height:56, borderRadius:14, background:"#EBF7F4",
 display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
 <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#006B54" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
 <path d="M20 6 9 17l-5-5"/>
 </svg>
 </div>
 <h2 style={{ margin:"0 0 8px", fontSize:18, fontWeight:700, color:"#0F172A" }}>اكتمل الاستيراد</h2>
 <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, margin:"16px 0", maxWidth:320, marginLeft:"auto", marginRight:"auto" }}>
 {[
 { label:"أُضيف", value:result.inserted, color:"#006B54", bg:"#EBF7F4" },
 { label:"حُدِّث", value:result.updated, color:"#D97706", bg:"#FFFBEB" },
 { label:"تجاهَل", value:result.skipped, color:"#64748B", bg:"#F1F5F9" },
 ].map(s=>(
 <div key={s.label} style={{ background:s.bg, borderRadius:10, padding:"10px 8px" }}>
 <p style={{ margin:0, fontSize:22, fontWeight:800, color:s.color }}>{s.value}</p>
 <p style={{ margin:0, fontSize:11, color:s.color }}>{s.label}</p>
 </div>
 ))}
 </div>
 <button onClick={onDone} style={{ ...btnPrimary, marginTop:8 }}>العودة للدليل</button>
 </div>
 );

 return null;
}

function EntityForm({ initial, config, user, onSaved, onCancel }) {
 // All logic unchanged 
 const isEdit = !!initial;
 const [form, setForm] = useState(initial || config.defaultRecord);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 function set(k,v) { setForm(p=>({...p,[k]:v})); }

 async function save() {
 const missing = config.requiredFormFields?.filter(f => !form[f]?.trim());
 if (missing?.length) { setError("الحقول الإلزامية: " + missing.map(f=>config.fieldLabels?.[f]||f).join("، ")); return; }
 setSaving(true); setError("");
 const payload = {};
 config.formFields.forEach(f => { payload[f.key] = form[f.key]||""; });
 let err;
 if (isEdit) { ({error:err} = await supabase.from(config.table).update(payload).eq(config.primaryKey, initial[config.primaryKey])); }
 else { ({error:err} = await supabase.from(config.table).insert(payload)); }
 setSaving(false);
 if (err) { setError(err.code==="23505"?config.duplicateMsg||"هذا المعرف مستخدم بالفعل":err.code==="42501"?"ليست لديك صلاحية":"حدث خطأ: "+err.message); return; }
 logAction({ user, action:isEdit?"update":"create", table:config.table, recordId:form[config.primaryKey], recordLabel:form[config.nameField] });
 onSaved();
 }
 // End unchanged 

 // Portal fix preserved exactly — see prior fix notes.
 return createPortal(
 <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"flex-end" }}>
 <div style={{ background:D.bg, width:"100%", maxWidth:560, margin:"0 auto", maxHeight:"92vh", overflowY:"auto",
 borderRadius:"24px 24px 0 0", paddingBottom:24 }}>
 <div style={{ display:"flex", justifyContent:"center", padding:"14px 0 4px" }}>
 <div style={{ width:44, height:4, background:D.s200, borderRadius:4 }}/>
 </div>
 <div style={{ padding:"8px 18px 0" }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
 <h3 style={{ margin:0, fontSize:16, color:D.s900, fontWeight:800 }}>
 {isEdit ? `تعديل — ${initial[config.nameField]}` : config.addTitle}
 </h3>
 <button onClick={onCancel} style={{ background:D.s100, border:"none", borderRadius:10,
 width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center",
 fontSize:16, cursor:"pointer", color:D.s500 }}></button>
 </div>

 {error && <div style={{ background:D.dangerBg, border:"1px solid #FECACA", borderRadius:12,
 padding:"10px 14px", fontSize:13, color:D.danger, marginBottom:14,
 display:"flex", gap:8 }}><span></span>{error}</div>}

 {config.formFields.map(field => {
 if (field.type==="segment") return (
 <SegmentedPicker key={field.key} label={field.label}
 options={field.options} value={form[field.key]||field.options[0]} onChange={v=>set(field.key,v)}/>
 );
 if (field.type==="status") return (
 <SegmentedPicker key={field.key} label={field.label}
 options={[STATUS_ACTIVE, STATUS_DISABLED]}
 value={form[field.key]||STATUS_ACTIVE} onChange={v=>set(field.key,v)}/>
 );
 if (field.type==="maps") return (
 <div key={field.key}>
 <FieldInput label={field.label} value={form[field.key]}
 onChange={v=>set(field.key,v)} dir="ltr" placeholder="https://maps.google.com/..."/>
 {form[field.key] && (
 <a href={form[field.key]} target="_blank" rel="noopener noreferrer"
 style={{ fontSize:12, color:D.e700, marginTop:-6, marginBottom:10,
 display:"flex", alignItems:"center", gap:4 }}>
 فتح الخريطة ↗
 </a>
 )}
 </div>
 );
 return (
 <FieldInput key={field.key} label={field.label} value={form[field.key]}
 onChange={v=>set(field.key,v)}
 disabled={isEdit && field.key===config.primaryKey}
 required={config.requiredFormFields?.includes(field.key)}
 dir={field.dir||"rtl"} type={field.inputType||"text"}
 placeholder={field.placeholder||""}/>
 );
 })}

 <div style={{ display:"flex", gap:8, marginTop:14 }}>
 <button onClick={onCancel} style={{ flex:1, padding:"12px", background:D.s100,
 color:D.s700, border:"none", borderRadius:12, fontSize:13, fontWeight:700,
 cursor:"pointer", fontFamily:"inherit" }}>إلغاء</button>
 <button onClick={save} disabled={saving} style={{
 flex:2, padding:"12px",
 background:saving?`${D.e600}70`:`linear-gradient(135deg,${D.e600},${D.e800})`,
 color:"#fff", border:"none", borderRadius:12, fontSize:13, fontWeight:800,
 cursor:saving?"not-allowed":"pointer", fontFamily:"inherit",
 boxShadow:saving?"none":`0 4px 14px ${D.e600}40`,
 }}>{saving?"جاري الحفظ...":(isEdit?"حفظ التعديلات":config.addTitle)}</button>
 </div>
 </div>
 </div>
 </div>,
 document.body
 );
}

// 
// ENTITY TABLE — Phase 3 enterprise redesign
// Logic: filtering, status toggle, bulk actions, export — 100%
// unchanged. Adds a real <table> for desktop (≥1024px) alongside
// the existing list view (kept for mobile/tablet), toggled purely
// via CSS media query — zero extra JS state or branching.
// 
function EntityTable({ config, user, isAdmin }) {
 // All state & logic unchanged 
 const [records, setRecords] = useState([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");
 const [statusFilter,setStatusFilter]= useState("الكل");
 const [page, setPage] = useState(1);
 const [formTarget, setFormTarget] = useState(null);
 const [importing, setImporting] = useState(false);
 const [selected, setSelected] = useState(new Set());
 const [bulkLoading, setBulkLoading] = useState(false);
 const [info, setInfo] = useState("");
 const [error, setError] = useState("");

 const load = useCallback(async () => {
 setLoading(true);
 let all=[], from=0;
 while (true) {
 const{data,error}=await supabase.from(config.table).select("*").order(config.sortBy||config.primaryKey).range(from,from+999);
 if(error||!data?.length) break;
 all=all.concat(data);
 if(data.length<1000) break;
 from+=1000;
 }
 setRecords(all); setLoading(false);
 }, [config.table, config.sortBy, config.primaryKey]);

 useEffect(()=>{load();},[load]);

 const filtered = useMemo(()=>{
 let r=records;
 if(statusFilter===STATUS_ACTIVE) r=r.filter(x=>!x.status||x.status===STATUS_ACTIVE);
 if(statusFilter===STATUS_DISABLED) r=r.filter(x=>x.status===STATUS_DISABLED);
 if(config.filterOptions?.includes(statusFilter)) r=r.filter(x=>x[config.stageField||"stage"]===statusFilter);
 if(search){const q=search.toLowerCase(); r=r.filter(x=>config.searchFields.some(f=>String(x[f]||"").toLowerCase().includes(q)));}
 return r;
 },[records,statusFilter,search,config.searchFields,config.filterOptions,config.stageField]);

 const paged=filtered.slice((page-1)*PER_PAGE,page*PER_PAGE);

 async function toggleStatus(record) {
 const newStatus=record.status===STATUS_ACTIVE?STATUS_DISABLED:STATUS_ACTIVE;
 const{error:e}=await supabase.from(config.table).update({status:newStatus}).eq(config.primaryKey,record[config.primaryKey]);
 if(e){setError("فشل تغيير الحالة");return;}
 logAction({user,action:"update",table:config.table,recordId:record[config.primaryKey],recordLabel:`${record[config.nameField]} → ${newStatus}`});
 load();
 }

 async function bulkToggle(newStatus) {
 if(!selected.size) return;
 setBulkLoading(true);
 const ids=[...selected];
 const{error:e}=await supabase.from(config.table).update({status:newStatus}).in(config.primaryKey,ids);
 setBulkLoading(false);
 if(e){setError("فشل العملية الجماعية");return;}
 setInfo(`تم تغيير حالة ${ids.length} سجل`);
 setSelected(new Set()); load();
 }

 async function exportExcel() {
 const XLSX=await ensureXLSX();
 const rows=filtered.map(r=>{const obj={};config.exportColumns.forEach(({key,label})=>{obj[label]=r[key]||"";});return obj;});
 const ws=XLSX.utils.json_to_sheet(rows); ws["!cols"]=Object.keys(rows[0]||{}).map(()=>({wch:22}));
 const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,config.exportSheet||"بيانات");
 XLSX.writeFile(wb,`${config.exportSheet||"تصدير"}-${tsStamp()}.xlsx`);
 }

 function toggleSelectAll() {
 if(paged.every(r=>selected.has(r[config.primaryKey]))){const next=new Set(selected);paged.forEach(r=>next.delete(r[config.primaryKey]));setSelected(next);}
 else{const next=new Set(selected);paged.forEach(r=>next.add(r[config.primaryKey]));setSelected(next);}
 }
 // End unchanged logic 

 if (importing) return <ImportEngine config={config.importConfig} user={user} onDone={()=>{setImporting(false);load();}} onCancel={()=>setImporting(false)}/>;
 if (formTarget!==null) return <config.FormComponent initial={formTarget.id||formTarget[config.primaryKey]?formTarget:null} config={config} user={user} onSaved={()=>{setFormTarget(null);load();}} onCancel={()=>setFormTarget(null)}/>;

 return (
 <div style={{ direction:"rtl" }}>
 {/* Header */}
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
 <div>
 <h2 style={{ margin:0, fontSize:18, color:D.s900, fontWeight:800 }}>{config.title}</h2>
 <p style={{ margin:"3px 0 0", fontSize:12, color:D.s500 }}>{filtered.length} من {records.length} سجل</p>
 </div>
 <div style={{ display:"flex", gap:6 }}>
 {isAdmin && (
 <button onClick={()=>setFormTarget({})} style={{
 background:`linear-gradient(135deg,${D.e600},${D.e800})`,
 color:"#fff", border:"none", borderRadius:10, padding:"8px 14px",
 fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
 boxShadow:`0 3px 10px ${D.e600}40`,
 }}>إضافة</button>
 )}
 <IconBtn icon="" label="Excel" onClick={exportExcel}/>
 {isAdmin && <IconBtn icon="" label="استيراد" onClick={()=>setImporting(true)}/>}
 </div>
 </div>

 {/* Messages */}
 {error && <InfoBanner message={error} type="error"/>}
 {info && <InfoBanner message={info} type="success"/>}

 {/* Search + filters bar */}
 <div style={{
 background:D.white, borderRadius:16, border:`1px solid ${D.s200}`,
 padding:14, marginBottom:18, boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
 }}>
 <SearchInput value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
 placeholder={config.searchPlaceholder||"بحث..."}/>
 <div style={{ display:"flex", gap:6, marginTop:12, flexWrap:"wrap" }}>
 {["الكل", STATUS_ACTIVE, STATUS_DISABLED, ...(config.filterOptions||[])].map(f=>(
 <FilterChip key={f} label={f} active={statusFilter===f}
 color={f===STATUS_ACTIVE?D.success:f===STATUS_DISABLED?D.danger:D.e600}
 bg={f===STATUS_ACTIVE?D.successBg:f===STATUS_DISABLED?D.dangerBg:D.e50}
 onClick={()=>{setStatusFilter(f);setPage(1);}}/>
 ))}
 </div>
 </div>

 {/* Bulk bar */}
 {selected.size>0 && (
 <div style={{ background:D.e50, border:`1px solid ${D.e100}`, borderRadius:12,
 padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
 <span style={{ fontSize:13, color:D.e700, fontWeight:700 }}>{selected.size} محدد</span>
 <button onClick={()=>bulkToggle(STATUS_ACTIVE)} disabled={bulkLoading}
 style={{ background:D.successBg, color:D.success, border:`1px solid ${D.success}30`,
 borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
 تفعيل الكل
 </button>
 <button onClick={()=>bulkToggle(STATUS_DISABLED)} disabled={bulkLoading}
 style={{ background:D.dangerBg, color:D.danger, border:"1px solid #FECACA",
 borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
 تعطيل الكل
 </button>
 <button onClick={()=>setSelected(new Set())} style={{ background:"none", border:"none",
 color:D.s400, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>إلغاء التحديد</button>
 </div>
 )}

 {loading ? <LoadingState/>
 : paged.length===0 ? <EmptyState icon="" title="لا توجد نتائج" sub="جرب تغيير البحث أو الفلاتر"/>
 : (
 <>
 {/* Desktop table view (≥1024px) */}
 <div className="dir-table-view" style={{
 background:D.white, borderRadius:16, border:`1px solid ${D.s200}`,
 overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
 }}>
 <table style={{ width:"100%", borderCollapse:"collapse" }}>
 <thead>
 <tr style={{ background:D.s50, borderBottom:`1px solid ${D.s200}` }}>
 <th style={{ padding:"10px 14px", width:36 }}>
 <input type="checkbox"
 checked={paged.length>0 && paged.every(r=>selected.has(r[config.primaryKey]))}
 onChange={toggleSelectAll} style={{width:15,height:15}}/>
 </th>
 <th style={{ padding:"12px 14px", textAlign:"right", fontSize:11, fontWeight:700, color:D.s500 }}>الاسم</th>
 <th style={{ padding:"12px 14px", textAlign:"right", fontSize:11, fontWeight:700, color:D.s500 }}>التفاصيل</th>
 <th style={{ padding:"12px 14px", textAlign:"right", fontSize:11, fontWeight:700, color:D.s500 }}>الحالة</th>
 <th style={{ padding:"12px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:D.s500 }}>إجراءات</th>
 </tr>
 </thead>
 <tbody>
 {paged.map((record, i) => (
 <tr key={record[config.primaryKey]} className="dir-row" style={{
 borderBottom: i < paged.length-1 ? `1px solid ${D.s100}` : "none",
 }}>
 <td style={{ padding:"12px 14px" }}>
 <input type="checkbox"
 checked={selected.has(record[config.primaryKey])}
 onChange={()=>{const next=new Set(selected);next.has(record[config.primaryKey])?next.delete(record[config.primaryKey]):next.add(record[config.primaryKey]);setSelected(next);}}
 style={{width:15,height:15}}/>
 </td>
 <td style={{ padding:"12px 14px" }}>
 <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
 <p style={{ margin:0, fontSize:13, fontWeight:700, color:D.s900 }}>{record[config.nameField]}</p>
 {config.extraBadge && config.extraBadge(record)}
 </div>
 </td>
 <td style={{ padding:"12px 14px" }}>
 <p style={{ margin:0, fontSize:12, color:D.s500 }}>
 {config.subtitleFields.map(f=>record[f]?`${config.fieldLabels?.[f]||f}: ${record[f]}`:null).filter(Boolean).join(" · ")}
 </p>
 </td>
 <td style={{ padding:"12px 14px" }}>
 <StatusBadge status={record.status}/>
 </td>
 <td style={{ padding:"12px 14px" }}>
 {isAdmin && (
 <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
 <IconBtn icon="" onClick={()=>setFormTarget(record)}/>
 <IconBtn icon={record.status===STATUS_ACTIVE?"⏸":""}
 onClick={()=>toggleStatus(record)}
 danger={record.status===STATUS_ACTIVE}
 color={record.status===STATUS_ACTIVE?D.danger:D.success}
 bg={record.status===STATUS_ACTIVE?D.dangerBg:D.successBg}/>
 </div>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Mobile/tablet list view (<1024px) — original layout */}
 <div className="dir-list-view" style={{ borderRadius:18, border:`1px solid ${D.s200}`, overflow:"hidden",
 boxShadow:"0 2px 8px rgba(0,0,0,0.05)", background:D.white }}>

 <div style={{ background:D.s50, padding:"9px 16px", borderBottom:`1px solid ${D.s100}`,
 display:"flex", alignItems:"center", gap:10 }}>
 <input type="checkbox"
 checked={paged.length>0 && paged.every(r=>selected.has(r[config.primaryKey]))}
 onChange={toggleSelectAll} style={{width:15,height:15}}/>
 <span style={{ fontSize:11, color:D.s400, fontWeight:500 }}>تحديد الصفحة الحالية</span>
 <span style={{ fontSize:11, color:D.s400 }}>· {paged.length} سجل</span>
 </div>

 {paged.map((record,i)=>(
 <div key={record[config.primaryKey]} className="dir-row dir-in"
 style={{ padding:"12px 16px", background:D.white,
 borderBottom:i<paged.length-1?`1px solid ${D.s100}`:"none",
 display:"flex", alignItems:"center", gap:12,
 animationDelay:`${i*0.03}s` }}>

 <input type="checkbox"
 checked={selected.has(record[config.primaryKey])}
 onChange={()=>{const next=new Set(selected);next.has(record[config.primaryKey])?next.delete(record[config.primaryKey]):next.add(record[config.primaryKey]);setSelected(next);}}
 style={{width:15,height:15,flexShrink:0}}/>

 <div style={{ flex:1, minWidth:0 }}>
 <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
 <p style={{ margin:0, fontSize:13, fontWeight:700, color:D.s900 }}>{record[config.nameField]}</p>
 <StatusBadge status={record.status}/>
 {config.extraBadge && config.extraBadge(record)}
 </div>
 <p style={{ margin:0, fontSize:11, color:D.s400, lineHeight:1.5 }}>
 {config.subtitleFields.map(f=>record[f]?`${config.fieldLabels?.[f]||f}: ${record[f]}`:null).filter(Boolean).join(" · ")}
 </p>
 </div>

 {isAdmin && (
 <div style={{ display:"flex", gap:6, flexShrink:0 }}>
 <IconBtn icon="" onClick={()=>setFormTarget(record)}/>
 <IconBtn icon={record.status===STATUS_ACTIVE?"⏸":""}
 onClick={()=>toggleStatus(record)}
 danger={record.status===STATUS_ACTIVE}
 color={record.status===STATUS_ACTIVE?D.danger:D.success}
 bg={record.status===STATUS_ACTIVE?D.dangerBg:D.successBg}/>
 </div>
 )}
 </div>
 ))}
 </div>
 </>
 )}

 <PaginationBar page={page} total={filtered.length} perPage={PER_PAGE}
 onChange={p=>{setPage(p);setSelected(new Set());}}/>
 </div>
 );
}

// 
// CONFIGS — unchanged
// 
const SCHOOLS_CONFIG = {
 table:"survey_schools",primaryKey:"id",nameField:"name",sortBy:"name",
 title:"المدارس",addTitle:"إضافة مدرسة",duplicateMsg:"هذا الرقم الوزاري مستخدم بالفعل",
 searchPlaceholder:"بحث بالاسم أو الرقم الوزاري أو المدير",
 searchFields:["name","id","principal","district","sector"],
 subtitleFields:["id","stage","district"],
 fieldLabels:{id:"رقم وزاري",stage:"المرحلة",district:"الحي",sector:"القطاع",principal:"المدير"},
 filterOptions:STAGES,stageField:"stage",exportSheet:"المدارس",
 exportColumns:[
 {key:"id",label:"الرقم الوزاري"},{key:"name",label:"اسم المدرسة"},
 {key:"stage",label:"المرحلة"},{key:"sector",label:"القطاع"},
 {key:"district",label:"الحي"},{key:"national_address",label:"العنوان الوطني"},
 {key:"maps_url",label:"موقع خرائط"},{key:"principal",label:"المدير/ة"},
 {key:"phone",label:"الجوال"},{key:"email",label:"البريد"},
 {key:"status",label:"الحالة"},{key:"created_at",label:"تاريخ الإضافة"},
 {key:"updated_at",label:"آخر تعديل"},
 ],
 extraBadge:(r)=>r.stage?<StageBadge stage={r.stage}/>:null,
 requiredFormFields:["id","name"],
 defaultRecord:{id:"",name:"",stage:"الابتدائية",sector:"",district:"",national_address:"",maps_url:"",principal:"",phone:"",email:"",status:STATUS_ACTIVE},
 formFields:[
 {key:"id",label:"الرقم الوزاري",dir:"ltr",placeholder:"مثال: 32100"},
 {key:"name",label:"اسم المدرسة"},
 {key:"stage",label:"المرحلة الدراسية",type:"segment",options:STAGES},
 {key:"sector",label:"القطاع"},{key:"district",label:"الحي"},
 {key:"national_address",label:"العنوان الوطني",placeholder:"مثال: 7382 شارع..."},
 {key:"maps_url",label:"رابط خرائط Google",type:"maps"},
 {key:"principal",label:"اسم المدير/ة"},
 {key:"phone",label:"جوال المدير/ة",dir:"ltr"},
 {key:"email",label:"البريد الإلكتروني",dir:"ltr",inputType:"email"},
 {key:"status",label:"الحالة",type:"status"},
 ],
 importConfig:{table:"survey_schools",primaryKey:"id",conflictColumn:"id",requiredFields:["id","name"],
 columnMap:{"الرقم الوزاري":"id","اسم المدرسة":"name","المرحلة":"stage","القطاع":"sector","الحي":"district","العنوان الوطني":"national_address","رابط الخريطة":"maps_url","المدير":"principal","الجوال":"phone","البريد":"email"},
 defaultValues:{status:STATUS_ACTIVE},
 previewColumns:[{key:"id",label:"الرقم الوزاري"},{key:"name",label:"اسم المدرسة"},{key:"stage",label:"المرحلة"},{key:"district",label:"الحي"},{key:"principal",label:"المدير/ة"}],
 },
 FormComponent:EntityForm,
};

const SUPERVISORS_CONFIG = {
 table:"supervisors",primaryKey:"national_id",nameField:"name",sortBy:"name",
 title:"المشرفون",addTitle:"إضافة مشرف",duplicateMsg:"رقم الهوية هذا مستخدم بالفعل",
 searchPlaceholder:"بحث بالاسم أو رقم الهوية أو القسم",
 searchFields:["name","national_id","department","section","job_title"],
 subtitleFields:["national_id","department","job_title"],
 fieldLabels:{national_id:"رقم الهوية",department:"الإدارة",job_title:"المسمى"},
 exportSheet:"المشرفون",
 exportColumns:[
 {key:"national_id",label:"رقم الهوية"},{key:"name",label:"الاسم الكامل"},
 {key:"department",label:"الإدارة"},{key:"section",label:"القسم"},
 {key:"job_title",label:"المسمى الوظيفي"},{key:"phone",label:"الجوال"},
 {key:"email",label:"البريد"},{key:"status",label:"الحالة"},
 {key:"created_at",label:"تاريخ الإضافة"},{key:"updated_at",label:"آخر تعديل"},
 ],
 requiredFormFields:["national_id","name"],
 defaultRecord:{national_id:"",name:"",department:"",section:"",job_title:"",phone:"",email:"",status:STATUS_ACTIVE},
 formFields:[
 {key:"national_id",label:"رقم الهوية الوطنية",dir:"ltr",placeholder:"10 أرقام"},
 {key:"name",label:"الاسم الكامل"},
 {key:"department",label:"الإدارة"},{key:"section",label:"القسم"},
 {key:"job_title",label:"المسمى الوظيفي"},
 {key:"phone",label:"الجوال",dir:"ltr"},
 {key:"email",label:"البريد الإلكتروني",dir:"ltr",inputType:"email"},
 {key:"status",label:"الحالة",type:"status"},
 ],
 importConfig:{table:"supervisors",primaryKey:"national_id",conflictColumn:"national_id",requiredFields:["national_id","name"],
 columnMap:{"رقم الهوية":"national_id","الاسم الكامل":"name","الإدارة":"department","القسم":"section","المسمى الوظيفي":"job_title","الجوال":"phone","البريد":"email"},
 defaultValues:{status:STATUS_ACTIVE},
 previewColumns:[{key:"national_id",label:"رقم الهوية"},{key:"name",label:"الاسم"},{key:"department",label:"الإدارة"},{key:"job_title",label:"المسمى"}],
 },
 FormComponent:EntityForm,
};

const ADMINISTRATORS_CONFIG = {
 table:"administrators",primaryKey:"national_id",nameField:"full_name",sortBy:"full_name",
 title:"المديرون",addTitle:"إضافة مدير",duplicateMsg:"رقم الهوية هذا مستخدم بالفعل",
 searchPlaceholder:"بحث بالاسم أو رقم الهوية أو القسم",
 searchFields:["full_name","national_id","department","section","job_title"],
 subtitleFields:["national_id","department","job_title"],
 fieldLabels:{national_id:"رقم الهوية",department:"الإدارة",job_title:"المسمى"},
 exportSheet:"المديرون",
 exportColumns:[
 {key:"national_id",label:"رقم الهوية"},{key:"full_name",label:"الاسم الكامل"},
 {key:"department",label:"الإدارة"},{key:"section",label:"القسم"},
 {key:"job_title",label:"المسمى الوظيفي"},{key:"phone",label:"الجوال"},
 {key:"email",label:"البريد"},{key:"status",label:"الحالة"},
 {key:"created_at",label:"تاريخ الإضافة"},{key:"updated_at",label:"آخر تعديل"},
 ],
 requiredFormFields:["national_id","full_name"],
 defaultRecord:{national_id:"",full_name:"",department:"",section:"",job_title:"",phone:"",email:"",status:STATUS_ACTIVE},
 formFields:[
 {key:"national_id",label:"رقم الهوية الوطنية",dir:"ltr",placeholder:"10 أرقام"},
 {key:"full_name",label:"الاسم الكامل"},
 {key:"department",label:"الإدارة"},{key:"section",label:"القسم"},
 {key:"job_title",label:"المسمى الوظيفي"},
 {key:"phone",label:"الجوال",dir:"ltr"},
 {key:"email",label:"البريد الإلكتروني",dir:"ltr",inputType:"email"},
 {key:"status",label:"الحالة",type:"status"},
 ],
 importConfig:{table:"administrators",primaryKey:"national_id",conflictColumn:"national_id",requiredFields:["national_id","full_name"],
 columnMap:{"رقم الهوية":"national_id","الاسم الكامل":"full_name","الإدارة":"department","القسم":"section","المسمى الوظيفي":"job_title","الجوال":"phone","البريد":"email"},
 defaultValues:{status:STATUS_ACTIVE},
 previewColumns:[{key:"national_id",label:"رقم الهوية"},{key:"full_name",label:"الاسم"},{key:"department",label:"الإدارة"},{key:"job_title",label:"المسمى"}],
 },
 FormComponent:EntityForm,
};

// 
// DIRECTORY PAGE — Phase 3 enterprise tab bar, logic unchanged
// 
export default function DirectoryPage({ user, isAdmin }) {
 const [activeTab, setActiveTab] = useState("schools");

 const TABS = [
 { id:"schools", label:"المدارس", icon:"", config:SCHOOLS_CONFIG, color:D.e700, bg:D.e50 },
 { id:"supervisors", label:"المشرفون", icon:"", config:SUPERVISORS_CONFIG, color:D.purple, bg:D.purpleBg },
 { id:"administrators", label:"الإداريون", icon:"", config:ADMINISTRATORS_CONFIG, color:D.amber, bg:D.amberBg },
 ];

 const current = TABS.find(t=>t.id===activeTab);

 return (
 <div style={{ direction:"rtl" }}>
 {/* Header */}
 <div style={{ marginBottom:18 }}>
 <h1 style={{ margin:0, fontSize:22, color:D.s900, fontWeight:800, letterSpacing:"-0.02em" }}>الدليل</h1>
 <p style={{ margin:"4px 0 0", fontSize:13, color:D.s500 }}>إدارة المدارس والمشرفين والإداريين</p>
 </div>

 {/* Pill tab bar — matches Dashboard/SurveysList design language */}
 <div style={{
 display: "inline-flex", background: D.white, borderRadius: 12,
 padding: 4, marginBottom: 20, border: `1px solid ${D.s200}`, gap: 2,
 boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
 }}>
 {TABS.map(t=>{
 const isActive = activeTab===t.id;
 return (
 <button key={t.id} onClick={()=>setActiveTab(t.id)} className="dir-tab" style={{
 padding: "8px 16px", border: "none", borderRadius: 9,
 background: isActive ? t.bg : "transparent",
 cursor: "pointer", fontSize: 12, fontFamily: "inherit",
 fontWeight: isActive ? 700 : 500,
 color: isActive ? t.color : D.s500,
 display: "flex", alignItems: "center", gap: 6,
 }}>
 <span>{t.icon}</span>{t.label}
 </button>
 );
 })}
 </div>

 <EntityTable key={activeTab} config={current.config} user={user} isAdmin={isAdmin}/>
 </div>
 );
}


