/**
 * ReportingService — خدمة التقارير الاحترافية
 *
 * تُنتج: PDF، Excel، CSV
 * تستخدم branding من إعدادات النظام
 */

import { supabase, ensureXLSX, ensurePDF, pdfRTLText, tsStamp } from "./lib.jsx";
import { resolveTargetedSchools } from "./TargetingService.jsx";
import { audit } from "./AuditService.js";

// ═══════════════════════════════════════════════════════
// جلب بيانات التقرير
// ═══════════════════════════════════════════════════════

/**
 * بيانات التقرير التنفيذي الشامل
 */
export async function fetchExecutiveData(surveys) {
  const stats = {};
  for (const s of surveys) {
    const { count } = await supabase
      .from("survey_responses")
      .select("*", { count:"exact", head:true })
      .eq("survey_id", s.id);
    stats[s.id] = count || 0;
  }
  return stats;
}

/**
 * بيانات تقرير استبيان محدد
 */
export async function fetchSurveyReportData(surveyId) {
  const [surveyRes, responsesRes, questionsRes] = await Promise.all([
    supabase.from("surveys").select("*").eq("id", surveyId).single(),
    supabase.from("survey_responses")
      .select("*, survey_schools(name,stage,sector,district,principal)")
      .eq("survey_id", surveyId)
      .order("submitted_at", { ascending: false }),
    supabase.from("survey_questions")
      .select("*")
      .eq("survey_id", surveyId)
      .order("order_index"),
  ]);

  return {
    survey:    surveyRes.data,
    responses: responsesRes.data || [],
    questions: questionsRes.data || [],
  };
}

/**
 * إحصاءات الأسئلة
 */
export function computeQuestionStats(questions, responses) {
  return questions.map(q => {
    const answers = responses
      .map(r => r.answers?.[q.id])
      .filter(a => a !== undefined && a !== null && a !== "");

    if (q.type === "select") {
      const counts = {};
      answers.forEach(a => { counts[a] = (counts[a]||0)+1; });
      return { ...q, responseCount:answers.length, distribution:counts };
    }
    if (q.type === "rating") {
      const nums = answers.map(Number).filter(n => !isNaN(n));
      const avg = nums.length ? (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(1) : "—";
      const dist = {1:0,2:0,3:0,4:0,5:0};
      nums.forEach(n => { if(dist[n]!==undefined) dist[n]++; });
      return { ...q, responseCount:answers.length, average:avg, distribution:dist };
    }
    if (q.type === "number") {
      const nums = answers.map(Number).filter(n => !isNaN(n));
      const avg = nums.length ? (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(1) : "—";
      return { ...q, responseCount:answers.length, average:avg };
    }
    return { ...q, responseCount:answers.length };
  });
}

/**
 * إحصاءات الجمهور
 */
export function computeAudienceStats(responses, allSchools) {
  const respondedIds = new Set(responses.map(r => r.school_id).filter(Boolean));
  const byStage = {}, bySector = {}, byDistrict = {};

  allSchools.forEach(s => {
    const responded = respondedIds.has(s.id);
    if (s.stage) {
      if (!byStage[s.stage]) byStage[s.stage] = { total:0, responded:0 };
      byStage[s.stage].total++;
      if (responded) byStage[s.stage].responded++;
    }
    if (s.sector) {
      if (!bySector[s.sector]) bySector[s.sector] = { total:0, responded:0 };
      bySector[s.sector].total++;
      if (responded) bySector[s.sector].responded++;
    }
    if (s.district) {
      if (!byDistrict[s.district]) byDistrict[s.district] = { total:0, responded:0 };
      byDistrict[s.district].total++;
      if (responded) byDistrict[s.district].responded++;
    }
  });

  return { byStage, bySector, byDistrict };
}

// ═══════════════════════════════════════════════════════
// تصدير Excel
// ═══════════════════════════════════════════════════════
export async function exportSurveyExcel({ survey, responses, questions, allSchools, user, settings }) {
  const XLSX = await ensureXLSX();
  const wb   = XLSX.utils.book_new();

  // ورقة 1 — ملخص
  const respondedIds = new Set(responses.map(r=>r.school_id).filter(Boolean));
  const totalTargeted = allSchools.length;
  const summaryData = [
    ["الاستبيان",          survey.title],
    ["الوصف",              survey.description || "—"],
    ["نوع المستهدف",       survey.survey_type],
    ["إجمالي المستهدفين",  totalTargeted],
    ["عدد الردود",         responses.length],
    ["نسبة الاستجابة",     totalTargeted ? `${Math.round(responses.length/totalTargeted*100)}%` : "—"],
    ["تاريخ التقرير",      new Date().toLocaleDateString("ar-SA")],
    ["أعدّه",              user?.email || "—"],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{wch:24},{wch:40}];
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص");

  // ورقة 2 — الردود التفصيلية
  if (responses.length && questions.length) {
    const headers = ["المدرسة","المرحلة","القطاع","المدير","تاريخ الإجابة",
      ...questions.map(q=>q.label)];
    const rows = responses.map(r => [
      r.survey_schools?.name || r.respondent_label || "—",
      r.survey_schools?.stage || "—",
      r.survey_schools?.sector || "—",
      r.survey_schools?.principal || "—",
      r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("ar-SA") : "—",
      ...questions.map(q => {
        const ans = r.answers?.[q.id];
        if (ans === undefined || ans === null) return "—";
        if (typeof ans === "object") return ans.url || JSON.stringify(ans);
        return String(ans);
      }),
    ]);
    const wsResponses = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    wsResponses["!cols"] = headers.map(()=>({wch:20}));
    XLSX.utils.book_append_sheet(wb, wsResponses, "الردود التفصيلية");
  }

  // ورقة 3 — المدارس غير المستجيبة
  const pending = allSchools.filter(s=>!respondedIds.has(s.id));
  if (pending.length) {
    const wsPending = XLSX.utils.json_to_sheet(pending.map(s=>({
      "الرقم الوزاري":s.id, "اسم المدرسة":s.name, "المرحلة":s.stage||"—",
      "القطاع":s.sector||"—", "الحي":s.district||"—", "المدير":s.principal||"—",
      "الجوال":s.phone||"—",
    })));
    wsPending["!cols"] = [{wch:14},{wch:30},{wch:14},{wch:16},{wch:16},{wch:20},{wch:14}];
    XLSX.utils.book_append_sheet(wb, wsPending, "لم تستجب");
  }

  // ورقة 4 — إحصاءات حسب المرحلة
  const audStats = computeAudienceStats(responses, allSchools);
  if (Object.keys(audStats.byStage).length) {
    const stageRows = Object.entries(audStats.byStage).map(([stage,d])=>({
      "المرحلة":stage, "إجمالي المدارس":d.total, "استجابت":d.responded,
      "نسبة الاستجابة":`${Math.round(d.responded/d.total*100)}%`
    }));
    const wsStage = XLSX.utils.json_to_sheet(stageRows);
    wsStage["!cols"] = [{wch:16},{wch:18},{wch:12},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsStage, "حسب المرحلة");
  }

  const filename = `تقرير-${survey.title}-${tsStamp()}.xlsx`;
  XLSX.writeFile(wb, filename);
  await audit.exportExcel(user, `تقرير: ${survey.title}`);
  return filename;
}

// ═══════════════════════════════════════════════════════
// تصدير CSV
// ═══════════════════════════════════════════════════════
export async function exportSurveyCSV({ survey, responses, questions, user }) {
  const headers = ["المدرسة","المرحلة","تاريخ الإجابة",...questions.map(q=>q.label)];
  const rows = responses.map(r => [
    r.survey_schools?.name || r.respondent_label || "",
    r.survey_schools?.stage || "",
    r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("ar-SA") : "",
    ...questions.map(q => {
      const ans = r.answers?.[q.id];
      if (!ans) return "";
      if (typeof ans === "object") return ans.url || "";
      return String(ans).replace(/,/g,"،");
    }),
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `تقرير-${survey.title}-${tsStamp()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  await audit.exportCsv(user, `تقرير: ${survey.title}`);
}

// ═══════════════════════════════════════════════════════
// تصدير PDF
// ═══════════════════════════════════════════════════════
export async function exportSurveyPDF({ survey, responses, questions, allSchools, user, settings }) {
  const jsPDF = await ensurePDF();
  const doc = new jsPDF({ orientation:"p", unit:"pt", format:"a4" });
  const W = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 50;

  const orgName   = settings?.app_name    || "منظومة الاستبيانات";
  const orgSub    = settings?.app_subtitle || "إدارة التعليم — جدة";
  const repHeader = settings?.report_header || orgName;
  const repFooter = settings?.report_footer || orgSub;

  // ── Header ──
  doc.setFillColor(0, 107, 84);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(18); pdfRTLText(doc, repHeader, W-30, 28);
  doc.setFontSize(11); pdfRTLText(doc, orgSub, W-30, 46);
  doc.setFontSize(10); doc.text(`${new Date().toLocaleDateString("ar-SA")}`, 30, 46);
  y = 90;

  // ── Survey Title ──
  doc.setTextColor(26,32,44);
  doc.setFontSize(16); pdfRTLText(doc, survey.title, W-30, y); y+=20;
  if (survey.description) {
    doc.setFontSize(10); doc.setTextColor(113,128,150);
    pdfRTLText(doc, survey.description, W-30, y); y+=16;
  }
  doc.setTextColor(26,32,44);

  // ── Summary Stats ──
  y += 10;
  const respondedCount = responses.length;
  const totalCount     = allSchools.length;
  const pct            = totalCount ? Math.round(respondedCount/totalCount*100) : 0;

  doc.setFontSize(11);
  const stats = [
    ["إجمالي المستهدفين", String(totalCount)],
    ["عدد الردود",        String(respondedCount)],
    ["نسبة الاستجابة",    `${pct}%`],
    ["تاريخ التقرير",     new Date().toLocaleDateString("ar-SA")],
    ["أعدّه",             user?.email || "—"],
  ];

  doc.autoTable({
    startY: y,
    head: [["البيان","القيمة"]],
    body: stats,
    styles: { font:"helvetica", fontSize:10, halign:"right" },
    headStyles: { fillColor:[0,107,84], halign:"right" },
    margin: { left:30, right:30 },
    theme: "grid",
  });
  y = doc.lastAutoTable.finalY + 20;

  // ── Audience Breakdown ──
  const audStats = computeAudienceStats(responses, allSchools);
  if (Object.keys(audStats.byStage).length) {
    doc.setFontSize(13); doc.setTextColor(0,107,84);
    pdfRTLText(doc, "الاستجابة حسب المرحلة الدراسية", W-30, y); y+=4;
    doc.setTextColor(26,32,44);

    const stageRows = Object.entries(audStats.byStage).map(([stage,d])=>[
      stage, d.total, d.responded, `${Math.round(d.responded/d.total*100)}%`
    ]);
    doc.autoTable({
      startY: y,
      head: [["المرحلة","الإجمالي","استجابت","النسبة"]],
      body: stageRows,
      styles: { font:"helvetica", fontSize:9, halign:"right" },
      headStyles: { fillColor:[0,107,84], halign:"right" },
      margin: { left:30, right:30 },
    });
    y = doc.lastAutoTable.finalY + 20;
  }

  // ── Question Stats ──
  const qStats = computeQuestionStats(questions, responses);
  const selectRatingQs = qStats.filter(q => q.type==="select"||q.type==="rating");

  if (selectRatingQs.length) {
    if (y > pageH - 100) { doc.addPage(); y = 40; }
    doc.setFontSize(13); doc.setTextColor(0,107,84);
    pdfRTLText(doc, "إحصاءات الأسئلة", W-30, y); y+=4;
    doc.setTextColor(26,32,44);

    for (const q of selectRatingQs) {
      if (y > pageH - 80) { doc.addPage(); y = 40; }
      doc.setFontSize(10); doc.setTextColor(45,55,72);
      pdfRTLText(doc, q.label, W-30, y); y+=4;

      if (q.type==="select" && q.distribution) {
        const rows = Object.entries(q.distribution).map(([opt,cnt])=>[
          opt, cnt, `${Math.round(cnt/q.responseCount*100)}%`
        ]);
        doc.autoTable({
          startY: y,
          head: [["الخيار","عدد الإجابات","النسبة"]],
          body: rows,
          styles: { font:"helvetica", fontSize:8, halign:"right" },
          headStyles: { fillColor:[45,55,72], halign:"right" },
          margin: { left:40, right:40 },
        });
        y = doc.lastAutoTable.finalY + 10;
      }
      if (q.type==="rating") {
        doc.setFontSize(10);
        doc.text(`متوسط التقييم: ${q.average} / 5`, 30, y); y+=14;
      }
    }
  }

  // ── Footer ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i=1; i<=totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(160,174,192);
    doc.text(`${i} / ${totalPages}`, W/2, pageH-15, { align:"center" });
    pdfRTLText(doc, repFooter, W-30, pageH-15);
  }

  const filename = `تقرير-${survey.title}-${tsStamp()}.pdf`;
  doc.save(filename);
  await audit.exportPdf(user, `تقرير: ${survey.title}`);
  return filename;
}

// ═══════════════════════════════════════════════════════
// تقرير تنفيذي (Excel)
// ═══════════════════════════════════════════════════════
export async function exportExecutiveExcel({ surveys, stats, schoolCount, user }) {
  const XLSX = await ensureXLSX();
  const rows = surveys.map(s => {
    const count = stats[s.id]||0;
    const pct   = schoolCount ? Math.round(count/schoolCount*100) : 0;
    return {
      "الاستبيان":    s.title,
      "النوع":        s.survey_type,
      "الحالة":       s.survey_status || "published",
      "الردود":       count,
      "إجمالي المستهدفين": schoolCount,
      "نسبة الاستجابة": `${pct}%`,
      "تاريخ الإنشاء": s.created_at ? new Date(s.created_at).toLocaleDateString("ar-SA") : "—",
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{wch:30},{wch:14},{wch:14},{wch:10},{wch:18},{wch:18},{wch:16}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "التقرير التنفيذي");
  XLSX.writeFile(wb, `التقرير-التنفيذي-${tsStamp()}.xlsx`);
  await audit.exportExcel(user, "التقرير التنفيذي");
}

