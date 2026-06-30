/**
 * ExecutiveDashboard — لوحة التحكم التنفيذية
 * Phase 3 — Enterprise UI redesign (Microsoft 365 / Stripe language)
 *
 * Business logic, data fetching, derived stats: 100% unchanged.
 * Only the presentation layer was rebuilt to match the new
 * AppShell sidebar/topbar design system.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ExportMenu, ensureXLSX, tsStamp } from "./lib.jsx";
import { SURVEY_TYPE_LABELS } from "./SurveyService.jsx";
import { resolveState, LIFECYCLE_STATE_CONFIG } from "./SurveyLifecycleService.js";

// ── Design tokens — shared with AppShell/AppSidebar/AppTopBar ──
const D = {
  e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
  e100:"#D1FAE5",e50:"#ECFDF5",
  gold:"#C9A84C",goldL:"#FEF3C7",
  purple:"#7B2D8B",purpleBg:"#F5EEFA",
  s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
  s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
  white:"#FFFFFF",bg:"#F0F4F8",
  danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
  success:"#059669",successBg:"#ECFDF5",
};

if (typeof document !== "undefined" && !document.getElementById("dash-enterprise-styles")) {
  const s = document.createElement("style");
  s.id = "dash-enterprise-styles";
  s.textContent = `
    .dash-kpi { transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
    .dash-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; }
    .dash-row { transition: background 0.12s ease; }
    .dash-row:hover { background: ${D.s50}; }
    .dash-tab { transition: all 0.15s ease; }
    .dash-filter-select { transition: border-color 0.15s ease; }
    .dash-filter-select:focus { border-color: ${D.e600} !important; }
    @keyframes dashIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .dash-in { animation: dashIn 0.25s ease both; }
    @keyframes spin { to { transform: rotate(360deg) } }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════
// Shared visual primitives — enterprise style
// ═══════════════════════════════════════════════════════

function KPICard({ icon, label, value, sub, color = D.e600, bg, onClick, idx = 0 }) {
  return (
    <div onClick={onClick} className={`dash-kpi dash-in${onClick ? "" : ""}`}
      style={{
        background: D.white, borderRadius: 16, padding: "18px 18px 16px",
        border: `1px solid ${D.s200}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default", animationDelay: `${idx * 0.04}s`,
        position: "relative", overflow: "hidden",
      }}>
      <div style={{
        position: "absolute", top: 0, right: 0, left: 0, height: 3,
        background: `linear-gradient(90deg, ${color}, ${color}80)`,
      }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, background: bg || `${color}12`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>{icon}</div>
        {onClick && <span style={{ fontSize: 11, color: D.s400 }}>‹</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: D.s900, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: D.s500, marginTop: 4, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, value, max, color = D.e600 }) {
  const pct = max ? Math.min(100, Math.round(value / max * 100)) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: D.s700, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 800 }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: D.s100, borderRadius: 6, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          borderRadius: 6, transition: "width 0.5s",
        }} />
      </div>
      <div style={{ fontSize: 10, color: D.s400, marginTop: 3 }}>{value} من {max}</div>
    </div>
  );
}

function SectionHeader({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: D.s900 }}>{title}</h3>
        {sub && <p style={{ margin: "3px 0 0", fontSize: 11, color: D.s500 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon = "📭", message }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", background: D.white,
      borderRadius: 16, border: `1px solid ${D.s200}` }}>
      <div style={{ fontSize: 38, marginBottom: 10 }}>{icon}</div>
      <p style={{ margin: 0, color: D.s500, fontSize: 13 }}>{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${D.e100}`,
        borderTopColor: D.e600, animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
      <p style={{ margin: 0, color: D.s500, fontSize: 13 }}>جاري تحميل البيانات...</p>
    </div>
  );
}

function StateBadge({ state, cfg }) {
  return (
    <span style={{
      background: `${cfg.color || D.s400}12`, color: cfg.color || D.s400,
      border: `1px solid ${cfg.color || D.s400}30`, borderRadius: 20,
      padding: "3px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap",
    }}>{cfg.label || state}</span>
  );
}

// ═══════════════════════════════════════════════════════
// فلتر لوحة التحكم — logic unchanged, enterprise styling
// ═══════════════════════════════════════════════════════
function DashboardFilters({ filters, onChange, stages, sectors, districts, surveys }) {
  function set(k, v) { onChange({ ...filters, [k]: v }); }

  const selStyle = {
    padding: "9px 12px", border: `1.5px solid ${D.s200}`, borderRadius: 10,
    fontSize: 12, fontFamily: "inherit", background: D.white,
    minWidth: 130, outline: "none", cursor: "pointer",
  };

  const sel = (value, onCh, children) => (
    <select className="dash-filter-select" value={value} onChange={e => onCh(e.target.value)}
      style={{ ...selStyle, color: value ? D.e700 : D.s500, fontWeight: value ? 700 : 400 }}>
      {children}
    </select>
  );

  const hasFilters = filters.surveyId || filters.stage || filters.sector ||
    filters.district || filters.dateFrom || filters.dateTo;

  return (
    <div style={{
      background: D.white, borderRadius: 16, border: `1px solid ${D.s200}`,
      padding: 14, marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: D.s400, marginLeft: 2 }}>تصفية:</span>
        {sel(filters.surveyId || "", v => set("surveyId", v), <>
          <option value="">كل الاستبيانات</option>
          {surveys.map(s => <option key={s.id} value={s.id}>{s.title.slice(0, 30)}</option>)}
        </>)}
        {stages.length > 0 && sel(filters.stage || "", v => set("stage", v), <>
          <option value="">كل المراحل</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </>)}
        {sectors.length > 0 && sel(filters.sector || "", v => set("sector", v), <>
          <option value="">كل القطاعات</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </>)}
        <input type="date" value={filters.dateFrom || ""} onChange={e => set("dateFrom", e.target.value)}
          style={{ ...selStyle, minWidth: 130, direction: "ltr" }}/>
        <input type="date" value={filters.dateTo || ""} onChange={e => set("dateTo", e.target.value)}
          style={{ ...selStyle, minWidth: 130, direction: "ltr" }}/>
        {hasFilters && (
          <button onClick={() => onChange({})} style={{
            padding: "9px 14px", borderRadius: 10, border: `1px solid ${D.danger}30`,
            background: D.dangerBg, color: D.danger, fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>✕ مسح الفلاتر</button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// hook — جلب بيانات Dashboard — logic 100% unchanged
// ═══════════════════════════════════════════════════════
function useDashboardData(surveys, allSchools, filters) {
  const [responseStats,  setResponseStats]  = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading,        setLoading]        = useState(true);

  const filteredSurveys = useMemo(() => {
    let list = surveys;
    if (filters.surveyId)  list = list.filter(s => s.id === filters.surveyId);
    if (filters.dateFrom)  list = list.filter(s => s.created_at && new Date(s.created_at) >= new Date(filters.dateFrom));
    if (filters.dateTo)    list = list.filter(s => s.created_at && new Date(s.created_at) <= new Date(filters.dateTo + "T23:59"));
    return list;
  }, [surveys, filters]);

  const filteredSchools = useMemo(() => {
    let list = allSchools;
    if (filters.stage)    list = list.filter(s => s.stage    === filters.stage);
    if (filters.sector)   list = list.filter(s => s.sector   === filters.sector);
    if (filters.district) list = list.filter(s => s.district === filters.district);
    return list;
  }, [allSchools, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    const stats = {};
    for (const s of filteredSurveys) {
      const { count } = await supabase
        .from("survey_responses")
        .select("*", { count: "exact", head: true })
        .eq("survey_id", s.id);
      stats[s.id] = count || 0;
    }
    setResponseStats(stats);

    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setRecentActivity(logs || []);

    setLoading(false);
  }, [filteredSurveys]);

  useEffect(() => { load(); }, [load]);

  const derived = useMemo(() => {
    const now = new Date();
    const published = filteredSurveys.filter(s => resolveState(s) === "published");
    const draft     = filteredSurveys.filter(s => resolveState(s) === "draft");
    const closed    = filteredSurveys.filter(s => resolveState(s) === "closed");
    const archived  = filteredSurveys.filter(s => resolveState(s) === "archived");
    const paused    = filteredSurveys.filter(s => resolveState(s) === "paused");

    const closingSoon = published.filter(s => {
      const end = s.end_date || s.expires_at;
      return end && (new Date(end) - now) < 3 * 24 * 60 * 60 * 1000 && new Date(end) > now;
    });

    const totalResponses = Object.values(responseStats).reduce((a, b) => a + b, 0);
    const schoolTotal    = filteredSchools.length || 1;

    const activeCount = published.length;
    const avgRate = activeCount
      ? Math.round(published.reduce((sum, s) => sum + ((responseStats[s.id] || 0) / schoolTotal * 100), 0) / activeCount)
      : 0;

    const topSurveys = [...filteredSurveys]
      .filter(s => responseStats[s.id] > 0)
      .sort((a, b) => (responseStats[b.id] || 0) - (responseStats[a.id] || 0))
      .slice(0, 5);

    const byStage = {};
    filteredSchools.forEach(s => {
      if (s.stage) byStage[s.stage] = (byStage[s.stage] || 0) + 1;
    });

    return {
      published, draft, closed, archived, paused,
      closingSoon, totalResponses, avgRate, topSurveys, byStage,
      schoolTotal,
    };
  }, [filteredSurveys, filteredSchools, responseStats]);

  return { loading, responseStats, recentActivity, derived, filteredSurveys, filteredSchools };
}

// ═══════════════════════════════════════════════════════
// الصفحة الرئيسية
// ═══════════════════════════════════════════════════════
export default function ExecutiveDashboard({ surveys, schoolCount, onNavigate, user }) {
  const [filters,    setFilters]    = useState({});
  const [allSchools, setAllSchools] = useState([]);
  const [loadSch,    setLoadSch]    = useState(true);
  const [activeView, setActiveView] = useState("overview");

  useEffect(() => {
    async function load() {
      let all = [], from = 0;
      while (true) {
        const { data } = await supabase.from("survey_schools")
          .select("id,name,stage,sector,district,phone,principal")
          .range(from, from + 999);
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      setAllSchools(all);
      setLoadSch(false);
    }
    load();
  }, []);

  const stages    = useMemo(() => [...new Set(allSchools.map(s => s.stage).filter(Boolean))].sort(), [allSchools]);
  const sectors   = useMemo(() => [...new Set(allSchools.map(s => s.sector).filter(Boolean))].sort(), [allSchools]);
  const districts = useMemo(() => [...new Set(allSchools.map(s => s.district).filter(Boolean))].sort(), [allSchools]);

  const { loading, responseStats, recentActivity, derived, filteredSurveys, filteredSchools }
    = useDashboardData(surveys, allSchools, filters);

  const isLoading = loading || loadSch;

  async function exportDashboard() {
    const XLSX = await ensureXLSX();
    const wb   = XLSX.utils.book_new();

    const kpiRows = [
      ["البيان", "القيمة"],
      ["إجمالي الاستبيانات", filteredSurveys.length],
      ["منشورة", derived.published.length],
      ["مسودة",  derived.draft.length],
      ["مغلقة",  derived.closed.length],
      ["مؤرشفة", derived.archived.length],
      ["إجمالي الردود", derived.totalResponses],
      ["متوسط الاستجابة", `${derived.avgRate}%`],
      ["إجمالي المدارس", filteredSchools.length],
      ["تنتهي قريباً", derived.closingSoon.length],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiRows), "مؤشرات الأداء");

    if (derived.topSurveys.length) {
      const topRows = derived.topSurveys.map(s => ({
        "الاستبيان": s.title,
        "الردود": responseStats[s.id] || 0,
        "نسبة الاستجابة": `${Math.round((responseStats[s.id] || 0) / filteredSchools.length * 100)}%`,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topRows), "أفضل الاستبيانات");
    }

    XLSX.writeFile(wb, `لوحة-التحكم-${tsStamp()}.xlsx`);
  }

  const VIEWS = [
    { id: "overview",  label: "نظرة عامة", icon: "🏠" },
    { id: "surveys",   label: "الاستبيانات", icon: "📋" },
    { id: "audience",  label: "الجمهور", icon: "👥" },
    { id: "activity",  label: "النشاط", icon: "📜" },
  ];

  return (
    <div style={{ direction: "rtl" }}>
      {/* الرأس */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: D.s900, fontWeight: 800, letterSpacing: "-0.02em" }}>
            لوحة التحكم التنفيذية
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: D.s500 }}>
            {new Date().toLocaleDateString("ar-SA", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
          </p>
        </div>
        <button onClick={exportDashboard} style={{
          background: `linear-gradient(135deg,${D.e600},${D.e800})`, color: "#fff",
          border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          boxShadow: `0 3px 10px ${D.e600}35`,
        }}>📊 تصدير Excel</button>
      </div>

      {/* الفلاتر */}
      <DashboardFilters
        filters={filters} onChange={setFilters}
        stages={stages} sectors={sectors} districts={districts}
        surveys={surveys}
      />

      {/* تبويبات العرض — pill style matching new design language */}
      <div style={{
        display: "inline-flex", background: D.white, borderRadius: 12,
        padding: 4, marginBottom: 20, border: `1px solid ${D.s200}`, gap: 2,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        {VIEWS.map(v => {
          const isActive = activeView === v.id;
          return (
            <button key={v.id} onClick={() => setActiveView(v.id)} className="dash-tab" style={{
              padding: "8px 16px", border: "none", borderRadius: 9,
              background: isActive ? D.e50 : "transparent",
              cursor: "pointer", fontSize: 12, fontFamily: "inherit",
              fontWeight: isActive ? 700 : 500,
              color: isActive ? D.e700 : D.s500,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{v.icon}</span>{v.label}
            </button>
          );
        })}
      </div>

      {isLoading ? <LoadingState/> : (
        <>
          {/* ── نظرة عامة ── */}
          {activeView === "overview" && (
            <>
              {/* KPI Cards */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12, marginBottom: 20,
              }}>
                <KPICard idx={0} icon="✅" label="منشورة" value={derived.published.length}
                  color={D.success} bg={D.successBg} onClick={() => onNavigate?.("surveys")}/>
                <KPICard idx={1} icon="📝" label="مسودة" value={derived.draft.length}
                  color={D.s500} bg={D.s100} onClick={() => onNavigate?.("surveys")}/>
                <KPICard idx={2} icon="📊" label="إجمالي الردود" value={derived.totalResponses}
                  color={D.e600} bg={D.e50}/>
                <KPICard idx={3} icon="📈" label="متوسط الاستجابة" value={`${derived.avgRate}%`}
                  color={D.purple} bg={D.purpleBg}/>
                <KPICard idx={4} icon="🔒" label="مغلقة" value={derived.closed.length}
                  color={D.danger} bg={D.dangerBg}/>
                <KPICard idx={5} icon="📦" label="مؤرشفة" value={derived.archived.length}
                  color={D.s500} bg={D.s100}/>
              </div>

              {/* تنبيه — ينتهي قريباً */}
              {derived.closingSoon.length > 0 && (
                <div style={{
                  background: D.warnBg, border: `1px solid ${D.warn}30`, borderRadius: 16,
                  padding: 16, marginBottom: 18,
                }}>
                  <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: D.warn,
                    display: "flex", alignItems: "center", gap: 6 }}>
                    ⏰ {derived.closingSoon.length} استبيان ينتهي خلال 3 أيام
                  </p>
                  {derived.closingSoon.map((s, i) => {
                    const end = s.end_date || s.expires_at;
                    return (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "8px 0",
                        borderTop: i > 0 ? `1px solid ${D.warn}20` : "none" }}>
                        <span style={{ fontSize: 13, color: D.s900, fontWeight: 600 }}>{s.title}</span>
                        <span style={{ fontSize: 11, color: D.warn, fontWeight: 700,
                          background: D.white, borderRadius: 8, padding: "3px 8px" }}>
                          {new Date(end).toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* أفضل الاستبيانات */}
              <SectionHeader title="🏆 أعلى الاستبيانات استجابةً" sub="حسب عدد الردود"/>
              {derived.topSurveys.length === 0
                ? <EmptyState icon="📭" message="لا توجد ردود بعد"/>
                : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {derived.topSurveys.map((s, idx) => {
                      const count = responseStats[s.id] || 0;
                      const pct   = filteredSchools.length ? Math.round(count / filteredSchools.length * 100) : 0;
                      return (
                        <div key={s.id} className="dash-in" style={{
                          background: D.white, borderRadius: 14, border: `1px solid ${D.s200}`,
                          padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", animationDelay: `${idx*0.04}s`,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: D.s900, flex: 1 }}>{s.title}</p>
                            <span style={{ fontSize: 15, fontWeight: 800, color: D.e700 }}>{pct}%</span>
                          </div>
                          <div style={{ height: 7, background: D.s100, borderRadius: 6, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`,
                              background: `linear-gradient(90deg, ${D.e600}, ${D.e500})`,
                              borderRadius: 6, transition: "width 0.5s" }}/>
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 11, color: D.s500 }}>
                            {count} رد · {SURVEY_TYPE_LABELS[s.survey_type] || "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </>
          )}

          {/* ── الاستبيانات ── */}
          {activeView === "surveys" && (
            <>
              <SectionHeader title="📋 جميع الاستبيانات" sub={`${filteredSurveys.length} استبيان`}/>
              {filteredSurveys.length === 0
                ? <EmptyState icon="📋" message="لا توجد استبيانات"/>
                : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {filteredSurveys.map((s, idx) => {
                      const state  = resolveState(s);
                      const cfg    = LIFECYCLE_STATE_CONFIG[state] || {};
                      const count  = responseStats[s.id] || 0;
                      const total  = filteredSchools.length;
                      const pct    = total ? Math.round(count / total * 100) : 0;
                      const end    = s.end_date || s.expires_at;
                      const expiring = end && (new Date(end) - new Date()) < 3*24*60*60*1000 && new Date(end) > new Date();

                      return (
                        <div key={s.id} className="dash-in" style={{
                          background: D.white, borderRadius: 14, border: `1px solid ${D.s200}`,
                          padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", animationDelay: `${idx*0.03}s`,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: D.s900 }}>{s.title}</p>
                              <p style={{ margin: "3px 0 0", fontSize: 11, color: D.s500 }}>
                                {SURVEY_TYPE_LABELS[s.survey_type] || "—"} ·{" "}
                                {s.created_at ? new Date(s.created_at).toLocaleDateString("ar-SA") : "—"}
                              </p>
                            </div>
                            <StateBadge state={state} cfg={cfg}/>
                          </div>
                          {state === "published" && (
                            <>
                              <MiniBar value={count} max={total} color={D.e600}
                                label={`${count} من ${total} استجابت`}/>
                              {expiring && (
                                <p style={{ margin: "0", fontSize: 11, color: D.warn, fontWeight: 700,
                                  display: "flex", alignItems: "center", gap: 4 }}>
                                  ⚠️ ينتهي {new Date(end).toLocaleDateString("ar-SA")}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </>
          )}

          {/* ── الجمهور ── */}
          {activeView === "audience" && (
            <>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12, marginBottom: 20,
              }}>
                <KPICard idx={0} icon="🏫" label="إجمالي المدارس" value={filteredSchools.length}
                  color={D.e600} bg={D.e50}/>
                <KPICard idx={1} icon="🎓" label="المراحل الدراسية" value={Object.keys(derived.byStage).length}
                  color={D.purple} bg={D.purpleBg}/>
              </div>

              {Object.keys(derived.byStage).length > 0 && (
                <>
                  <SectionHeader title="توزيع المدارس حسب المرحلة"/>
                  <div style={{ background: D.white, borderRadius: 16, border: `1px solid ${D.s200}`,
                    padding: 18, marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    {Object.entries(derived.byStage).map(([stage, count]) => (
                      <MiniBar key={stage} label={`${stage} (${count})`}
                        value={count} max={filteredSchools.length}/>
                    ))}
                  </div>
                </>
              )}

              {sectors.length > 0 && (
                <>
                  <SectionHeader title="أكثر القطاعات استجابةً"/>
                  <div style={{ background: D.white, borderRadius: 16, border: `1px solid ${D.s200}`,
                    padding: 18, marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    {sectors.map(sec => {
                      const secSchools = filteredSchools.filter(s => s.sector === sec);
                      return (
                        <MiniBar key={sec}
                          label={`${sec} (${secSchools.length})`}
                          value={secSchools.length}
                          max={filteredSchools.length}
                          color={D.purple}/>
                      );
                    })}
                  </div>
                </>
              )}

              {(() => {
                const noPhone = filteredSchools.filter(s => !s.phone).length;
                if (!noPhone) return null;
                return (
                  <div style={{ background: D.warnBg, border: `1px solid ${D.warn}30`, borderRadius: 14, padding: 16 }}>
                    <p style={{ margin: 0, fontSize: 13, color: D.warn, fontWeight: 700,
                      display: "flex", alignItems: "center", gap: 6 }}>
                      ⚠️ {noPhone} مدرسة بدون رقم جوال — لا يمكن إرسال تذكيرات لها
                    </p>
                  </div>
                );
              })()}
            </>
          )}

          {/* ── النشاط الأخير ── */}
          {activeView === "activity" && (
            <>
              <SectionHeader title="📜 آخر الأنشطة" sub="آخر 20 عملية في النظام"/>
              {recentActivity.length === 0
                ? <EmptyState icon="📜" message="لا يوجد نشاط بعد"/>
                : (
                  <div style={{ background: D.white, borderRadius: 16, border: `1px solid ${D.s200}`,
                    overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    {recentActivity.map((log, i) => (
                      <div key={log.id} className="dash-row" style={{ padding: "13px 16px",
                        borderBottom: i < recentActivity.length-1 ? `1px solid ${D.s100}` : "none",
                        display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10,
                          background: D.e50, display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                          {log.action?.includes("create") ? "➕"
                            : log.action?.includes("delete") ? "🗑️"
                            : log.action?.includes("publish") ? "🚀"
                            : log.action?.includes("archive") ? "📦"
                            : log.action?.includes("export") ? "📊"
                            : "✏️"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, color: D.s900, fontWeight: 600 }}>
                            {log.record_label || log.action || "—"}
                          </p>
                          <p style={{ margin: "3px 0 0", fontSize: 11, color: D.s400 }}>
                            {log.user_email || "—"} ·{" "}
                            {new Date(log.created_at).toLocaleString("ar-SA")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </>
          )}
        </>
      )}
    </div>
  );
}

