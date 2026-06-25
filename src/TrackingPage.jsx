import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ErrorBanner, ExportMenu,
  ensureXLSX, ensurePDF, pdfRTLText, tsStamp, useResponses, logAction } from "./lib.jsx";

function OpenSurveyTracking({ survey, onBack }) {
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

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={32}/></div>
  );

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ background:C.primary, padding:"14px 16px", color:"#fff", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", lineHeight:1 }}>←</button>
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>متابعة الاستجابة</div>
            <div style={{ fontSize:11, opacity:0.7 }}>{survey.title} · 🌐 استبيان مفتوح</div>
          </div>
        </div>
        {responses.length > 0 && (
          <button onClick={exportExcel} style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff",
            borderRadius:8, padding:"7px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>📊 تصدير</button>
        )}
      </div>

      <div style={{ padding:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
          {[
            { l:"إجمالي الردود", v:responses.length, c:C.primary, i:"📝" },
            { l:"مكتملة", v:completed.length, c:C.success, i:"✅" },
            { l:"توقفت عند الفرز", v:stoppedAtGate.length, c:C.warn, i:"🚪" },
          ].map((x,i) => (
            <Card key={i} style={{ textAlign:"center", padding:12, borderTop:`3px solid ${x.c}` }}>
              <div style={{ fontSize:18 }}>{x.i}</div>
              <div style={{ fontSize:20, fontWeight:800, color:x.c, margin:"3px 0 2px" }}>{x.v}</div>
              <div style={{ fontSize:10, color:C.muted }}>{x.l}</div>
            </Card>
          ))}
        </div>

        {responses.length === 0 ? (
          <Card style={{ textAlign:"center", padding:30 }}>
            <p style={{ margin:0, color:C.muted, fontSize:13 }}>لا توجد ردود بعد</p>
          </Card>
        ) : (
          <Card style={{ padding:0, overflow:"hidden" }}>
            {responses.map((r, i) => (
              <div key={r.id} style={{ padding:"12px 14px", borderBottom:i<responses.length-1?`1px solid ${C.border}`:undefined }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.dark }}>{r.respondent_label || "بدون اسم"}</p>
                  {r.completed === false
                    ? <Tag color={C.warn}>🚪 توقف عند الفرز</Tag>
                    : <Tag color={C.success}>✅ مكتمل</Tag>}
                </div>
                <p style={{ margin:"3px 0 0", fontSize:11, color:C.muted }}>{new Date(r.submitted_at).toLocaleString("ar-SA")}</p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}


function TrackingPage({ survey, onBack }) {
  if (survey.survey_type === "open") return <OpenSurveyTracking survey={survey} onBack={onBack}/>;

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
      let all = [];
      let from = 0;
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
      // فلتر المراحل المستهدفة إن وُجدت
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
    return { stage:st, total, done, pct: total?Math.round(done/total*100):0 };
  });

  // ── EXPORT: Excel — full tracking sheet (all schools + status + answers) ──
  async function exportExcel() {
    const XLSX = await ensureXLSX();
    const questions = (survey.questions || []).sort((a,b)=>a.order_index-b.order_index);

    const rows = allSchools.map(s => {
      const r = responses.find(rr => rr.school_id === s.id);
      const base = {
        "الرقم الوزاري": s.id, "اسم المدرسة": s.name, "المدير/ة": s.principal || "",
        "المرحلة": s.stage, "الحالة": r ? "استجابت" : "لم تستجب",
        "تاريخ الرد": r ? new Date(r.submitted_at).toLocaleString("ar-SA") : "",
      };
      questions.forEach(q => { base[q.label] = r?.answers?.[q.id] ?? ""; });
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نتائج الاستبيان");

    const summaryRows = [
      { "البيان": "عنوان الاستبيان", "القيمة": survey.title },
      { "البيان": "إجمالي المدارس", "القيمة": allSchools.length },
      { "البيان": "عدد الردود", "القيمة": respondedIds.size },
      { "البيان": "نسبة الاستجابة", "القيمة": `${pct}%` },
      {}, { "البيان": "المرحلة", "القيمة": "نسبة الاستجابة" },
      ...stageStats.map(s => ({ "البيان": s.stage, "القيمة": `${s.done}/${s.total} (${s.pct}%)` })),
    ];
    const ws2 = XLSX.utils.json_to_sheet(summaryRows, { skipHeader: true });
    XLSX.utils.book_append_sheet(wb, ws2, "ملخص");

    XLSX.writeFile(wb, `استبيان-${survey.title.replace(/[\\/:*?"<>|]/g,"")}-${tsStamp()}.xlsx`);
  }

  // ── EXPORT: PDF — summary report with charts-as-bars ──
  async function exportPdf() {
    const jsPDF = await ensurePDF();
    const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 50;

    doc.setFontSize(16);
    pdfRTLText(doc, survey.title, W - 40, y); y += 22;
    doc.setFontSize(10);
    doc.setTextColor(110,110,110);
    pdfRTLText(doc, `تاريخ التقرير: ${new Date().toLocaleDateString("ar-SA")}`, W - 40, y); y += 26;
    doc.setTextColor(20,20,20);

    doc.setFontSize(12);
    pdfRTLText(doc, `إجمالي المدارس: ${allSchools.length}`, W - 40, y); y += 16;
    pdfRTLText(doc, `عدد الردود: ${respondedIds.size}`, W - 40, y); y += 16;
    pdfRTLText(doc, `نسبة الاستجابة الإجمالية: ${pct}%`, W - 40, y); y += 26;

    // Stage bars
    doc.setFontSize(11);
    pdfRTLText(doc, "الاستجابة حسب المرحلة", W - 40, y); y += 14;
    stageStats.forEach(s => {
      const barW = 200, fillW = barW * (s.pct/100);
      doc.setFillColor(220,228,228); doc.rect(40, y, barW, 10, "F");
      doc.setFillColor(11,110,110); doc.rect(40, y, fillW, 10, "F");
      doc.setFontSize(9); doc.setTextColor(60,60,60);
      pdfRTLText(doc, `${s.stage}  ${s.done}/${s.total} (${s.pct}%)`, W - 40, y + 9);
      y += 22;
    });
    y += 10;

    // Table of all schools and status
    const tableRows = allSchools.map(s => {
      const r = responses.find(rr => rr.school_id === s.id);
      return [s.id, s.name, s.principal || "-", s.stage, r ? "✅ استجابت" : "⏳ لم تستجب"];
    });
    doc.autoTable({
      startY: y,
      head: [["الرقم", "المدرسة", "المدير", "المرحلة", "الحالة"]],
      body: tableRows,
      styles: { font: "helvetica", fontSize: 8, halign: "right" },
      headStyles: { fillColor: [11,110,110], halign: "right" },
      margin: { left: 30, right: 30 },
    });

    doc.save(`تقرير-${survey.title.replace(/[\\/:*?"<>|]/g,"")}-${tsStamp()}.pdf`);
  }

  if (loadingSchools || loadingResp) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Spinner size={32}/>
    </div>
  );

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ background:C.primary, padding:"14px 16px", color:"#fff", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", lineHeight:1 }}>←</button>
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>متابعة الاستجابة</div>
            <div style={{ fontSize:11, opacity:0.7 }}>{survey.title}</div>
          </div>
        </div>
        <ExportMenu options={[
          { key:"xlsx", icon:"📊", label:"تصدير Excel", action: exportExcel },
          { key:"pdf", icon:"📄", label:"تصدير تقرير PDF", action: exportPdf },
        ]}/>
      </div>

      <div style={{ padding:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
          {[
            { l:"استجابت", v:respondedIds.size, c:C.success, i:"✅" },
            { l:"لم تستجب", v:allSchools.length-respondedIds.size, c:C.danger, i:"⏳" },
            { l:"نسبة الاستجابة", v:`${pct}%`, c:C.primary, i:"📊" },
          ].map((x,i) => (
            <Card key={i} style={{ textAlign:"center", padding:12, borderTop:`3px solid ${x.c}` }}>
              <div style={{ fontSize:18 }}>{x.i}</div>
              <div style={{ fontSize:20, fontWeight:800, color:x.c, margin:"3px 0 2px" }}>{x.v}</div>
              <div style={{ fontSize:10, color:C.muted }}>{x.l}</div>
            </Card>
          ))}
        </div>

        <Card style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>التقدم الإجمالي</span>
            <span style={{ fontSize:14, fontWeight:800, color:C.primary }}>{pct}%</span>
          </div>
          <div style={{ height:14, background:C.border, borderRadius:8, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${C.primary},${C.primaryLight})`, borderRadius:8 }}/>
          </div>
        </Card>

        <Card style={{ marginBottom:14 }}>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.dark }}>الاستجابة حسب المرحلة</p>
          {stageStats.map(x => (
            <div key={x.stage} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600, color:C.dark }}>{x.stage}</span>
                <span style={{ fontSize:12, color:C.muted }}>{x.done}/{x.total} — <strong style={{color:C.primary}}>{x.pct}%</strong></span>
              </div>
              <div style={{ height:8, background:C.border, borderRadius:6, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${x.pct}%`, background:C.primary, borderRadius:6 }}/>
              </div>
            </div>
          ))}
        </Card>

        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
          placeholder="🔍 ابحث باسم المدرسة أو المدير أو الرقم الوزاري..."
          style={{ width:"100%", padding:"11px 14px", border:`1.5px solid ${C.border}`, borderRadius:10,
            fontSize:14, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none", marginBottom:10 }}/>

        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {[["all",`الكل (${allSchools.length})`],["responded",`استجابت ✅`],["pending",`لم تستجب ⏳`]].map(([v,l]) => (
            <button key={v} onClick={()=>{setFilter(v);setPage(1);}} style={{
              padding:"7px 12px", borderRadius:20, border:`2px solid ${filter===v?C.primary:C.border}`,
              background:filter===v?C.primaryBg:"#fff", color:filter===v?C.primary:C.muted,
              cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:filter===v?700:400 }}>
              {l}
            </button>
          ))}
          {["الابتدائية","المتوسطة","الثانوية"].map(s => (
            <button key={s} onClick={()=>{setStageFilter(stageFilter===s?"الكل":s);setPage(1);}} style={{
              padding:"7px 12px", borderRadius:20, border:`2px solid ${stageFilter===s?C.accent:C.border}`,
              background:stageFilter===s?C.accentLight:"#fff", color:stageFilter===s?C.accent:C.muted,
              cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:700 }}>
              {s}
            </button>
          ))}
        </div>

        <p style={{ fontSize:12, color:C.muted, margin:"0 0 8px" }}>عرض {paginated.length} من {filtered.length} مدرسة</p>

        <Card style={{ padding:0, overflow:"hidden" }}>
          {paginated.map((s,i) => {
            const r = responses.find(r=>r.school_id===s.id);
            return (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px",
                borderBottom:i<paginated.length-1?`1px solid ${C.border}`:undefined,
                background:r?C.successBg+"44":"#fff" }}>
                <div style={{ width:10, height:10, borderRadius:"50%", flexShrink:0, background:r?C.success:C.border }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.dark, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.name}</p>
                  <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {s.principal} · {s.stage} · {s.id}
                  </p>
                </div>
                <div style={{ flexShrink:0 }}>
                  {r ? (
                    <div style={{ textAlign:"center" }}>
                      <Tag color={C.success}>✅</Tag>
                      <p style={{ margin:"2px 0 0", fontSize:9, color:C.muted }}>{new Date(r.submitted_at).toLocaleDateString("ar-SA")}</p>
                    </div>
                  ) : <Tag color={C.muted}>⏳</Tag>}
                </div>
              </div>
            );
          })}
        </Card>

        {totalPages > 1 && (
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:14 }}>
            <Btn sm variant="secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>السابق</Btn>
            <span style={{ padding:"8px 14px", fontSize:13, color:C.muted }}>{page} / {totalPages}</span>
            <Btn sm variant="secondary" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>التالي</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SURVEYS LIST
// ═══════════════════════════════════════════════════════
export { OpenSurveyTracking };
export default TrackingPage;

