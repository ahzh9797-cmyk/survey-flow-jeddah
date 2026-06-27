import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, C, Btn, Card, Spinner } from "./lib.jsx";

// ═══════════════════════════════════════════════════════
// TARGETING STATE SHAPE
// ═══════════════════════════════════════════════════════
/*
  targeting = {
    rules: [
      { method: 'all' },
      { method: 'stage',    value: 'الابتدائية' },
      { method: 'sector',   value: 'القطاع الشمالي' },
      { method: 'district', value: 'الروضة' },
    ],
    selectedSchools:  ['32100', '32101', ...],   // school ids
    excludedSchools:  ['32200', ...],             // school ids
  }
  
  Empty targeting = target all (backward compat)
*/
export function emptyTargeting() {
  return { rules:[], selectedSchools:[], excludedSchools:[] };
}

export function allSchoolsTargeting() {
  return { rules:[{ method:'all' }], selectedSchools:[], excludedSchools:[] };
}

// ═══════════════════════════════════════════════════════
// TARGETING RESOLVER
// Single function used by TrackingPage, surveys, and future reports
// Supports both old (target_stages) and new (survey_targeting) formats
// ═══════════════════════════════════════════════════════

/*
  resolveTargetedSchools(survey, allSchools) → school[]
  
  Handles:
  - Old surveys: uses survey.target_stages (backward compat)
  - New surveys: uses survey.targeting (pre-loaded) or fetches from DB
*/
export function resolveTargetedSchools(survey, allSchools) {
  // ── Legacy path: target_stages only (old surveys) ──
  if (!survey.targeting && !survey._targeting_loaded) {
    if (survey.target_stages?.length) {
      return allSchools.filter(s => survey.target_stages.includes(s.stage));
    }
    return allSchools; // no targeting = all schools
  }

  const t = survey.targeting || emptyTargeting();
  const { rules, selectedSchools, excludedSchools } = t;

  // If no rules and no selected schools → all
  if (!rules?.length && !selectedSchools?.length) return applyExclusions(allSchools, excludedSchools);

  let result = new Set();

  // Process each rule — union of all matching schools
  for (const rule of rules) {
    switch (rule.method) {
      case 'all':
        allSchools.forEach(s => result.add(s.id));
        break;
      case 'stage':
        allSchools.filter(s => s.stage === rule.value).forEach(s => result.add(s.id));
        break;
      case 'sector':
        allSchools.filter(s => s.sector === rule.value).forEach(s => result.add(s.id));
        break;
      case 'district':
        allSchools.filter(s => s.district === rule.value).forEach(s => result.add(s.id));
        break;
    }
  }

  // Add individually selected schools (union)
  if (selectedSchools?.length) {
    selectedSchools.forEach(id => result.add(id));
  }

  // Build result array
  const schoolMap = new Map(allSchools.map(s=>[s.id,s]));
  let resolved = [...result].map(id => schoolMap.get(id)).filter(Boolean);

  return applyExclusions(resolved, excludedSchools);
}

function applyExclusions(schools, excludedSchools) {
  if (!excludedSchools?.length) return schools;
  const excSet = new Set(excludedSchools);
  return schools.filter(s => !excSet.has(s.id));
}

// ═══════════════════════════════════════════════════════
// DB OPERATIONS — save / load targeting
// ═══════════════════════════════════════════════════════

export async function saveTargeting(surveyId, targeting) {
  if (!surveyId || !targeting) return;

  // Delete existing targeting for this survey (replace all)
  await supabase.from("survey_targeting").delete().eq("survey_id", surveyId);
  await supabase.from("survey_target_schools").delete().eq("survey_id", surveyId);
  await supabase.from("survey_excluded_schools").delete().eq("survey_id", surveyId);

  // Insert new rules
  if (targeting.rules?.length) {
    const rows = targeting.rules.map(r => ({
      survey_id: surveyId, method: r.method, value: r.value || null
    }));
    await supabase.from("survey_targeting").insert(rows);
  }

  // Insert selected schools
  if (targeting.selectedSchools?.length) {
    const rows = targeting.selectedSchools.map(id => ({ survey_id: surveyId, school_id: id }));
    // batch insert
    for (let i=0; i<rows.length; i+=200) {
      await supabase.from("survey_target_schools").insert(rows.slice(i, i+200));
    }
  }

  // Insert excluded schools
  if (targeting.excludedSchools?.length) {
    const rows = targeting.excludedSchools.map(id => ({ survey_id: surveyId, school_id: id }));
    for (let i=0; i<rows.length; i+=200) {
      await supabase.from("survey_excluded_schools").insert(rows.slice(i, i+200));
    }
  }
}

export async function loadTargeting(surveyId) {
  if (!surveyId) return null;

  const [rulesRes, selectedRes, excludedRes] = await Promise.all([
    supabase.from("survey_targeting").select("method,value").eq("survey_id", surveyId),
    supabase.from("survey_target_schools").select("school_id").eq("survey_id", surveyId),
    supabase.from("survey_excluded_schools").select("school_id").eq("survey_id", surveyId),
  ]);

  return {
    rules: (rulesRes.data || []).map(r => ({ method:r.method, value:r.value })),
    selectedSchools: (selectedRes.data || []).map(r => r.school_id),
    excludedSchools: (excludedRes.data || []).map(r => r.school_id),
  };
}

// ═══════════════════════════════════════════════════════
// AUDIENCE SUMMARY
// ═══════════════════════════════════════════════════════
export function computeAudienceSummary(targeting, allSchools) {
  const targeted = resolveTargetedSchools(
    { targeting, _targeting_loaded:true },
    allSchools
  );

  const byStage = {};
  const bySector = {};
  const byDistrict = {};

  targeted.forEach(s => {
    if (s.stage)    byStage[s.stage]       = (byStage[s.stage]||0)+1;
    if (s.sector)   bySector[s.sector]     = (bySector[s.sector]||0)+1;
    if (s.district) byDistrict[s.district] = (byDistrict[s.district]||0)+1;
  });

  return { total:targeted.length, byStage, bySector, byDistrict, targeted };
}

// ═══════════════════════════════════════════════════════
// AUDIENCE SELECTOR COMPONENT
// Reusable — designed for schools now, extensible for supervisors/admins
// ═══════════════════════════════════════════════════════
export function AudienceSelector({ entityType="school", value, onChange }) {
  const [allSchools, setAllSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  const [showExcludePicker, setShowExcludePicker] = useState(false);
  const [excludeSearch, setExcludeSearch] = useState("");

  // Load all schools once
  useEffect(() => {
    async function load() {
      let all = [], from = 0;
      while (true) {
        const { data } = await supabase
          .from("survey_schools")
          .select("id,name,stage,sector,district")
          .range(from, from+999);
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      setAllSchools(all);
      setLoading(false);
    }
    if (entityType === "school") load();
  }, [entityType]);

  // Derived unique values for filters
  const stages    = useMemo(() => [...new Set(allSchools.map(s=>s.stage).filter(Boolean))].sort(), [allSchools]);
  const sectors   = useMemo(() => [...new Set(allSchools.map(s=>s.sector).filter(Boolean))].sort(), [allSchools]);
  const districts = useMemo(() => [...new Set(allSchools.map(s=>s.district).filter(Boolean))].sort(), [allSchools]);

  const targeting = value || emptyTargeting();

  function hasRule(method, val) {
    return targeting.rules.some(r => r.method===method && r.value===val);
  }
  function hasAllRule() {
    return targeting.rules.some(r => r.method==='all');
  }

  function toggleRule(method, val) {
    const exists = targeting.rules.some(r => r.method===method && (val===undefined ? true : r.value===val));
    let newRules;
    if (method === 'all') {
      // All clears everything else
      newRules = exists ? [] : [{ method:'all' }];
      onChange({ ...targeting, rules:newRules, selectedSchools:[], excludedSchools:[] });
      return;
    }
    if (exists) {
      newRules = targeting.rules.filter(r => !(r.method===method && r.value===val));
    } else {
      // Adding a specific rule removes 'all'
      newRules = targeting.rules.filter(r=>r.method!=='all').concat([{ method, value:val }]);
    }
    onChange({ ...targeting, rules:newRules });
  }

  function toggleSelectedSchool(schoolId) {
    const cur = targeting.selectedSchools || [];
    const next = cur.includes(schoolId) ? cur.filter(id=>id!==schoolId) : [...cur, schoolId];
    onChange({ ...targeting, selectedSchools:next });
  }

  function toggleExcludedSchool(schoolId) {
    const cur = targeting.excludedSchools || [];
    const next = cur.includes(schoolId) ? cur.filter(id=>id!==schoolId) : [...cur, schoolId];
    onChange({ ...targeting, excludedSchools:next });
  }

  // Live audience summary
  const summary = useMemo(() =>
    computeAudienceSummary(targeting, allSchools),
    [targeting, allSchools]
  );

  // School search for picker
  const filteredForPicker = useMemo(() => {
    if (!schoolSearch.trim()) return allSchools.slice(0,50);
    const q = schoolSearch.toLowerCase();
    return allSchools.filter(s =>
      s.name.toLowerCase().includes(q) || s.id.includes(q)
    ).slice(0,100);
  }, [allSchools, schoolSearch]);

  const filteredForExclude = useMemo(() => {
    if (!excludeSearch.trim()) return summary.targeted.slice(0,50);
    const q = excludeSearch.toLowerCase();
    return summary.targeted.filter(s =>
      s.name.toLowerCase().includes(q) || s.id.includes(q)
    ).slice(0,100);
  }, [summary.targeted, excludeSearch]);

  const schoolMap = useMemo(() => new Map(allSchools.map(s=>[s.id,s])), [allSchools]);

  if (loading) return <div style={{textAlign:"center", padding:20}}><Spinner/></div>;

  const chipStyle = (active, color=C.primary) => ({
    padding:"7px 14px", borderRadius:20, cursor:"pointer",
    fontFamily:"inherit", fontSize:12, fontWeight:active?700:400,
    border:`1.5px solid ${active?color:C.border}`,
    background:active?`${color}15`:"#fff",
    color:active?color:C.muted, transition:"all 0.12s",
    display:"inline-flex", alignItems:"center", gap:4
  });

  return (
    <div style={{ direction:"rtl" }}>

      {/* ── Section: All Schools ── */}
      <div style={{ marginBottom:16 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>
          📋 نطاق الاستهداف
        </label>
        <button onClick={()=>toggleRule('all')} style={chipStyle(hasAllRule())}>
          {hasAllRule()?"✓ ":""} جميع المدارس ({allSchools.length})
        </button>
      </div>

      {/* ── Section: By Stage ── */}
      {stages.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>
            🎓 حسب المرحلة الدراسية
          </label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {stages.map(s => (
              <button key={s} onClick={()=>toggleRule('stage',s)}
                style={chipStyle(hasRule('stage',s), C.primary)}>
                {hasRule('stage',s)?"✓ ":""}{s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Section: By Sector ── */}
      {sectors.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>
            🗺️ حسب القطاع
          </label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {sectors.map(s => (
              <button key={s} onClick={()=>toggleRule('sector',s)}
                style={chipStyle(hasRule('sector',s), "#7B2D8B")}>
                {hasRule('sector',s)?"✓ ":""}{s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Section: By District ── */}
      {districts.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>
            📍 حسب الحي
          </label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {districts.slice(0,30).map(d => (
              <button key={d} onClick={()=>toggleRule('district',d)}
                style={chipStyle(hasRule('district',d), "#B7791F")}>
                {hasRule('district',d)?"✓ ":""}{d}
              </button>
            ))}
            {districts.length > 30 && (
              <span style={{ fontSize:11, color:C.muted, alignSelf:"center" }}>
                +{districts.length-30} حي آخر
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Section: Selected Schools ── */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <label style={{ fontSize:12, fontWeight:700, color:C.text }}>
            🏫 مدارس محددة بالاسم
            {targeting.selectedSchools?.length > 0 &&
              <span style={{ marginRight:6, color:C.primary }}>({targeting.selectedSchools.length} محددة)</span>
            }
          </label>
          <button onClick={()=>{ setSchoolSearch(""); setShowSchoolPicker(p=>!p); }}
            style={{ background:C.primaryBg, border:`1px solid ${C.primary}`, borderRadius:8,
              padding:"5px 12px", fontSize:11, color:C.primary, cursor:"pointer",
              fontFamily:"inherit", fontWeight:700 }}>
            {showSchoolPicker ? "✕ إغلاق" : "➕ اختيار مدارس"}
          </button>
        </div>

        {/* Selected schools chips */}
        {targeting.selectedSchools?.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
            {targeting.selectedSchools.slice(0,10).map(id => {
              const s = schoolMap.get(id);
              return (
                <span key={id} style={{ background:C.primaryBg, border:`1px solid ${C.border}`,
                  borderRadius:20, padding:"4px 10px", fontSize:11, color:C.primary,
                  display:"inline-flex", alignItems:"center", gap:5 }}>
                  {s?.name||id}
                  <button onClick={()=>toggleSelectedSchool(id)}
                    style={{ background:"none", border:"none", color:C.danger, cursor:"pointer",
                      padding:0, fontSize:13, lineHeight:1 }}>✕</button>
                </span>
              );
            })}
            {targeting.selectedSchools.length > 10 && (
              <span style={{ fontSize:11, color:C.muted, alignSelf:"center" }}>
                +{targeting.selectedSchools.length-10} أخرى
              </span>
            )}
          </div>
        )}

        {/* School picker dropdown */}
        {showSchoolPicker && (
          <div style={{ border:`1.5px solid ${C.primary}`, borderRadius:12, overflow:"hidden",
            boxShadow:"0 4px 16px rgba(0,107,84,0.12)" }}>
            <div style={{ padding:10, background:C.primaryBg, borderBottom:`1px solid ${C.border}` }}>
              <input value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)}
                placeholder="🔍 ابحث باسم المدرسة أو الرقم الوزاري..."
                style={{ width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`,
                  borderRadius:8, fontSize:13, fontFamily:"inherit", direction:"rtl",
                  boxSizing:"border-box", outline:"none" }}/>
            </div>
            <div style={{ maxHeight:240, overflowY:"auto" }}>
              {filteredForPicker.length === 0 ? (
                <p style={{ padding:16, textAlign:"center", color:C.muted, fontSize:13, margin:0 }}>
                  لا توجد نتائج
                </p>
              ) : filteredForPicker.map(s => {
                const sel = targeting.selectedSchools?.includes(s.id);
                return (
                  <div key={s.id} onClick={()=>toggleSelectedSchool(s.id)}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                      cursor:"pointer", background:sel?C.primaryBg:"#fff",
                      borderBottom:`1px solid ${C.border}`,
                      transition:"background 0.1s" }}>
                    <div style={{ width:18, height:18, borderRadius:4, flexShrink:0,
                      border:`2px solid ${sel?C.primary:C.border}`,
                      background:sel?C.primary:"#fff",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {sel && <span style={{ color:"#fff", fontSize:11, lineHeight:1 }}>✓</span>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ margin:0, fontSize:13, fontWeight:sel?700:400, color:C.dark }}>{s.name}</p>
                      <p style={{ margin:0, fontSize:10, color:C.muted }}>
                        {s.id} · {s.stage||"—"}{s.sector?` · ${s.sector}`:""}
                      </p>
                    </div>
                  </div>
                );
              })}
              {!schoolSearch && allSchools.length > 50 && (
                <p style={{ padding:"8px 14px", fontSize:11, color:C.muted, margin:0, textAlign:"center" }}>
                  ابحث للوصول لبقية المدارس ({allSchools.length} إجمالاً)
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Audience Summary ── */}
      {(targeting.rules?.length > 0 || targeting.selectedSchools?.length > 0) && (
        <div style={{ background:C.primaryBg, border:`1.5px solid ${C.primary}30`,
          borderRadius:14, padding:16, marginBottom:16 }}>
          <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:800, color:C.primary }}>
            📊 ملخص الجمهور المستهدف
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            <div style={{ background:C.white, borderRadius:10, padding:"10px 12px",
              borderTop:`3px solid ${C.primary}`, textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, color:C.primary }}>{summary.total}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>إجمالي المدارس المستهدفة</div>
            </div>
            <div style={{ background:C.white, borderRadius:10, padding:"10px 12px",
              borderTop:`3px solid ${C.accent}`, textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, color:C.accent }}>
                {targeting.selectedSchools?.length||0}
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>مدارس محددة يدوياً</div>
            </div>
          </div>

          {Object.keys(summary.byStage).length > 0 && (
            <div style={{ marginBottom:10 }}>
              <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:C.muted }}>حسب المرحلة:</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {Object.entries(summary.byStage).map(([stage,count]) => (
                  <span key={stage} style={{ background:C.white, border:`1px solid ${C.border}`,
                    borderRadius:20, padding:"3px 10px", fontSize:11, color:C.dark }}>
                    {stage}: <strong style={{color:C.primary}}>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {Object.keys(summary.bySector).length > 0 && (
            <div style={{ marginBottom:10 }}>
              <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:C.muted }}>حسب القطاع:</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {Object.entries(summary.bySector).map(([sec,count]) => (
                  <span key={sec} style={{ background:C.white, border:`1px solid ${C.border}`,
                    borderRadius:20, padding:"3px 10px", fontSize:11, color:C.dark }}>
                    {sec}: <strong style={{color:"#7B2D8B"}}>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {Object.keys(summary.byDistrict).length > 0 && (
            <div>
              <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:C.muted }}>حسب الحي:</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {Object.entries(summary.byDistrict).slice(0,10).map(([dist,count]) => (
                  <span key={dist} style={{ background:C.white, border:`1px solid ${C.border}`,
                    borderRadius:20, padding:"3px 10px", fontSize:11, color:C.dark }}>
                    {dist}: <strong style={{color:"#B7791F"}}>{count}</strong>
                  </span>
                ))}
                {Object.keys(summary.byDistrict).length > 10 && (
                  <span style={{ fontSize:11, color:C.muted, alignSelf:"center" }}>
                    +{Object.keys(summary.byDistrict).length-10} حي آخر
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Exclusions ── */}
      {summary.total > 0 && (
        <div style={{ marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <label style={{ fontSize:12, fontWeight:700, color:C.text }}>
              ⛔ استثناء مدارس محددة
              {targeting.excludedSchools?.length > 0 &&
                <span style={{ marginRight:6, color:C.danger }}>({targeting.excludedSchools.length} مستثناة)</span>
              }
            </label>
            <button onClick={()=>{ setExcludeSearch(""); setShowExcludePicker(p=>!p); }}
              style={{ background:"#FFF5F5", border:`1px solid ${C.danger}40`, borderRadius:8,
                padding:"5px 12px", fontSize:11, color:C.danger, cursor:"pointer",
                fontFamily:"inherit", fontWeight:700 }}>
              {showExcludePicker ? "✕ إغلاق" : "➕ استثناء"}
            </button>
          </div>

          {targeting.excludedSchools?.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
              {targeting.excludedSchools.map(id => {
                const s = schoolMap.get(id);
                return (
                  <span key={id} style={{ background:"#FFF5F5", border:`1px solid #FEB2B2`,
                    borderRadius:20, padding:"4px 10px", fontSize:11, color:C.danger,
                    display:"inline-flex", alignItems:"center", gap:5 }}>
                    {s?.name||id}
                    <button onClick={()=>toggleExcludedSchool(id)}
                      style={{ background:"none", border:"none", color:C.muted, cursor:"pointer",
                        padding:0, fontSize:13, lineHeight:1 }}>✕</button>
                  </span>
                );
              })}
            </div>
          )}

          {showExcludePicker && (
            <div style={{ border:`1.5px solid ${C.danger}40`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ padding:10, background:"#FFF5F5", borderBottom:`1px solid ${C.border}` }}>
                <input value={excludeSearch} onChange={e=>setExcludeSearch(e.target.value)}
                  placeholder="🔍 ابحث في المدارس المستهدفة..."
                  style={{ width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`,
                    borderRadius:8, fontSize:13, fontFamily:"inherit", direction:"rtl",
                    boxSizing:"border-box", outline:"none" }}/>
                <p style={{ margin:"6px 0 0", fontSize:11, color:C.muted }}>
                  تظهر فقط المدارس ضمن الجمهور المستهدف أعلاه
                </p>
              </div>
              <div style={{ maxHeight:200, overflowY:"auto" }}>
                {filteredForExclude.length === 0 ? (
                  <p style={{ padding:16, textAlign:"center", color:C.muted, fontSize:13, margin:0 }}>
                    لا توجد نتائج
                  </p>
                ) : filteredForExclude.map(s => {
                  const excl = targeting.excludedSchools?.includes(s.id);
                  return (
                    <div key={s.id} onClick={()=>toggleExcludedSchool(s.id)}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
                        cursor:"pointer", background:excl?"#FFF5F5":"#fff",
                        borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ width:18, height:18, borderRadius:4, flexShrink:0,
                        border:`2px solid ${excl?C.danger:C.border}`,
                        background:excl?C.danger:"#fff",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {excl && <span style={{ color:"#fff", fontSize:11, lineHeight:1 }}>✕</span>}
                      </div>
                      <div>
                        <p style={{ margin:0, fontSize:13, color:C.dark }}>{s.name}</p>
                        <p style={{ margin:0, fontSize:10, color:C.muted }}>{s.id} · {s.stage||"—"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

