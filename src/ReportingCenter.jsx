/**
 * ReportingCenter — مركز التقارير الاحترافية
 * Module B2
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ExportMenu, useAppSettings } from "./lib.jsx";
import { SURVEY_TYPE_LABELS } from "./SurveyService.jsx";
import { resolveTargetedSchools } from "./TargetingService.jsx";
import {
  fetchSurveyReportData, fetchExecutiveData,
  computeQuestionStats, computeAudienceStats,
  exportSurveyExcel, exportSurveyCSV, exportSurveyPDF,
  exportExecutiveExcel,
} from "./ReportingService.js";

// ═══════════════════════════════════════════════════════
// مكوّنات مشتركة — قابلة لإعادة الاستخدام
// ═══════════════════════════════════════════════════════

export function StatCard({ icon, label, value, color = C.primary, sub }) {
  return (
    <div style={{ background:C.white, borderRadius:16, padding:16, border:`1px solid ${C.border}`,
      borderTop:`3px solid ${color}`, boxShadow:"0 2px 8px rgba(0,0,0,0.06)", textAlign:"center" }}>
      <div style={{ fontSize:26, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:24, fontWeight:800, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color, marginTop:2, fontWeight:600 }}>{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, color = C.primary, label, showPct = true }) {
  const pct = max ? Math.round(value/max*100) : 0;
  return (
    <div style={{ marginBottom:10 }}>
      {label && (
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ fontSize:13, color:C.dark }}>{label}</span>
          {showPct && <span style={{ fontSize:12, fontWeight:700, color }}>{pct}%</span>}
        </div>
      )}
      <div style={{ height:10, background:C.border, borderRadius:6, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`,
          background:`linear-gradient(90deg,${color},${color}cc)`,
          borderRadius:6, transition:"width 0.4s" }}/>
      </div>
      {!label && showPct && (
        <div style={{ textAlign:"left", fontSize:11, color:C.muted, marginTop:2 }}>{value}/{max}</div>
      )}
    </div>
  );
}

export function FilterPanel({ filters, onChange, surveys = [] }) {
  function set(k,v) { onChange({...filters,[k]:v}); }

  const inputStyle = { padding:"8px 12px", border:`1.5px solid ${C.border}`, borderRadius:10,
    fontSize:13, fontFamily:"inherit", background:C.white, color:C.text, cursor:"pointer" };

  return (
    <Card style={{ marginBottom:14 }}>
      <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>🔍 الفلاتر</p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
        <div style={{ flex:1, minWidth:160 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:4 }}>الاستبيان</label>
          <select value={filters.surveyId||""} onChange={e=>set("surveyId",e.target.value)}
            style={{ ...inputStyle, width:"100%" }}>
            <option value="">كل الاستبيانات</option>
            {surveys.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <div style={{ flex:1, minWidth:130 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:4 }}>نوع المستهدف</label>
          <select value={filters.surveyType||""} onChange={e=>set("surveyType",e.target.value)}
            style={{ ...inputStyle, width:"100%" }}>
            <option value="">الكل</option>
            {Object.entries(SURVEY_TYPE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div style={{ flex:1, minWidth:130 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:4 }}>الحالة</label>
          <select value={filters.status||""} onChange={e=>set("status",e.target.value)}
            style={{ ...inputStyle, width:"100%" }}>
            <option value="">الكل</option>
            <option value="published">✅ منشور</option>
            <option value="draft">📝 مسودة</option>
            <option value="closed">🔒 مغلق</option>
            <option value="archived">📦 مؤرشف</option>
          </select>
        </div>
        <div style={{ flex:1, minWidth:130 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:4 }}>من تاريخ</label>
          <input type="date" value={filters.dateFrom||""} onChange={e=>set("dateFrom",e.target.value)}
            style={{ ...inputStyle, width:"100%", direction:"ltr" }}/>
        </div>
        <div style={{ flex:1, minWidth:130 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:4 }}>إلى تاريخ</label>
          <input type="date" value={filters.dateTo||""} onChange={e=>set("dateTo",e.target.value)}
            style={{ ...inputStyle, width:"100%", direction:"ltr" }}/>
        </div>
      </div>
      {(filters.surveyId||filters.surveyType||filters.status||filters.dateFrom||filters.dateTo) && (
        <button onClick={()=>onChange({})} style={{ marginTop:10, background:"none",
          border:`1px solid ${C.danger}`, borderRadius:20, padding:"4px 12px",
          fontSize:11, color:C.danger, cursor:"pointer", fontFamily:"inherit" }}>
          ✕ مسح الفلاتر
        </button>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// التقرير التنفيذي
// ═══════════════════════════════════════════════════════
function ExecutiveReport({ surveys, user, schoolCount }) {
  const [stats,   setStats]   = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const { settings } = useAppSettings();

  useEffect(() => {
    setLoading(true);
    fetchExecutiveData(surveys).then(s=>{ setStats(s); setLoading(false); });
  }, [surveys]);

  const filtered = useMemo(() => {
    let list = surveys;
    if (filters.surveyType) list = list.filter(s=>s.survey_type===filters.surveyType);
    if (filters.status)     list = list.filter(s=>(s.survey_status||"published")===filters.status);
    if (filters.dateFrom)   list = list.filter(s=>s.created_at && new Date(s.created_at)>=new Date(filters.dateFrom));
    if (filters.dateTo)     list = list.filter(s=>s.created_at && new Date(s.created_at)<=new Date(filters.dateTo+"T23:59"));
    return list;
  }, [surveys, filters]);

  const totalResponses = filtered.reduce((a,s)=>a+(stats[s.id]||0), 0);
  const activeSurveys  = filtered.filter(s=>(s.survey_status||"published")==="published").length;
  const avgPct = schoolCount && filtered.length
    ? Math.round(totalResponses / filtered.length / schoolCount * 100) : 0;

  if (loading) return <div style={{ textAlign:"center", padding:40 }}><Spinner size={28}/></div>;

  return (
    <div>
      <FilterPanel filters={filters} onChange={setFilters} surveys={surveys}/>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:20 }}>
        <StatCard icon="📋" label="إجمالي الاستبيانات" value={filtered.length} color={C.primary}/>
        <StatCard icon="✅" label="استبيانات نشطة" value={activeSurveys} color={C.success}/>
        <StatCard icon="📝" label="إجمالي الردود" value={totalResponses} color={C.accent}/>
        <StatCard icon="📊" label="متوسط الاستجابة" value={`${avgPct}%`} color="#7B2D8B"/>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <p style={{ margin:0, fontSize:13, color:C.muted }}>{filtered.length} استبيان</p>
        <ExportMenu options={[
          { key:"xlsx", icon:"📊", label:"تصدير Excel",
            action:()=>exportExecutiveExcel({surveys:filtered, stats, schoolCount, user, settings}) },
        ]}/>
      </div>

      {filtered.map(s => {
        const count = stats[s.id]||0;
        const pct   = schoolCount ? Math.round(count/schoolCount*100) : 0;
        const state = s.survey_status || "published";
        const stateConfig = {
          published:{color:C.success,label:"✅ نشط"},
          draft:{color:C.muted,label:"📝 مسودة"},
          closed:{color:C.danger,label:"🔒 مغلق"},
          archived:{color:C.muted,label:"📦 مؤرشف"},
          paused:{color:C.warn,label:"⏸️ موقوف"},
        }[state]||{color:C.muted,label:state};

        return (
          <Card key={s.id} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark }}>{s.title}</p>
                <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>
                  {SURVEY_TYPE_LABELS[s.survey_type]||"—"} ·
                  {s.created_at ? new Date(s.created_at).toLocaleDateString("ar-SA") : "—"}
                </p>
              </div>
              <span style={{ background:`${stateConfig.color}15`, color:stateConfig.color,
                border:`1px solid ${stateConfig.color}40`, borderRadius:20,
                padding:"3px 10px", fontSize:11, fontWeight:700, flexShrink:0 }}>
                {stateConfig.label}
              </span>
            </div>
            <ProgressBar value={count} max={schoolCount} color={C.primary}
              label={`${count} من ${schoolCount} مدرسة`}/>
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// تقرير استبيان محدد
// ═══════════════════════════════════════════════════════
function SurveyDetailReport({ surveys, user }) {
  const [selectedId, setSelectedId] = useState("");
  const [data,       setData]       = useState(null);
  const [allSchools, setAllSchools] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const { settings } = useAppSettings();

  // جلب المدارس مرة واحدة
  useEffect(() => {
    async function load() {
      let all=[], from=0;
      while(true) {
        const{data}=await supabase.from("survey_schools")
          .select("id,name,stage,sector,district,principal,phone").range(from,from+999);
        if(!data?.length) break; all=all.concat(data);
        if(data.length<1000) break; from+=1000;
      }
      setAllSchools(all);
    }
    load();
  }, []);

  async function loadReport(surveyId) {
    if (!surveyId) return;
    setLoading(true);
    const reportData = await fetchSurveyReportData(surveyId);
    setData(reportData);
    setLoading(false);
  }

  useEffect(() => { loadReport(selectedId); }, [selectedId]);

  const qStats     = useMemo(() => data ? computeQuestionStats(data.questions, data.responses) : [], [data]);
  const audStats   = useMemo(() => data ? computeAudienceStats(data.responses, allSchools) : {byStage:{},bySector:{},byDistrict:{}}, [data, allSchools]);
  const respondedIds = useMemo(() => new Set(data?.responses?.map(r=>r.school_id).filter(Boolean)||[]), [data]);

  async function handleExport(format) {
    if (!data) return;
    setExporting(true);
    try {
      const params = { survey:data.survey, responses:data.responses, questions:data.questions, allSchools, user, settings };
      if (format==="xlsx") await exportSurveyExcel(params);
      if (format==="csv")  await exportSurveyCSV(params);
      if (format==="pdf")  await exportSurveyPDF(params);
    } finally { setExporting(false); }
  }

  return (
    <div>
      <Card style={{ marginBottom:14 }}>
        <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>
          اختر الاستبيان
        </label>
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)}
          style={{ width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`,
            borderRadius:10, fontSize:14, fontFamily:"inherit", background:C.white, direction:"rtl" }}>
          <option value="">— اختر استبياناً —</option>
          {surveys.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </Card>

      {loading && <div style={{ textAlign:"center", padding:40 }}><Spinner size={28}/></div>}

      {data && !loading && (
        <>
          {/* رأس التقرير */}
          <Card style={{ marginBottom:14, background:C.primaryBg, border:`1px solid ${C.primary}30` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <p style={{ margin:0, fontSize:16, fontWeight:800, color:C.dark }}>{data.survey.title}</p>
                <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>
                  {SURVEY_TYPE_LABELS[data.survey.survey_type]||"—"} ·
                  {data.survey.created_at ? new Date(data.survey.created_at).toLocaleDateString("ar-SA") : "—"}
                </p>
              </div>
              <ExportMenu options={[
                {key:"xlsx", icon:"📊", label:"Excel", action:()=>handleExport("xlsx")},
                {key:"pdf",  icon:"📄", label:"PDF",   action:()=>handleExport("pdf")},
                {key:"csv",  icon:"📋", label:"CSV",   action:()=>handleExport("csv")},
              ]}/>
            </div>
          </Card>

          {/* الإحصاءات الرئيسية */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
            <StatCard icon="📝" label="عدد الردود" value={data.responses.length} color={C.success}/>
            <StatCard icon="❓" label="عدد الأسئلة" value={data.questions.length} color={C.primary}/>
            <StatCard icon="📊" label="نسبة الاستجابة"
              value={allSchools.length ? `${Math.round(data.responses.length/allSchools.length*100)}%` : "—"}
              color={C.accent}/>
            <StatCard icon="⏳" label="لم تستجب"
              value={allSchools.length - respondedIds.size}
              color={C.danger}/>
          </div>

          {/* حسب المرحلة */}
          {Object.keys(audStats.byStage).length > 0 && (
            <Card style={{ marginBottom:14 }}>
              <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>
                الاستجابة حسب المرحلة
              </p>
              {Object.entries(audStats.byStage).map(([stage,d]) => (
                <ProgressBar key={stage}
                  value={d.responded} max={d.total}
                  label={`${stage} (${d.responded}/${d.total})`}/>
              ))}
            </Card>
          )}

          {/* حسب القطاع */}
          {Object.keys(audStats.bySector).length > 0 && (
            <Card style={{ marginBottom:14 }}>
              <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>
                الاستجابة حسب القطاع
              </p>
              {Object.entries(audStats.bySector).map(([sec,d]) => (
                <ProgressBar key={sec}
                  value={d.responded} max={d.total}
                  color="#7B2D8B"
                  label={`${sec} (${d.responded}/${d.total})`}/>
              ))}
            </Card>
          )}

          {/* إحصاءات الأسئلة */}
          {qStats.filter(q=>q.type==="select"||q.type==="rating").map(q => (
            <Card key={q.id} style={{ marginBottom:12 }}>
              <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.dark }}>
                {q.label}
                <span style={{ fontSize:11, fontWeight:400, color:C.muted, marginRight:6 }}>
                  ({q.responseCount} إجابة)
                </span>
              </p>
              {q.type==="select" && q.distribution && (
                <div>
                  {Object.entries(q.distribution)
                    .sort((a,b)=>b[1]-a[1])
                    .map(([opt,cnt]) => (
                      <ProgressBar key={opt}
                        value={cnt} max={q.responseCount}
                        color={C.accent}
                        label={opt}/>
                    ))}
                </div>
              )}
              {q.type==="rating" && (
                <div>
                  <p style={{ fontSize:20, fontWeight:800, color:C.accent, margin:"0 0 8px" }}>
                    ⭐ {q.average} / 5
                  </p>
                  {q.distribution && Object.entries(q.distribution)
                    .sort((a,b)=>Number(b[0])-Number(a[0]))
                    .map(([stars,cnt]) => (
                      <ProgressBar key={stars}
                        value={cnt} max={q.responseCount}
                        color={C.accent}
                        label={`${"★".repeat(Number(stars))} (${cnt})`}/>
                    ))}
                </div>
              )}
            </Card>
          ))}

          {/* جدول المدارس غير المستجيبة */}
          {allSchools.filter(s=>!respondedIds.has(s.id)).length > 0 && (
            <Card style={{ marginBottom:14 }}>
              <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.danger }}>
                ⏳ المدارس غير المستجيبة ({allSchools.filter(s=>!respondedIds.has(s.id)).length})
              </p>
              <div style={{ maxHeight:240, overflowY:"auto" }}>
                {allSchools.filter(s=>!respondedIds.has(s.id)).slice(0,50).map(s => (
                  <div key={s.id} style={{ display:"flex", justifyContent:"space-between",
                    padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                    <div>
                      <p style={{ margin:0, fontSize:12, fontWeight:600, color:C.dark }}>{s.name}</p>
                      <p style={{ margin:0, fontSize:10, color:C.muted }}>{s.stage||"—"} · {s.sector||"—"}</p>
                    </div>
                    <p style={{ margin:0, fontSize:11, color:C.muted, alignSelf:"center" }}>
                      {s.phone ? "📱" : "—"}
                    </p>
                  </div>
                ))}
                {allSchools.filter(s=>!respondedIds.has(s.id)).length > 50 && (
                  <p style={{ textAlign:"center", fontSize:11, color:C.muted, padding:"8px 0", margin:0 }}>
                    ...و{allSchools.filter(s=>!respondedIds.has(s.id)).length-50} مدرسة أخرى
                  </p>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// تقرير الجمهور
// ═══════════════════════════════════════════════════════
function AudienceReport({ surveys, user }) {
  const [allSchools, setAllSchools] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filters,    setFilters]    = useState({});

  useEffect(() => {
    async function load() {
      let all=[], from=0;
      while(true) {
        const{data}=await supabase.from("survey_schools")
          .select("id,name,stage,sector,district,status").range(from,from+999);
        if(!data?.length) break; all=all.concat(data);
        if(data.length<1000) break; from+=1000;
      }
      setAllSchools(all); setLoading(false);
    }
    load();
  }, []);

  const stages    = useMemo(()=>[...new Set(allSchools.map(s=>s.stage).filter(Boolean))].sort(),[allSchools]);
  const sectors   = useMemo(()=>[...new Set(allSchools.map(s=>s.sector).filter(Boolean))].sort(),[allSchools]);
  const districts = useMemo(()=>[...new Set(allSchools.map(s=>s.district).filter(Boolean))].sort(),[allSchools]);

  const byStage    = useMemo(()=>stages.map(st=>({ name:st, count:allSchools.filter(s=>s.stage===st).length })),[allSchools,stages]);
  const bySector   = useMemo(()=>sectors.map(sec=>({ name:sec, count:allSchools.filter(s=>s.sector===sec).length })),[allSchools,sectors]);
  const byDistrict = useMemo(()=>districts.map(d=>({ name:d, count:allSchools.filter(s=>s.district===d).length })).sort((a,b)=>b.count-a.count),[allSchools,districts]);

  if (loading) return <div style={{ textAlign:"center", padding:40 }}><Spinner size={28}/></div>;

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
        <StatCard icon="🏫" label="إجمالي المدارس" value={allSchools.length} color={C.primary}/>
        <StatCard icon="🎓" label="المراحل الدراسية" value={stages.length} color="#7B2D8B"/>
        <StatCard icon="🗺️" label="القطاعات" value={sectors.length} color={C.accent}/>
        <StatCard icon="📍" label="الأحياء" value={districts.length} color="#B7791F"/>
      </div>

      {byStage.length > 0 && (
        <Card style={{ marginBottom:14 }}>
          <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>حسب المرحلة</p>
          {byStage.map(({name,count}) => (
            <ProgressBar key={name} value={count} max={allSchools.length} label={`${name} (${count})`}/>
          ))}
        </Card>
      )}

      {bySector.length > 0 && (
        <Card style={{ marginBottom:14 }}>
          <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>حسب القطاع</p>
          {bySector.map(({name,count}) => (
            <ProgressBar key={name} value={count} max={allSchools.length} color="#7B2D8B"
              label={`${name} (${count})`}/>
          ))}
        </Card>
      )}

      {byDistrict.length > 0 && (
        <Card style={{ marginBottom:14 }}>
          <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.dark }}>
            أبرز الأحياء (أعلى 15)
          </p>
          {byDistrict.slice(0,15).map(({name,count}) => (
            <ProgressBar key={name} value={count} max={allSchools.length} color="#B7791F"
              label={`${name} (${count})`}/>
          ))}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// الصفحة الرئيسية
// ═══════════════════════════════════════════════════════
export default function ReportingCenter({ surveys, user, schoolCount }) {
  const [activeTab, setActiveTab] = useState("executive");

  const TABS = [
    { id:"executive",  label:"📊 تنفيذي",     component:<ExecutiveReport surveys={surveys} user={user} schoolCount={schoolCount}/> },
    { id:"survey",     label:"📋 استبيان",     component:<SurveyDetailReport surveys={surveys} user={user}/> },
    { id:"audience",   label:"👥 الجمهور",    component:<AudienceReport surveys={surveys} user={user}/> },
  ];

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      <h2 style={{ margin:"0 0 4px", fontSize:18, color:C.dark, fontWeight:800 }}>مركز التقارير</h2>
      <p style={{ margin:"0 0 16px", fontSize:12, color:C.muted }}>تقارير احترافية قابلة للتصدير</p>

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

