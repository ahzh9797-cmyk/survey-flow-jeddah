import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ErrorBanner, ExportMenu,
 ensureXLSX, ensurePDF, pdfRTLText, tsStamp, logAction, useResponses } from "./lib.jsx";
import { SURVEY_TYPE_LABELS } from "./SurveyService.jsx";

// Premium styles 
if (typeof document !== "undefined" && !document.getElementById("tracking-premium-styles")) {
 const _s = document.createElement("style");
 _s.id = "tracking-premium-styles";
 _s.textContent = `
 .trk-row { transition: background 0.12s ease; }
 .trk-row:hover { background: #F8FAFC !important; }
 .trk-bar { transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }
 @keyframes count-in { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
 .count-in { animation: count-in 0.3s ease both; }
 @keyframes spin { to { transform: rotate(360deg) } }
 `;
 document.head.appendChild(_s);
}

const TR = {
 e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
 e100:"#D1FAE5",e50:"#ECFDF5",
 gold:"#C9A84C",goldL:"#FEF3C7",
 s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
 s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
 white:"#FFFFFF",bg:"#F0F4F8",
 danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
 success:"#059669",successBg:"#ECFDF5",purple:"#7B2D8B",purpleBg:"#F5EEFA",
};

// Shared sub-components 

function PremiumHeader({ title, subtitle, onBack, exportOptions }) {
 return (
 <div style={{
 background:`linear-gradient(135deg, ${TR.e900} 0%, ${TR.e800} 100%)`,
 padding:"14px 16px", position:"sticky", top:0, zIndex:20,
 boxShadow:"0 4px 20px rgba(6,78,59,0.3)",
 }}>
 <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
 <div style={{ display:"flex", alignItems:"center", gap:12 }}>
 <button onClick={onBack} style={{
 background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)",
 color:"#fff", borderRadius:10, width:36, height:36,
 display:"flex", alignItems:"center", justifyContent:"center",
 fontSize:18, cursor:"pointer",
 }}>←</button>
 <div>
 <div style={{ fontWeight:800, fontSize:15, color:"#fff" }}>{title}</div>
 <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", marginTop:2 }}>{subtitle}</div>
 </div>
 </div>
 {exportOptions && (
 <div style={{ background:"rgba(255,255,255,0.12)", borderRadius:10, overflow:"hidden" }}>
 <ExportMenu options={exportOptions}/>
 </div>
 )}
 </div>
 <svg viewBox="0 0 375 8" style={{ display:"block", marginBottom:-1, marginTop:8 }} preserveAspectRatio="none">
 <path d="M0,0 C120,8 255,8 375,0 L375,8 L0,8 Z" fill={TR.bg}/>
 </svg>
 </div>
 );
}

function KPICard({ icon, label, value, color, sub, delay = 0 }) {
 return (
 <div className="count-in" style={{
 background:TR.white, borderRadius:16, padding:"14px 10px",
 border:`1px solid ${TR.s200}`, textAlign:"center",
 borderTop:`3px solid ${color}`,
 boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
 animationDelay:`${delay}s`,
 }}>
 <div style={{ fontSize:22, marginBottom:4 }}>{icon}</div>
 <div style={{ fontSize:22, fontWeight:800, color, lineHeight:1, margin:"2px 0 4px" }}>{value}</div>
 <div style={{ fontSize:10, color:TR.s400, fontWeight:600 }}>{label}</div>
 {sub && <div style={{ fontSize:9, color:TR.s300, marginTop:2 }}>{sub}</div>}
 </div>
 );
}

function ProgressBar({ value, max, color = TR.e600, label, sub, height = 8 }) {
 const pct = max ? Math.min(100, Math.round(value / max * 100)) : 0;
 return (
 <div style={{ marginBottom:12 }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
 <span style={{ fontSize:13, fontWeight:600, color:TR.s900 }}>{label}</span>
 <div style={{ display:"flex", alignItems:"center", gap:8 }}>
 {sub && <span style={{ fontSize:11, color:TR.s400 }}>{sub}</span>}
 <span style={{ fontSize:13, fontWeight:800, color }}>{pct}%</span>
 </div>
 </div>
 <div style={{ height, background:TR.s100, borderRadius:height, overflow:"hidden" }}>
 <div className="trk-bar" style={{
 height:"100%", width:`${pct}%`,
 background:`linear-gradient(90deg, ${color}, ${color}bb)`,
 borderRadius:height,
 }}/>
 </div>
 </div>
 );
}

function SearchInput({ value, onChange, placeholder }) {
 return (
 <div style={{ position:"relative", marginBottom:10 }}>
 <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", fontSize:16, pointerEvents:"none" }}></span>
 <input
 value={value} onChange={onChange} placeholder={placeholder}
 style={{ width:"100%", padding:"11px 42px 11px 14px",
 border:`1.5px solid ${TR.s200}`, borderRadius:12, fontSize:13,
 fontFamily:"inherit", direction:"rtl", boxSizing:"border-box",
 background:TR.white, color:TR.s900, transition:"all 0.2s",
 }}
 onFocus={e=>{ e.target.style.borderColor=TR.e600; e.target.style.boxShadow=`0 0 0 3px rgba(5,150,105,0.12)`; }}
 onBlur={e=>{ e.target.style.borderColor=TR.s200; e.target.style.boxShadow="none"; }}
 />
 {value && (
 <button onClick={()=>onChange({target:{value:""}})} style={{
 position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
 background:"none", border:"none", color:TR.s400, cursor:"pointer", fontSize:16,
 }}></button>
 )}
 </div>
 );
}

function FilterChip({ label, active, color = TR.e600, bg, onClick }) {
 return (
 <button onClick={onClick} style={{
 padding:"7px 14px", borderRadius:20, fontSize:11, fontFamily:"inherit",
 cursor:"pointer", whiteSpace:"nowrap", fontWeight:active ? 700 : 500,
 border:`1.5px solid ${active ? color : TR.s200}`,
 background: active ? (bg || `${color}12`) : TR.white,
 color: active ? color : TR.s500,
 transition:"all 0.15s ease",
 }}>{label}</button>
 );
}

// Loading state 
function LoadingState() {
 return (
 <div style={{ minHeight:"60vh", display:"flex", flexDirection:"column",
 alignItems:"center", justifyContent:"center", gap:12 }}>
 <div style={{ width:44, height:44, borderRadius:"50%",
 border:`3px solid ${TR.e100}`, borderTopColor:TR.e600,
 animation:"spin 0.7s linear infinite" }}/>
 <p style={{ margin:0, color:TR.s500, fontSize:13 }}>جاري التحميل...</p>
 </div>
 );
}

// 
// OPEN SURVEY TRACKING
// 
function OpenSurveyTracking({ survey, onBack }) {
 // All logic unchanged 
 const { responses, loading } = useResponses(survey.id);
 const questions = (survey.questions || []).sort((a,b)=>a.order_index-b.order_index);
 const completed = responses.filter(r => r.completed !== false);
 const stoppedAtGate = responses.filter(r => r.completed === false);

 async function exportExcel() {
 const XLSX = await ensureXLSX();
 const rows = responses.map(r => {
 const base = {
 "الاسم/الجهة": r.respondent_label || "—",
 "الحالة": r.completed === false ? "توقف عند سؤال الفرز" : "مكتمل",
 "تاريخ الرد": new Date(r.submitted_at).toLocaleString("ar-SA"),
 };
 questions.forEach(q => { base[q.label] = r.answers?.[q.id] ?? ""; });
 return base;
 });
 const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "لا توجد ردود بعد": "" }]);
 ws["!cols"] = Object.keys(rows[0] || {"لا توجد ردود بعد":""}).map(() => ({ wch: 24 }));
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, "الردود");
 XLSX.writeFile(wb, `${survey.title.replace(/[\\/:*?"<>|]/g,"")}-${tsStamp()}.xlsx`);
 }
 // End unchanged logic 

 if (loading) return <LoadingState/>;

 return (
 <div style={{ background:TR.bg, minHeight:"100vh" }}>
 <PremiumHeader
 title="متابعة الاستجابة"
 subtitle={`${survey.title} · استبيان مفتوح`}
 onBack={onBack}
 exportOptions={responses.length > 0 ? [{ key:"xlsx", icon:"", label:"تصدير Excel", action:exportExcel }] : null}
 />

 <div style={{ padding:16 }}>
 {/* KPI cards */}
 <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
 <KPICard icon="" label="إجمالي الردود" value={responses.length} color={TR.e700} delay={0}/>
 <KPICard icon="" label="مكتملة" value={completed.length} color={TR.success} delay={0.05}/>
 <KPICard icon="" label="توقفت عند الفرز" value={stoppedAtGate.length} color={TR.warn} delay={0.1}/>
 </div>

 {/* Responses list */}
 {responses.length === 0 ? (
 <div style={{ textAlign:"center", padding:"40px 20px", background:TR.white,
 borderRadius:20, border:`1px solid ${TR.s200}` }}>
 <div style={{ fontSize:48, marginBottom:12 }}></div>
 <p style={{ margin:0, color:TR.s500, fontSize:13 }}>لا توجد ردود بعد</p>
 </div>
 ) : (
 <div style={{ background:TR.white, borderRadius:18, border:`1px solid ${TR.s200}`,
 overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
 {responses.map((r, i) => (
 <div key={r.id} className="trk-row" style={{
 padding:"12px 16px",
 borderBottom:i<responses.length-1?`1px solid ${TR.s100}`:undefined,
 display:"flex", justifyContent:"space-between", alignItems:"center",
 }}>
 <div>
 <p style={{ margin:0, fontSize:13, fontWeight:700, color:TR.s900 }}>
 {r.respondent_label || "بدون اسم"}
 </p>
 <p style={{ margin:"2px 0 0", fontSize:11, color:TR.s400 }}>
 {new Date(r.submitted_at).toLocaleString("ar-SA")}
 </p>
 </div>
 {r.completed === false ? (
 <span style={{ background:TR.warnBg, color:TR.warn, border:`1px solid ${TR.warn}30`,
 borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700 }}> توقف</span>
 ) : (
 <span style={{ background:TR.successBg, color:TR.success, border:`1px solid ${TR.success}30`,
 borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700 }}>مكتمل</span>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
}

// 
// SCHOOL TRACKING PAGE
// 
function TrackingPage({ survey, onBack }) {
 if (survey.survey_type === "open" ||
 survey.survey_type === "supervisor" ||
 survey.survey_type === "administrator") {
 return <OpenSurveyTracking survey={survey} onBack={onBack}/>;
 }

 // All state & logic unchanged 
 const [allSchools, setAllSchools] = useState([]);
 const [loadingSchools, setLoadingSchools] = useState(true);
 const { responses, loading: loadingResp } = useResponses(survey.id);

 const [filter, setFilter] = useState("all");
 const [search, setSearch] = useState("");
 const [stageFilter, setStageFilter] = useState("الكل");
 const [page, setPage] = useState(1);
 const PER_PAGE = 30;

 useEffect(() => {
 setLoadingSchools(true);
 async function loadAllSchools() {
 let all = [], from = 0;
 const BATCH = 1000;
 while (true) {
 const { data, error } = await supabase
 .from("survey_schools")
 .select("id,name,principal,stage")
 .order("name")
 .range(from, from + BATCH - 1);
 if (error || !data || data.length === 0) break;
 all = all.concat(data);
 if (data.length < BATCH) break;
 from += BATCH;
 }
 if (survey.target_stages?.length) {
 all = all.filter(s => survey.target_stages.includes(s.stage));
 }
 setAllSchools(all);
 setLoadingSchools(false);
 }
 loadAllSchools();
 }, []);

 const respondedIds = useMemo(() => new Set(responses.map(r=>r.school_id)), [responses]);

 const filtered = useMemo(() => allSchools.filter(s => {
 const hasResp = respondedIds.has(s.id);
 if (filter==="responded" && !hasResp) return false;
 if (filter==="pending" && hasResp) return false;
 if (stageFilter!=="الكل" && s.stage!==stageFilter) return false;
 if (search) {
 const q = search.toLowerCase();
 if (!s.name.includes(search) && !String(s.id).toLowerCase().includes(q) && !s.principal?.includes(search)) return false;
 }
 return true;
 }), [allSchools, filter, search, stageFilter, respondedIds]);

 const paginated = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
 const totalPages = Math.ceil(filtered.length/PER_PAGE);
 const pct = allSchools.length ? Math.round(respondedIds.size/allSchools.length*100) : 0;

 const stageStats = ["الابتدائية","المتوسطة","الثانوية"].map(st => {
 const total = allSchools.filter(s=>s.stage===st).length;
 const done = allSchools.filter(s=>s.stage===st && respondedIds.has(s.id)).length;
 return { stage:st, total, done, pct:total?Math.round(done/total*100):0 };
 });

 async function exportExcel() {
 const XLSX = await ensureXLSX();
 const questions = (survey.questions || []).sort((a,b)=>a.order_index-b.order_index);
 const rows = allSchools.map(s => {
 const r = responses.find(rr => rr.school_id === s.id);
 const base = {
 "الرقم الوزاري":s.id,"اسم المدرسة":s.name,"المدير/ة":s.principal||"",
 "المرحلة":s.stage,"الحالة":r?"استجابت":"لم تستجب",
 "تاريخ الرد":r?new Date(r.submitted_at).toLocaleString("ar-SA"):"",
 };
 questions.forEach(q => { base[q.label] = r?.answers?.[q.id] ?? ""; });
 return base;
 });
 const ws = XLSX.utils.json_to_sheet(rows);
 ws["!cols"] = Object.keys(rows[0]||{}).map(()=>({wch:22}));
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, "نتائج الاستبيان");
 const summaryRows = [
 {"البيان":"عنوان الاستبيان","القيمة":survey.title},
 {"البيان":"إجمالي المدارس","القيمة":allSchools.length},
 {"البيان":"عدد الردود","القيمة":respondedIds.size},
 {"البيان":"نسبة الاستجابة","القيمة":`${pct}%`},
 {},...stageStats.map(s=>({"البيان":s.stage,"القيمة":`${s.done}/${s.total} (${s.pct}%)`})),
 ];
 const ws2 = XLSX.utils.json_to_sheet(summaryRows,{skipHeader:true});
 XLSX.utils.book_append_sheet(wb, ws2, "ملخص");
 XLSX.writeFile(wb, `استبيان-${survey.title.replace(/[\\/:*?"<>|]/g,"")}-${tsStamp()}.xlsx`);
 }

 async function exportPdf() {
 const jsPDF = await ensurePDF();
 const doc = new jsPDF({orientation:"p",unit:"pt",format:"a4"});
 const W = doc.internal.pageSize.getWidth();
 let y = 50;
 doc.setFontSize(16); pdfRTLText(doc, survey.title, W-40, y); y+=22;
 doc.setFontSize(10); doc.setTextColor(110,110,110);
 pdfRTLText(doc,`تاريخ التقرير: ${new Date().toLocaleDateString("ar-SA")}`,W-40,y); y+=26;
 doc.setTextColor(20,20,20); doc.setFontSize(12);
 pdfRTLText(doc,`إجمالي المدارس: ${allSchools.length}`,W-40,y); y+=16;
 pdfRTLText(doc,`عدد الردود: ${respondedIds.size}`,W-40,y); y+=16;
 pdfRTLText(doc,`نسبة الاستجابة الإجمالية: ${pct}%`,W-40,y); y+=26;
 doc.setFontSize(11); pdfRTLText(doc,"الاستجابة حسب المرحلة",W-40,y); y+=14;
 stageStats.forEach(s => {
 const barW=200, fillW=barW*(s.pct/100);
 doc.setFillColor(220,228,228); doc.rect(40,y,barW,10,"F");
 doc.setFillColor(11,110,110); doc.rect(40,y,fillW,10,"F");
 doc.setFontSize(9); doc.setTextColor(60,60,60);
 pdfRTLText(doc,`${s.stage} ${s.done}/${s.total} (${s.pct}%)`,W-40,y+9);
 y+=22;
 });
 y+=10;
 const tableRows = allSchools.map(s => {
 const r = responses.find(rr=>rr.school_id===s.id);
 return [s.id,s.name,s.principal||"-",s.stage,r?"استجابت":"لم تستجب"];
 });
 doc.autoTable({
 startY:y, head:[["الرقم","المدرسة","المدير","المرحلة","الحالة"]],
 body:tableRows, styles:{font:"helvetica",fontSize:8,halign:"right"},
 headStyles:{fillColor:[11,110,110],halign:"right"}, margin:{left:30,right:30},
 });
 doc.save(`تقرير-${survey.title.replace(/[\\/:*?"<>|]/g,"")}-${tsStamp()}.pdf`);
 }
 // End unchanged logic 

 if (loadingSchools || loadingResp) return <LoadingState/>;

 return (
 <div style={{ background:TR.bg, minHeight:"100vh" }}>
 <PremiumHeader
 title="متابعة الاستجابة"
 subtitle={survey.title}
 onBack={onBack}
 exportOptions={[
 { key:"xlsx", icon:"", label:"تصدير Excel", action:exportExcel },
 { key:"pdf", icon:"", label:"تصدير تقرير PDF", action:exportPdf },
 ]}
 />

 <div style={{ padding:16 }}>

 {/* KPI Cards */}
 <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
 <KPICard icon="" label="استجابت" value={respondedIds.size} color={TR.success} delay={0}/>
 <KPICard icon="⏳" label="لم تستجب" value={allSchools.length-respondedIds.size} color={TR.danger} delay={0.05}/>
 <KPICard icon="" label="نسبة الاستجابة" value={`${pct}%`} color={TR.e700} delay={0.1}/>
 </div>

 {/* Overall progress */}
 <div style={{ background:TR.white, borderRadius:18, padding:16, marginBottom:14,
 border:`1px solid ${TR.s200}`, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
 <span style={{ fontSize:14, fontWeight:800, color:TR.s900 }}>التقدم الإجمالي</span>
 <span style={{ fontSize:18, fontWeight:800, color:TR.e700 }}>{pct}%</span>
 </div>
 <div style={{ height:16, background:TR.s100, borderRadius:10, overflow:"hidden" }}>
 <div className="trk-bar" style={{
 height:"100%", width:`${pct}%`,
 background:`linear-gradient(90deg, ${TR.e600}, ${TR.e500})`,
 borderRadius:10,
 }}/>
 </div>
 <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
 <span style={{ fontSize:11, color:TR.s400 }}>{respondedIds.size} استجابت</span>
 <span style={{ fontSize:11, color:TR.s400 }}>{allSchools.length} إجمالي</span>
 </div>
 </div>

 {/* Stage breakdown */}
 <div style={{ background:TR.white, borderRadius:18, padding:16, marginBottom:14,
 border:`1px solid ${TR.s200}`, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
 <p style={{ margin:"0 0 14px", fontSize:14, fontWeight:800, color:TR.s900 }}>
 الاستجابة حسب المرحلة
 </p>
 {stageStats.filter(x=>x.total>0).map((x, i) => {
 const stageColors = ["#059669","#7B2D8B","#B7791F"];
 return (
 <ProgressBar key={x.stage}
 label={x.stage}
 value={x.done} max={x.total}
 color={stageColors[i] || TR.e600}
 sub={`${x.done}/${x.total}`}/>
 );
 })}
 </div>

 {/* Search + filters */}
 <SearchInput
 value={search}
 onChange={e=>{setSearch(e.target.value);setPage(1);}}
 placeholder="ابحث باسم المدرسة أو المدير أو الرقم الوزاري..."
 />

 <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
 <FilterChip label={`الكل (${allSchools.length})`} active={filter==="all"} onClick={()=>{setFilter("all");setPage(1);}}/>
 <FilterChip label="استجابت" active={filter==="responded"} color={TR.success} bg={TR.successBg} onClick={()=>{setFilter("responded");setPage(1);}}/>
 <FilterChip label="لم تستجب" active={filter==="pending"} color={TR.danger} bg={TR.dangerBg} onClick={()=>{setFilter("pending");setPage(1);}}/>
 {["الابتدائية","المتوسطة","الثانوية"].map(s=>(
 <FilterChip key={s} label={s}
 active={stageFilter===s} color={TR.gold} bg={TR.goldL}
 onClick={()=>{setStageFilter(stageFilter===s?"الكل":s);setPage(1);}}/>
 ))}
 </div>

 <p style={{ fontSize:11, color:TR.s400, margin:"0 0 10px", fontWeight:500 }}>
 عرض {paginated.length} من {filtered.length} مدرسة
 </p>

 {/* Schools list */}
 <div style={{ background:TR.white, borderRadius:18, border:`1px solid ${TR.s200}`,
 overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", marginBottom:14 }}>
 {paginated.length === 0 ? (
 <div style={{ textAlign:"center", padding:"30px 20px" }}>
 <p style={{ margin:0, color:TR.s400, fontSize:13 }}>لا توجد نتائج مطابقة</p>
 </div>
 ) : paginated.map((s, i) => {
 const r = responses.find(r=>r.school_id===s.id);
 return (
 <div key={s.id} className="trk-row" style={{
 display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
 borderBottom:i<paginated.length-1?`1px solid ${TR.s100}`:undefined,
 background:r?`${TR.success}08`:TR.white,
 }}>
 {/* Status dot */}
 <div style={{
 width:10, height:10, borderRadius:"50%", flexShrink:0,
 background:r ? TR.success : TR.s200,
 boxShadow:r ? `0 0 6px ${TR.success}60` : "none",
 }}/>

 {/* School info */}
 <div style={{ flex:1, minWidth:0 }}>
 <p style={{ margin:0, fontSize:13, fontWeight:700, color:TR.s900,
 whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.name}</p>
 <p style={{ margin:"2px 0 0", fontSize:11, color:TR.s400,
 whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
 {s.principal} · {s.stage} · {s.id}
 </p>
 </div>

 {/* Status badge */}
 <div style={{ flexShrink:0, textAlign:"center" }}>
 {r ? (
 <>
 <span style={{ background:TR.successBg, color:TR.success, border:`1px solid ${TR.success}30`,
 borderRadius:20, padding:"4px 10px", fontSize:10, fontWeight:700, display:"block" }}>استجابت</span>
 <p style={{ margin:"3px 0 0", fontSize:9, color:TR.s400 }}>
 {new Date(r.submitted_at).toLocaleDateString("ar-SA")}
 </p>
 </>
 ) : (
 <span style={{ background:TR.s100, color:TR.s400, border:`1px solid ${TR.s200}`,
 borderRadius:20, padding:"4px 10px", fontSize:10, fontWeight:700 }}>لم تستجب</span>
 )}
 </div>
 </div>
 );
 })}
 </div>

 {/* Pagination */}
 {totalPages > 1 && (
 <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:10 }}>
 <button onClick={()=>setPage(p=>p-1)} disabled={page===1} style={{
 background:page===1?TR.s100:`linear-gradient(135deg,${TR.e600},${TR.e800})`,
 color:page===1?TR.s400:"#fff", border:"none", borderRadius:10,
 padding:"9px 18px", fontSize:12, fontWeight:700, cursor:page===1?"not-allowed":"pointer",
 fontFamily:"inherit",
 }}>السابق</button>
 <span style={{ fontSize:13, color:TR.s500, fontWeight:600, padding:"0 8px" }}>
 {page} / {totalPages}
 </span>
 <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} style={{
 background:page===totalPages?TR.s100:`linear-gradient(135deg,${TR.e600},${TR.e800})`,
 color:page===totalPages?TR.s400:"#fff", border:"none", borderRadius:10,
 padding:"9px 18px", fontSize:12, fontWeight:700, cursor:page===totalPages?"not-allowed":"pointer",
 fontFamily:"inherit",
 }}>التالي</button>
 </div>
 )}
 </div>
 </div>
 );
}

export { OpenSurveyTracking };
export default TrackingPage;


