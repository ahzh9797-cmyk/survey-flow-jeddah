/**
 * ExecutiveDashboard — لوحة التحكم التنفيذية
 * Phase C — Module 1
 *
 * يُعيد استخدام: useSurveys, useSchoolCount, useAppSettings من lib.jsx
 * يُعيد استخدام: resolveTargetedSchools من TargetingService.jsx
 * يُعيد استخدام: SURVEY_TYPE_LABELS من SurveyService.jsx
 * يُعيد استخدام: LIFECYCLE_STATE_CONFIG من SurveyLifecycleService.js
 * يُعيد استخدام: Card, Btn, Spinner, Tag, ExportMenu من lib.jsx
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ExportMenu, ensureXLSX, tsStamp } from "./lib.jsx";
import { SURVEY_TYPE_LABELS } from "./SurveyService.jsx";
import { resolveState, LIFECYCLE_STATE_CONFIG } from "./SurveyLifecycleService.js";

// ═══════════════════════════════════════════════════════
// مكوّنات بصرية مشتركة
// ═══════════════════════════════════════════════════════

function KPICard({ icon, label, value, sub, color = C.primary, onClick }) {
  return (
    <div onClick={onClick}
      className={onClick ? "card-hover" : undefined}
      style={{
        background: C.white, borderRadius: 16, padding: 16,
        border: `1px solid ${C.border}`, borderTop: `3px solid ${color}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textAlign: "center",
        cursor: onClick ? "pointer" : "default",
      }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, value, max, color = C.primary }) {
  const pct = max ? Math.min(100, Math.round(value / max * 100)) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: C.dark, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: C.border, borderRadius: 6, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}bb)`,
          borderRadius: 6, transition: "width 0.5s",
        }} />
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{value} من {max}</div>
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.dark }}>{title}</h3>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>{sub}</p>}
    </div>
  );
}

function EmptyState({ icon = "📭", message }) {
  return (
    <Card style={{ textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>{message}</p>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// فلتر لوحة التحكم
// ═══════════════════════════════════════════════════════
function DashboardFilters({ filters, onChange, stages, sectors, districts, surveys }) {
  function set(k, v) { onChange({ ...filters, [k]: v }); }

  const sel = (value, onCh, children) => (
    <select value={value} onChange={e => onCh(e.target.value)} style={{
      padding: "8px 10px", border: `1.5px solid ${C.border}`, borderRadius: 9,
      fontSize: 12, fontFamily: "inherit", background: C.white,
      color: value ? C.primary : C.muted, fontWeight: value ? 700 : 400,
      minWidth: 100,
    }}>
      {children}
    </select>
  );

  const hasFilters = filters.surveyId || filters.stage || filters.sector ||
    filters.district || filters.dateFrom || filters.dateTo;

  return (
    <Card style={{ marginBottom: 16, padding: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
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
          style={{ padding: "8px 10px", border: `1.5px solid ${C.border}`, borderRadius: 9,
            fontSize: 12, fontFamily: "inherit", direction: "ltr" }}/>
        <input type="date" value={filters.dateTo || ""} onChange={e => set("dateTo", e.target.value)}
          style={{ padding: "8px 10px", border: `1.5px solid ${C.border}`, borderRadius: 9,
            fontSize: 12, fontFamily: "inherit", direction: "ltr" }}/>
        {hasFilters && (
          <button onClick={() => onChange({})} style={{
            padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.danger}`,
            background: "transparent", color: C.danger, fontSize: 12,
            cursor: "pointer", fontFamily: "inherit",
          }}>✕ مسح</button>
        )}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// hook — جلب بيانات Dashboard
// ═══════════════════════════════════════════════════════
function useDashboardData(surveys, allSchools, filters) {
  const [responseStats,  setResponseStats]  = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading,        setLoading]        = useState(true);

  // استبيانات مُفلترة
  const filteredSurveys = useMemo(() => {
    let list = surveys;
    if (filters.surveyId)  list = list.filter(s => s.id === filters.surveyId);
    if (filters.dateFrom)  list = list.filter(s => s.created_at && new Date(s.created_at) >= new Date(filters.dateFrom));
    if (filters.dateTo)    list = list.filter(s => s.created_at && new Date(s.created_at) <= new Date(filters.dateTo + "T23:59"));
    return list;
  }, [surveys, filters]);

  // مدارس مُفلترة
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

    // آخر 20 نشاط
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setRecentActivity(logs || []);

    setLoading(false);
  }, [filteredSurveys]);

  useEffect(() => { load(); }, [load]);

  // إحصاءات مشتقة
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

    // نسبة الاستجابة العامة
    const activeCount = published.length;
    const avgRate = activeCount
      ? Math.round(published.reduce((sum, s) => sum + ((responseStats[s.id] || 0) / schoolTotal * 100), 0) / activeCount)
      : 0;

    // أفضل الاستبيانات أداءً
    const topSurveys = [...filteredSurveys]
      .filter(s => responseStats[s.id] > 0)
      .sort((a, b) => (responseStats[b.id] || 0) - (responseStats[a.id] || 0))
      .slice(0, 5);

    // إحصاءات حسب المرحلة
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

  // جلب المدارس مرة واحدة
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

    // KPIs
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

    // أفضل الاستبيانات
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
    { id: "overview",  label: "🏠 نظرة عامة" },
    { id: "surveys",   label: "📋 الاستبيانات" },
    { id: "audience",  label: "👥 الجمهور" },
    { id: "activity",  label: "📜 النشاط" },
  ];

  return (
    <div style={{ padding: 16, direction: "rtl" }}>
      {/* الرأس */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: C.dark, fontWeight: 800 }}>لوحة التحكم التنفيذية</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>
            {new Date().toLocaleDateString("ar-SA", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
          </p>
        </div>
        <ExportMenu options={[{ key: "xlsx", icon: "📊", label: "تصدير Excel", action: exportDashboard }]}/>
      </div>

      {/* الفلاتر */}
      <DashboardFilters
        filters={filters} onChange={setFilters}
        stages={stages} sectors={sectors} districts={districts}
        surveys={surveys}
      />

      {/* تبويبات العرض */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} style={{
            flex: 1, padding: "9px 4px", border: "none", background: "none", cursor: "pointer",
            fontSize: 11, fontFamily: "inherit", fontWeight: activeView === v.id ? 700 : 400,
            color: activeView === v.id ? C.primary : C.muted,
            borderBottom: `2px solid ${activeView === v.id ? C.primary : "transparent"}`,
            marginBottom: -1,
          }}>{v.label}</button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Spinner size={32}/></div>
      ) : (
        <>
          {/* ── نظرة عامة ── */}
          {activeView === "overview" && (
            <>
              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 }}>
                <KPICard icon="✅" label="منشورة" value={derived.published.length}
                  color={C.success} onClick={() => onNavigate?.("surveys")}/>
                <KPICard icon="📝" label="مسودة" value={derived.draft.length}
                  color={C.muted} onClick={() => onNavigate?.("surveys")}/>
                <KPICard icon="📝" label="إجمالي الردود" value={derived.totalResponses}
                  color={C.accent}/>
                <KPICard icon="📊" label="متوسط الاستجابة" value={`${derived.avgRate}%`}
                  color="#7B2D8B"/>
                <KPICard icon="🔒" label="مغلقة" value={derived.closed.length}
                  color={C.danger}/>
                <KPICard icon="📦" label="مؤرشفة" value={derived.archived.length}
                  color={C.muted}/>
              </div>

              {/* تنبيه — ينتهي قريباً */}
              {derived.closingSoon.length > 0 && (
                <Card style={{ marginBottom: 14, background: C.warnBg, border: `1px solid ${C.warn}40` }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: C.warn }}>
                    ⏰ {derived.closingSoon.length} استبيان ينتهي خلال 3 أيام
                  </p>
                  {derived.closingSoon.map(s => {
                    const end = s.end_date || s.expires_at;
                    return (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between",
                        padding: "6px 0", borderBottom: `1px solid ${C.warn}20` }}>
                        <span style={{ fontSize: 13, color: C.dark, fontWeight: 600 }}>{s.title}</span>
                        <span style={{ fontSize: 11, color: C.warn }}>
                          {new Date(end).toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                    );
                  })}
                </Card>
              )}

              {/* أفضل الاستبيانات */}
              <SectionHeader title="🏆 أعلى الاستبيانات استجابةً" sub="حسب عدد الردود"/>
              {derived.topSurveys.length === 0
                ? <EmptyState icon="📭" message="لا توجد ردود بعد"/>
                : derived.topSurveys.map(s => {
                  const count = responseStats[s.id] || 0;
                  const pct   = filteredSchools.length ? Math.round(count / filteredSchools.length * 100) : 0;
                  return (
                    <Card key={s.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.dark, flex: 1 }}>{s.title}</p>
                        <span style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>{pct}%</span>
                      </div>
                      <div style={{ height: 8, background: C.border, borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`,
                          background: `linear-gradient(90deg, ${C.primary}, ${C.primaryLight})`,
                          borderRadius: 6, transition: "width 0.5s" }}/>
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted }}>
                        {count} رد · {SURVEY_TYPE_LABELS[s.survey_type] || "—"}
                      </p>
                    </Card>
                  );
                })
              }
            </>
          )}

          {/* ── الاستبيانات ── */}
          {activeView === "surveys" && (
            <>
              <SectionHeader title="📋 جميع الاستبيانات" sub={`${filteredSurveys.length} استبيان`}/>
              {filteredSurveys.length === 0
                ? <EmptyState icon="📋" message="لا توجد استبيانات"/>
                : filteredSurveys.map(s => {
                  const state  = resolveState(s);
                  const cfg    = LIFECYCLE_STATE_CONFIG[state] || {};
                  const count  = responseStats[s.id] || 0;
                  const total  = filteredSchools.length;
                  const pct    = total ? Math.round(count / total * 100) : 0;
                  const end    = s.end_date || s.expires_at;
                  const expiring = end && (new Date(end) - new Date()) < 3*24*60*60*1000 && new Date(end) > new Date();

                  return (
                    <Card key={s.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.dark }}>{s.title}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                            {SURVEY_TYPE_LABELS[s.survey_type] || "—"} ·
                            {s.created_at ? new Date(s.created_at).toLocaleDateString("ar-SA") : "—"}
                          </p>
                        </div>
                        <span style={{ background: `${cfg.color || C.muted}15`, color: cfg.color || C.muted,
                          border: `1px solid ${cfg.color || C.muted}40`, borderRadius: 20,
                          padding: "3px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {cfg.label || state}
                        </span>
                      </div>
                      {state === "published" && (
                        <>
                          <MiniBar value={count} max={total} color={C.primary}
                            label={`${count} من ${total} استجابت`}/>
                          {expiring && (
                            <p style={{ margin: "4px 0 0", fontSize: 11, color: C.warn, fontWeight: 700 }}>
                              ⚠️ ينتهي {new Date(end).toLocaleDateString("ar-SA")}
                            </p>
                          )}
                        </>
                      )}
                    </Card>
                  );
                })
              }
            </>
          )}

          {/* ── الجمهور ── */}
          {activeView === "audience" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 }}>
                <KPICard icon="🏫" label="إجمالي المدارس" value={filteredSchools.length} color={C.primary}/>
                <KPICard icon="🎓" label="المراحل الدراسية" value={Object.keys(derived.byStage).length} color="#7B2D8B"/>
              </div>

              {Object.keys(derived.byStage).length > 0 && (
                <>
                  <SectionHeader title="توزيع المدارس حسب المرحلة"/>
                  <Card style={{ marginBottom: 14 }}>
                    {Object.entries(derived.byStage).map(([stage, count]) => (
                      <MiniBar key={stage} label={`${stage} (${count})`}
                        value={count} max={filteredSchools.length}/>
                    ))}
                  </Card>
                </>
              )}

              {/* أكثر القطاعات استجابةً */}
              {sectors.length > 0 && (
                <>
                  <SectionHeader title="أكثر القطاعات استجابةً"/>
                  <Card style={{ marginBottom: 14 }}>
                    {sectors.map(sec => {
                      const secSchools = filteredSchools.filter(s => s.sector === sec);
                      return (
                        <MiniBar key={sec}
                          label={`${sec} (${secSchools.length})`}
                          value={secSchools.length}
                          max={filteredSchools.length}
                          color="#7B2D8B"/>
                      );
                    })}
                  </Card>
                </>
              )}

              {/* مدارس بدون جوال */}
              {(() => {
                const noPhone = filteredSchools.filter(s => !s.phone).length;
                if (!noPhone) return null;
                return (
                  <Card style={{ background: C.warnBg, border: `1px solid ${C.warn}40` }}>
                    <p style={{ margin: 0, fontSize: 13, color: C.warn, fontWeight: 700 }}>
                      ⚠️ {noPhone} مدرسة بدون رقم جوال — لا يمكن إرسال تذكيرات لها
                    </p>
                  </Card>
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
                  <Card style={{ padding: 0, overflow: "hidden" }}>
                    {recentActivity.map((log, i) => (
                      <div key={log.id} style={{ padding: "11px 14px",
                        borderBottom: i < recentActivity.length-1 ? `1px solid ${C.border}` : undefined,
                        display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8,
                          background: `${C.primary}15`, display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                          {log.action?.includes("create") ? "➕"
                            : log.action?.includes("delete") ? "🗑️"
                            : log.action?.includes("publish") ? "🚀"
                            : log.action?.includes("archive") ? "📦"
                            : log.action?.includes("export") ? "📊"
                            : "✏️"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 12, color: C.dark, fontWeight: 600 }}>
                            {log.record_label || log.action || "—"}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                            {log.user_email || "—"} ·
                            {new Date(log.created_at).toLocaleString("ar-SA")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </Card>
                )
              }
            </>
          )}
        </>
      )}
    </div>
  );
}

