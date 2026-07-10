/**
 * ReportingCenter.jsx
 * مركز التقارير — بناء جديد كامل
 * يستخدم ReportingService.js بالكامل
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./lib.jsx";
import {
 fetchSurveyReportData,
 computeQuestionStats,
 computeAudienceStats,
 exportSurveyExcel,
 exportSurveyCSV,
 exportSurveyPDF,
 exportExecutiveExcel,
 fetchExecutiveData,
} from "./ReportingService.js";

const R = {
 e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
 e100:"#D1FAE5",e50:"#ECFDF5",
 gold:"#C9A84C",goldL:"#FEF3C7",
 purple:"#7B2D8B",purpleBg:"#F5EEFA",
 s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
 s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
 white:"#FFFFFF",bg:"#F0F4F8",
 danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
 success:"#059669",successBg:"#ECFDF5",
};

if (typeof document !== "undefined" && !document.getElementById("rep-styles")) {
 const s = document.createElement("style");
 s.id = "rep-styles";
 s.textContent = `
 .rep-card { transition: transform 0.15s, box-shadow 0.15s; }
 .rep-card:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; }
 .rep-btn { transition: all 0.12s; }
 .rep-btn:active { transform: scale(0.96); }
 @keyframes rep-in { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
 .rep-in { animation: rep-in 0.2s ease both; }
 @keyframes spin { to{transform:rotate(360deg)} }
 .rep-kpi-grid {
 display: grid;
 grid-template-columns: repeat(2, 1fr);
 gap: 10px;
 margin-bottom: 18px;
 }
 @media (min-width: 768px) {
 .rep-kpi-grid { grid-template-columns: repeat(4, 1fr); gap: 12px; }
 }
 .rep-dist-bar {
 height: 8px; background: #F1F5F9; border-radius: 6px; overflow: hidden; margin: 4px 0 2px;
 }
 .rep-dist-fill {
 height: 100%; border-radius: 6px;
 background: linear-gradient(90deg, #059669, #10B981);
 transition: width 0.5s;
 }
 `;
 document.head.appendChild(s);
}

const iSt = (extra={}) => ({
 width:"100%", padding:"10px 12px", border:`1.5px solid ${R.s200}`,
 borderRadius:10, fontSize:13, fontFamily:"inherit", direction:"rtl",
 boxSizing:"border-box", outline:"none", background:R.white, color:R.s900,
 ...extra,
});

function Spinner() {
 return (
 <div style={{textAlign:"center",padding:"50px 20px"}}>
 <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${R.e100}`,
 borderTopColor:R.e600,animation:"spin 0.7s linear infinite",margin:"0 auto 10px"}}/>
 <p style={{margin:0,color:R.s500,fontSize:13}}>جاري التحميل...</p>
 </div>
 );
}

function KPICard({ icon, label, value, color=R.e600, bg=R.e50, sub }) {
 return (
 <div className="rep-card" style={{
 background:R.white, borderRadius:16, padding:"14px 12px",
 border:`1px solid ${R.s200}`, boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
 position:"relative", overflow:"hidden",
 }}>
 <div style={{position:"absolute",top:0,right:0,left:0,height:3,
 background:`linear-gradient(90deg,${color},${color}80)`}}/>
 <div style={{width:32,height:32,borderRadius:9,background:bg,
 display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,marginBottom:8}}>
 {icon}
 </div>
 <div style={{fontSize:22,fontWeight:800,color:R.s900,letterSpacing:"-0.02em"}}>{value}</div>
 <div style={{fontSize:11,color:R.s500,marginTop:3,fontWeight:600}}>{label}</div>
 {sub && <div style={{fontSize:10,color,marginTop:2,fontWeight:700}}>{sub}</div>}
 </div>
 );
}

function ExportBar({ onExcel, onCSV, onPDF, loading }) {
 return (
 <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>
 {[
 {label:"Excel",icon:"",fn:onExcel,color:R.e600},
 {label:"CSV", icon:"",fn:onCSV, color:R.purple},
 {label:"PDF", icon:"",fn:onPDF, color:R.danger},
 ].map(({label,icon,fn,color})=>(
 <button key={label} onClick={fn} disabled={loading} className="rep-btn" style={{
 padding:"9px 16px", borderRadius:10, border:`1.5px solid ${color}30`,
 background:loading?R.s100:`${color}10`, color:loading?R.s400:color,
 fontSize:12, fontWeight:700, cursor:loading?"not-allowed":"pointer",
 fontFamily:"inherit", display:"flex", alignItems:"center", gap:6,
 }}>
 {icon} {label}
 </button>
 ))}
 {loading && (
 <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:R.s500}}>
 <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${R.e100}`,
 borderTopColor:R.e600,animation:"spin 0.7s linear infinite"}}/>
 جاري التصدير...
 </div>
 )}
 </div>
 );
}

function DistributionRow({ label, count, total }) {
 const pct = total ? Math.round(count/total*100) : 0;
 return (
 <div style={{marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
 <span style={{fontSize:12,color:R.s700,fontWeight:600}}>{label}</span>
 <span style={{fontSize:12,color:R.e700,fontWeight:800}}>{pct}% <span style={{color:R.s400,fontWeight:400}}>({count})</span></span>
 </div>
 <div className="rep-dist-bar">
 <div className="rep-dist-fill" style={{width:`${pct}%`}}/>
 </div>
 </div>
 );
}

// تبويب: التقرير التنفيذي 
function ExecutiveTab({ surveys, user, settings }) {
 const [stats, setStats] = useState({});
 const [schools, setSchools] = useState([]);
 const [loading, setLoading] = useState(true);
 const [exporting, setExporting] = useState(false);

 useEffect(()=>{
 async function load() {
 setLoading(true);
 let all=[], from=0;
 while(true) {
 const{data}=await supabase.from("survey_schools")
 .select("id,name,stage,sector").range(from,from+999);
 if(!data?.length) break;
 all=all.concat(data); if(data.length<1000) break; from+=1000;
 }
 setSchools(all);
 const s = await fetchExecutiveData(surveys);
 setStats(s);
 setLoading(false);
 }
 load();
 },[surveys]);

 const totalResponses = useMemo(()=>Object.values(stats).reduce((a,b)=>a+b,0),[stats]);
 const topSurveys = useMemo(()=>
 [...surveys].sort((a,b)=>(stats[b.id]||0)-(stats[a.id]||0)).slice(0,5)
 ,[surveys,stats]);

 async function doExport() {
 setExporting(true);
 await exportExecutiveExcel({ surveys, stats, schoolCount:schools.length, user });
 setExporting(false);
 }

 if (loading) return <Spinner/>;

 return (
 <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
 <div>
 <p style={{margin:0,fontSize:14,fontWeight:800,color:R.s900}}>التقرير التنفيذي</p>
 <p style={{margin:"2px 0 0",fontSize:12,color:R.s500}}>{surveys.length} استبيان · {schools.length} مدرسة</p>
 </div>
 <button onClick={doExport} disabled={exporting} className="rep-btn" style={{
 background:`linear-gradient(135deg,${R.e600},${R.e800})`, color:"#fff",
 border:"none", borderRadius:10, padding:"9px 16px", fontSize:12, fontWeight:700,
 cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6,
 boxShadow:`0 3px 10px ${R.e600}30`,
 }}>تصدير Excel</button>
 </div>

 <div className="rep-kpi-grid">
 <KPICard icon="" label="إجمالي الاستبيانات" value={surveys.length} color={R.e600} bg={R.e50}/>
 <KPICard icon="" label="إجمالي الردود" value={totalResponses} color={R.purple} bg={R.purpleBg}/>
 <KPICard icon="" label="إجمالي المدارس" value={schools.length} color={R.e700} bg={R.e50}/>
 <KPICard icon="" label="متوسط الاستجابة"
 value={schools.length && surveys.length
 ? `${Math.round(totalResponses/surveys.length/schools.length*100)}%`
 : "—"}
 color={R.success} bg={R.successBg}/>
 </div>

 <p style={{margin:"0 0 10px",fontSize:13,fontWeight:800,color:R.s900}}>أعلى الاستبيانات استجابةً</p>
 <div style={{background:R.white,borderRadius:16,border:`1px solid ${R.s200}`,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
 {topSurveys.map((s,i)=>{
 const count = stats[s.id]||0;
 const pct = schools.length ? Math.round(count/schools.length*100) : 0;
 return (
 <div key={s.id} style={{padding:"13px 16px",borderBottom:i<topSurveys.length-1?`1px solid ${R.s100}`:"none"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
 <p style={{margin:0,fontSize:13,fontWeight:700,color:R.s900,flex:1}}>{s.title}</p>
 <span style={{fontSize:13,fontWeight:800,color:R.e700}}>{pct}%</span>
 </div>
 <div className="rep-dist-bar">
 <div className="rep-dist-fill" style={{width:`${pct}%`}}/>
 </div>
 <p style={{margin:"4px 0 0",fontSize:11,color:R.s500}}>{count} رد</p>
 </div>
 );
 })}
 {topSurveys.length===0 && (
 <div style={{textAlign:"center",padding:"30px",color:R.s500,fontSize:13}}>لا توجد بيانات بعد</div>
 )}
 </div>
 </div>
 );
}

// تبويب: تقرير استبيان محدد 
function SurveyReportTab({ surveys, user, settings }) {
 const [selectedId, setSelectedId] = useState("");
 const [data, setData] = useState(null);
 const [allSchools, setAllSchools] = useState([]);
 const [loading, setLoading] = useState(false);
 const [exporting, setExporting] = useState(false);
 const [activeTab, setActiveTab] = useState("summary");

 useEffect(()=>{
 async function loadSchools() {
 let all=[], from=0;
 while(true) {
 const { data } = await supabase.from("survey_schools")
 .select("id,name,stage,sector,district,principal,phone").range(from,from+999);
 if(!data?.length) break;
 all=all.concat(data); if(data.length<1000) break; from+=1000;
 }
 setAllSchools(all);
 }
 loadSchools();
 },[]);

 async function loadReport(id) {
 if(!id) return;
 setLoading(true); setData(null);
 const d = await fetchSurveyReportData(id);
 setData(d);
 setLoading(false);
 }

 const qStats = useMemo(()=> data ? computeQuestionStats(data.questions, data.responses) : [], [data]);
 const audStats = useMemo(()=> data ? computeAudienceStats(data.responses, allSchools) : {byStage:{},bySector:{},byDistrict:{}}, [data,allSchools]);
 const respondedIds = useMemo(()=> new Set((data?.responses||[]).map(r=>r.school_id).filter(Boolean)), [data]);
 const pending = useMemo(()=> allSchools.filter(s=>!respondedIds.has(s.id)), [allSchools,respondedIds]);
 const pct = allSchools.length && data ? Math.round(data.responses.length/allSchools.length*100) : 0;

 async function doExcel() {
 if(!data) return; setExporting(true);
 await exportSurveyExcel({...data, allSchools, user, settings});
 setExporting(false);
 }
 async function doCSV() {
 if(!data) return; setExporting(true);
 await exportSurveyCSV({...data, user});
 setExporting(false);
 }
 async function doPDF() {
 if(!data) return; setExporting(true);
 await exportSurveyPDF({...data, allSchools, user, settings});
 setExporting(false);
 }

 const INNER_TABS = [
 {id:"summary", label:"الملخص"},
 {id:"questions",label:"الأسئلة"},
 {id:"audience", label:"الجمهور"},
 {id:"pending", label:`لم تستجب (${pending.length})`},
 {id:"detail", label:"الردود التفصيلية"},
 ];

 return (
 <div>
 <div style={{background:R.white,borderRadius:16,border:`1px solid ${R.s200}`,padding:14,marginBottom:16,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
 <label style={{display:"block",fontSize:12,fontWeight:700,color:R.s700,marginBottom:8}}>اختر الاستبيان</label>
 <select value={selectedId} onChange={e=>{setSelectedId(e.target.value);loadReport(e.target.value);setActiveTab("summary");}}
 style={{...iSt({marginBottom:0}),background:R.white}}>
 <option value="">— اختر استبياناً —</option>
 {surveys.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
 </select>
 </div>

 {loading && <Spinner/>}

 {data && !loading && (
 <>
 <ExportBar onExcel={doExcel} onCSV={doCSV} onPDF={doPDF} loading={exporting}/>

 {/* inner tabs */}
 <div style={{display:"flex",background:R.white,borderRadius:12,padding:4,marginBottom:18,
 border:`1px solid ${R.s200}`,gap:2,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",overflowX:"auto"}}>
 {INNER_TABS.map(t=>{
 const active = activeTab===t.id;
 return (
 <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
 flex:"0 0 auto", padding:"7px 14px", border:"none", borderRadius:9,
 background:active?R.e50:"transparent", cursor:"pointer",
 fontSize:11, fontFamily:"inherit", fontWeight:active?700:500,
 color:active?R.e700:R.s500, whiteSpace:"nowrap",
 }}>{t.label}</button>
 );
 })}
 </div>

 {/* ملخص */}
 {activeTab==="summary" && (
 <>
 <div className="rep-kpi-grid">
 <KPICard icon="" label="إجمالي الردود" value={data.responses.length} color={R.e600} bg={R.e50}/>
 <KPICard icon="" label="نسبة الاستجابة" value={`${pct}%`} color={R.success} bg={R.successBg}/>
 <KPICard icon="" label="لم تستجب" value={pending.length} color={R.danger} bg={R.dangerBg}/>
 <KPICard icon="" label="عدد الأسئلة" value={data.questions.length} color={R.purple} bg={R.purpleBg}/>
 </div>
 {data.survey.description && (
 <div style={{background:R.e50,border:`1px solid ${R.e100}`,borderRadius:12,padding:14,marginBottom:14}}>
 <p style={{margin:0,fontSize:13,color:R.e800,lineHeight:1.7}}>{data.survey.description}</p>
 </div>
 )}
 </>
 )}

 {/* الأسئلة */}
 {activeTab==="questions" && (
 <div>
 {qStats.map((q,i)=>(
 <div key={q.id} className="rep-card rep-in" style={{
 background:R.white,borderRadius:14,border:`1px solid ${R.s200}`,
 padding:16,marginBottom:10,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
 animationDelay:`${i*0.04}s`,
 }}>
 <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
 <span style={{background:R.e50,color:R.e700,borderRadius:8,width:24,height:24,
 display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</span>
 <div style={{flex:1}}>
 <p style={{margin:0,fontSize:13,fontWeight:700,color:R.s900}}>{q.label}</p>
 <p style={{margin:"2px 0 0",fontSize:10,color:R.s400}}>
 {q.responseCount} إجابة
 {q.type==="rating" && ` · متوسط: ${q.average}/5`}
 {q.type==="number" && ` · متوسط: ${q.average}`}
 </p>
 </div>
 </div>

 {q.type==="select" && q.distribution && (
 <div>
 {Object.entries(q.distribution)
 .sort((a,b)=>b[1]-a[1])
 .map(([opt,cnt])=>(
 <DistributionRow key={opt} label={opt} count={cnt} total={q.responseCount}/>
 ))}
 </div>
 )}

 {q.type==="rating" && q.distribution && (
 <div>
 {[5,4,3,2,1].map(n=>(
 <DistributionRow key={n} label={`${"".repeat(n)}`} count={q.distribution[n]||0} total={q.responseCount}/>
 ))}
 </div>
 )}

 {(q.type==="text"||q.type==="textarea") && (
 <p style={{margin:0,fontSize:12,color:R.s500}}>
 {q.responseCount} إجابة نصية — تظهر في التصدير التفصيلي
 </p>
 )}
 </div>
 ))}
 </div>
 )}

 {/* الجمهور */}
 {activeTab==="audience" && (
 <div>
 {Object.entries(audStats.byStage).length > 0 && (
 <>
 <p style={{margin:"0 0 10px",fontSize:13,fontWeight:800,color:R.s900}}>حسب المرحلة</p>
 <div style={{background:R.white,borderRadius:14,border:`1px solid ${R.s200}`,padding:16,marginBottom:14,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
 {Object.entries(audStats.byStage).map(([stage,d])=>(
 <DistributionRow key={stage} label={`${stage} (${d.responded}/${d.total})`}
 count={d.responded} total={d.total}/>
 ))}
 </div>
 </>
 )}
 {Object.entries(audStats.bySector).length > 0 && (
 <>
 <p style={{margin:"0 0 10px",fontSize:13,fontWeight:800,color:R.s900}}>حسب القطاع</p>
 <div style={{background:R.white,borderRadius:14,border:`1px solid ${R.s200}`,padding:16,marginBottom:14,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
 {Object.entries(audStats.bySector)
 .sort((a,b)=>b[1].responded-a[1].responded)
 .map(([sec,d])=>(
 <DistributionRow key={sec} label={`${sec} (${d.responded}/${d.total})`}
 count={d.responded} total={d.total}/>
 ))}
 </div>
 </>
 )}
 {Object.keys(audStats.byStage).length===0 && Object.keys(audStats.bySector).length===0 && (
 <div style={{textAlign:"center",padding:"40px 20px",background:R.white,borderRadius:16,border:`1px solid ${R.s200}`}}>
 <div style={{fontSize:36,marginBottom:8}}></div>
 <p style={{margin:0,color:R.s500,fontSize:13}}>لا توجد بيانات تصنيف بعد</p>
 </div>
 )}
 </div>
 )}

 {/* لم تستجب */}
 {activeTab==="pending" && (
 <div>
 {pending.length===0 ? (
 <div style={{textAlign:"center",padding:"40px 20px",background:R.white,borderRadius:16,border:`1px solid ${R.s200}`}}>
 <div style={{fontSize:36,marginBottom:8}}></div>
 <p style={{margin:0,color:R.success,fontSize:13,fontWeight:700}}>جميع المدارس استجابت!</p>
 </div>
 ) : (
 <div style={{background:R.white,borderRadius:16,border:`1px solid ${R.s200}`,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
 {pending.map((s,i)=>(
 <div key={s.id} style={{padding:"11px 16px",borderBottom:i<pending.length-1?`1px solid ${R.s100}`:"none",
 display:"flex",alignItems:"center",gap:10}}>
 <div style={{flex:1}}>
 <p style={{margin:0,fontSize:13,fontWeight:600,color:R.s900}}>{s.name}</p>
 <p style={{margin:"2px 0 0",fontSize:11,color:R.s400}}>
 {[s.stage,s.sector,s.district].filter(Boolean).join(" · ")}
 </p>
 </div>
 {s.phone && (
 <a href={`tel:${s.phone}`} style={{fontSize:11,color:R.e700,textDecoration:"none",
 background:R.e50,borderRadius:8,padding:"4px 8px",fontWeight:600}}>
 {s.phone}
 </a>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* الردود التفصيلية */}
 {activeTab==="detail" && (
 <div>
 {data.responses.length===0 ? (
 <div style={{textAlign:"center",padding:"40px 20px",background:R.white,borderRadius:16,border:`1px solid ${R.s200}`}}>
 <div style={{fontSize:36,marginBottom:8}}></div>
 <p style={{margin:0,color:R.s500,fontSize:13}}>لا توجد ردود بعد</p>
 </div>
 ) : (
 <div style={{overflowX:"auto",borderRadius:16,border:`1px solid ${R.s200}`,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
 <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
 <thead>
 <tr style={{background:R.e50,borderBottom:`1px solid ${R.s200}`}}>
 <th style={{padding:"10px 14px",textAlign:"right",fontSize:11,fontWeight:700,color:R.e700,whiteSpace:"nowrap"}}>المدرسة</th>
 <th style={{padding:"10px 14px",textAlign:"right",fontSize:11,fontWeight:700,color:R.e700,whiteSpace:"nowrap"}}>المرحلة</th>
 <th style={{padding:"10px 14px",textAlign:"right",fontSize:11,fontWeight:700,color:R.e700,whiteSpace:"nowrap"}}>التاريخ</th>
 {data.questions.slice(0,4).map(q=>(
 <th key={q.id} style={{padding:"10px 14px",textAlign:"right",fontSize:11,fontWeight:700,color:R.e700,whiteSpace:"nowrap",maxWidth:140}}>
 {q.label.slice(0,20)}{q.label.length>20?"...":""}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {data.responses.slice(0,50).map((r,i)=>(
 <tr key={r.id} style={{borderBottom:`1px solid ${R.s100}`,background:i%2===0?R.white:R.s50}}>
 <td style={{padding:"10px 14px",fontSize:12,color:R.s900,whiteSpace:"nowrap"}}>
 {r.survey_schools?.name || r.respondent_label || "—"}
 </td>
 <td style={{padding:"10px 14px",fontSize:12,color:R.s500,whiteSpace:"nowrap"}}>
 {r.survey_schools?.stage || "—"}
 </td>
 <td style={{padding:"10px 14px",fontSize:12,color:R.s500,whiteSpace:"nowrap"}}>
 {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("ar-SA") : "—"}
 </td>
 {data.questions.slice(0,4).map(q=>{
 const ans = r.answers?.[q.id];
 let display = "—";
 if(ans!==undefined&&ans!==null&&ans!=="") {
 if(typeof ans==="object") display = ans.url?"ملف":"—";
 else display = String(ans).slice(0,30);
 }
 return (
 <td key={q.id} style={{padding:"10px 14px",fontSize:12,color:R.s900}}>{display}</td>
 );
 })}
 </tr>
 ))}
 </tbody>
 </table>
 {data.responses.length>50 && (
 <p style={{textAlign:"center",padding:"8px",fontSize:11,color:R.s400,margin:0}}>
 عرض 50 من {data.responses.length} رد — صدّر للحصول على الكل
 </p>
 )}
 </div>
 )}
 </div>
 )}
 </>
 )}

 {!data && !loading && !selectedId && (
 <div style={{textAlign:"center",padding:"50px 20px",background:R.white,borderRadius:18,border:`1px solid ${R.s200}`}}>
 <div style={{fontSize:48,marginBottom:12}}></div>
 <p style={{margin:"0 0 6px",fontSize:15,fontWeight:700,color:R.s900}}>اختر استبياناً</p>
 <p style={{margin:0,fontSize:13,color:R.s500}}>سيظهر التقرير الكامل مع إمكانية التصدير</p>
 </div>
 )}
 </div>
 );
}

// الصفحة الرئيسية 
export default function ReportingCenter({ surveys, user, settings }) {
 const [activeTab, setActiveTab] = useState("executive");

 const TABS = [
 {id:"executive", label:"التقرير التنفيذي", icon:""},
 {id:"survey", label:"تقرير استبيان", icon:""},
 ];

 return (
 <div style={{direction:"rtl"}}>
 <div style={{marginBottom:18}}>
 <h1 style={{margin:0,fontSize:22,color:R.s900,fontWeight:800,letterSpacing:"-0.02em"}}>مركز التقارير</h1>
 <p style={{margin:"4px 0 0",fontSize:13,color:R.s500}}>تصدير وتحليل بيانات الاستبيانات</p>
 </div>

 <div style={{
 display:"inline-flex", background:R.white, borderRadius:12,
 padding:4, marginBottom:20, border:`1px solid ${R.s200}`, gap:2,
 boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
 }}>
 {TABS.map(t=>{
 const active = activeTab===t.id;
 return (
 <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
 padding:"8px 16px", border:"none", borderRadius:9,
 background:active?R.e50:"transparent",
 cursor:"pointer", fontSize:12, fontFamily:"inherit",
 fontWeight:active?700:500, color:active?R.e700:R.s500,
 display:"flex", alignItems:"center", gap:6,
 }}>
 <span>{t.icon}</span>{t.label}
 </button>
 );
 })}
 </div>

 {activeTab==="executive" && <ExecutiveTab surveys={surveys} user={user} settings={settings}/>}
 {activeTab==="survey" && <SurveyReportTab surveys={surveys} user={user} settings={settings}/>}
 </div>
 );
}


