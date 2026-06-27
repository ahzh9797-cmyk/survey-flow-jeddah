import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ErrorBanner,
  ensureXLSX, tsStamp, logAction } from "./lib.jsx";

// ═══════════════════════════════════════════════════════
// SHARED CONSTANTS
// ═══════════════════════════════════════════════════════
const STAGES = ["الابتدائية", "المتوسطة", "الثانوية"];
const STATUS_ACTIVE   = "نشط";
const STATUS_DISABLED = "معطل";
const PER_PAGE = 30;

// ═══════════════════════════════════════════════════════
// SHARED UI HELPERS
// ═══════════════════════════════════════════════════════
const inputStyle = {
  width:"100%", padding:"10px 12px",
  border:`1.5px solid ${C.border}`, borderRadius:10,
  fontSize:14, fontFamily:"inherit", direction:"rtl",
  boxSizing:"border-box", outline:"none", marginBottom:10,
  background:"#fff"
};
const labelStyle = {
  fontSize:12, fontWeight:700, color:C.text,
  marginBottom:4, display:"block"
};

function StatusBadge({ status }) {
  const active = status === STATUS_ACTIVE;
  return (
    <span style={{
      background: active ? C.successBg : "#F3F4F6",
      color: active ? C.success : C.muted,
      border: `1px solid ${active ? C.success+"40" : C.border}`,
      borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700
    }}>
      {active ? "● نشط" : "○ معطل"}
    </span>
  );
}

function FieldInput({ label, value, onChange, type="text", disabled=false, required=false, dir="rtl", placeholder="" }) {
  return (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{color:C.danger}}> *</span>}</label>
      <input
        type={type} value={value||""} onChange={e=>onChange(e.target.value)}
        disabled={disabled} placeholder={placeholder}
        style={{ ...inputStyle, direction:dir, background:disabled?"#f7f7f7":"#fff" }}
      />
    </div>
  );
}

function SegmentedPicker({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {options.map(opt => (
          <button key={opt} onClick={()=>onChange(opt)} style={{
            padding:"8px 14px", borderRadius:9, fontSize:12, fontFamily:"inherit", cursor:"pointer",
            border:`1.5px solid ${value===opt ? C.primary : C.border}`,
            background: value===opt ? C.primaryBg : "#fff",
            color: value===opt ? C.primary : C.muted,
            fontWeight: value===opt ? 700 : 400
          }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:10, marginTop:14 }}>
      <Btn sm variant="secondary" disabled={page===1} onClick={()=>onChange(page-1)}>السابق</Btn>
      <span style={{ fontSize:13, color:C.muted }}>{page} / {totalPages}</span>
      <Btn sm variant="secondary" disabled={page>=totalPages} onClick={()=>onChange(page+1)}>التالي</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SHARED IMPORT ENGINE
// ═══════════════════════════════════════════════════════
/*
  config = {
    table: "survey_schools" | "supervisors" | "administrators",
    primaryKey: "id" | "national_id",
    requiredFields: ["field1","field2"],
    columnMap: { "عنوان العمود": "field_name", ... },
    defaultValues: { status:"نشط", ... },
    previewColumns: [{ key, label }],
    conflictColumn: "id" | "national_id",
  }
*/
function ImportEngine({ config, onDone, onCancel, user }) {
  const [step, setStep] = useState("upload"); // upload | preview | done
  const [raw, setRaw] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importMode, setImportMode] = useState("new_only"); // new_only | update | skip
  const [existingKeys, setExistingKeys] = useState(new Set());
  const [result, setResult] = useState(null);

  async function loadExistingKeys() {
    let all = [], from = 0;
    while (true) {
      const { data } = await supabase
        .from(config.table)
        .select(config.primaryKey)
        .range(from, from+999);
      if (!data?.length) break;
      data.forEach(r => all.push(r[config.primaryKey]));
      if (data.length < 1000) break;
      from += 1000;
    }
    setExistingKeys(new Set(all));
  }

  async function parseFile(file) {
    setParsing(true); setError("");
    try {
      const XLSX = await ensureXLSX();
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:"" });

      const mapped = rows.map(r => {
        const obj = { ...config.defaultValues };
        Object.entries(config.columnMap).forEach(([excelCol, fieldName]) => {
          const val = r[excelCol];
          if (val !== undefined && val !== "") obj[fieldName] = String(val).trim();
        });
        return obj;
      }).filter(r => {
        // تحقق من الحقول الإلزامية
        return config.requiredFields.every(f => r[f] && String(r[f]).trim());
      });

      if (!mapped.length) {
        setError("لم يتم العثور على بيانات صحيحة. تأكد من أسماء الأعمدة في الملف.");
        setParsing(false); return;
      }

      await loadExistingKeys();
      setRaw(mapped);
      setStep("preview");
    } catch (e) {
      setError("فشل قراءة الملف: " + e.message);
    }
    setParsing(false);
  }

  const newRecords = useMemo(() =>
    raw.filter(r => !existingKeys.has(r[config.primaryKey])), [raw, existingKeys, config.primaryKey]);
  const duplicates = useMemo(() =>
    raw.filter(r => existingKeys.has(r[config.primaryKey])), [raw, existingKeys, config.primaryKey]);

  async function runImport() {
    setImporting(true); setError("");
    let toProcess = [];

    if (importMode === "new_only")  toProcess = newRecords;
    if (importMode === "update")    toProcess = raw;
    if (importMode === "skip")      toProcess = newRecords;

    if (!toProcess.length) {
      setResult({ inserted:0, updated:0, skipped:duplicates.length });
      setStep("done"); setImporting(false); return;
    }

    let inserted = 0, updated = 0;
    const BATCH = 100;
    for (let i=0; i<toProcess.length; i+=BATCH) {
      const batch = toProcess.slice(i, i+BATCH);
      if (importMode === "update") {
        const { error:e } = await supabase
          .from(config.table)
          .upsert(batch, { onConflict: config.conflictColumn });
        if (e) { setError("خطأ أثناء الاستيراد: "+e.message); setImporting(false); return; }
        const newInBatch = batch.filter(r => !existingKeys.has(r[config.primaryKey])).length;
        inserted += newInBatch;
        updated  += batch.length - newInBatch;
      } else {
        const { error:e } = await supabase.from(config.table).insert(batch);
        if (e) { setError("خطأ أثناء الاستيراد: "+e.message); setImporting(false); return; }
        inserted += batch.length;
      }
    }
    logAction({ user, action:"bulk_import", table:config.table, details:{ inserted, updated, total:toProcess.length } });
    setResult({ inserted, updated, skipped: duplicates.length });
    setStep("done");
    setImporting(false);
  }

  // ── Upload step ──
  if (step === "upload") return (
    <div style={{ padding:16 }}>
      <h3 style={{ margin:"0 0 14px", fontSize:16, color:C.dark }}>📥 استيراد من Excel</h3>
      <Card style={{ marginBottom:14, background:C.primaryBg }}>
        <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.primary }}>الأعمدة المطلوبة في الملف:</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {Object.keys(config.columnMap).map(col => (
            <span key={col} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8,
              padding:"3px 10px", fontSize:12, color:C.text }}>{col}</span>
          ))}
        </div>
        <p style={{ margin:"10px 0 0", fontSize:11, color:C.muted }}>
          الحقول الإلزامية: <strong style={{color:C.danger}}>{config.requiredFields.map(f =>
            Object.entries(config.columnMap).find(([,v])=>v===f)?.[0] || f
          ).join(", ")}</strong>
        </p>
      </Card>
      <ErrorBanner message={error}/>
      <input type="file" accept=".xlsx,.xls,.csv"
        onChange={e=>{ if(e.target.files?.[0]) parseFile(e.target.files[0]); }}
        style={{ width:"100%", fontSize:13, marginBottom:14 }}/>
      {parsing && <div style={{textAlign:"center", padding:20}}><Spinner/></div>}
      <Btn full variant="secondary" onClick={onCancel}>إلغاء</Btn>
    </div>
  );

  // ── Preview step ──
  if (step === "preview") return (
    <div style={{ padding:16 }}>
      <h3 style={{ margin:"0 0 12px", fontSize:16, color:C.dark }}>🔍 معاينة البيانات</h3>

      {/* ملخص */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
        {[
          { l:"إجمالي الصفوف", v:raw.length, c:C.primary },
          { l:"جديدة", v:newRecords.length, c:C.success },
          { l:"مكررة موجودة", v:duplicates.length, c:C.warn },
        ].map(x => (
          <div key={x.l} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12,
            padding:12, textAlign:"center", borderTop:`3px solid ${x.c}` }}>
            <div style={{ fontSize:22, fontWeight:800, color:x.c }}>{x.v}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{x.l}</div>
          </div>
        ))}
      </div>

      {/* خيار التعامل مع المكررات */}
      {duplicates.length > 0 && (
        <Card style={{ marginBottom:14, background:C.warnBg }}>
          <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.warn }}>⚠️ يوجد {duplicates.length} سجل مكرر. كيف تريد التعامل معها؟</p>
          {[
            ["new_only", "تجاهل المكررة — استيراد الجديدة فقط"],
            ["update",   "تحديث المكررة + استيراد الجديدة"],
            ["skip",     "تخطي المكررة بدون تحديث"],
          ].map(([v,l]) => (
            <label key={v} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13,
              cursor:"pointer", padding:"6px 0", color:importMode===v?C.primary:C.dark }}>
              <input type="radio" checked={importMode===v} onChange={()=>setImportMode(v)}
                style={{width:16,height:16}}/>
              {l}
            </label>
          ))}
        </Card>
      )}

      {/* جدول المعاينة */}
      <div style={{ overflowX:"auto", marginBottom:14, borderRadius:12, border:`1px solid ${C.border}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:400 }}>
          <thead>
            <tr style={{ background:C.primaryBg }}>
              <th style={{ padding:"8px 10px", textAlign:"right", color:C.primary, borderBottom:`1px solid ${C.border}`, fontWeight:700 }}>
                الحالة
              </th>
              {config.previewColumns.map(col => (
                <th key={col.key} style={{ padding:"8px 10px", textAlign:"right",
                  color:C.primary, borderBottom:`1px solid ${C.border}`, fontWeight:700, whiteSpace:"nowrap" }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {raw.slice(0,50).map((r,i) => {
              const isDup = existingKeys.has(r[config.primaryKey]);
              return (
                <tr key={i} style={{ background:isDup?"#FFFBEB":i%2===0?"#fff":"#FAFAFA",
                  borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"6px 10px" }}>
                    <span style={{ fontSize:10, fontWeight:700,
                      color:isDup?C.warn:C.success }}>
                      {isDup ? "⚠️ مكرر" : "✅ جديد"}
                    </span>
                  </td>
                  {config.previewColumns.map(col => (
                    <td key={col.key} style={{ padding:"6px 10px", color:C.dark, whiteSpace:"nowrap" }}>
                      {r[col.key]||"—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {raw.length > 50 && (
          <p style={{ textAlign:"center", padding:"8px", fontSize:11, color:C.muted, margin:0 }}>
            ... و{raw.length-50} سجل آخر
          </p>
        )}
      </div>

      <ErrorBanner message={error}/>
      <div style={{ display:"flex", gap:8 }}>
        <Btn full variant="secondary" onClick={()=>setStep("upload")}>← رجوع</Btn>
        <Btn full loading={importing} onClick={runImport}>
          💾 استيراد {importMode==="update" ? raw.length : newRecords.length} سجل
        </Btn>
      </div>
    </div>
  );

  // ── Done step ──
  return (
    <div style={{ padding:16, textAlign:"center" }}>
      <div style={{ fontSize:64, marginBottom:12 }}>✅</div>
      <h3 style={{ margin:"0 0 16px", color:C.primary }}>تم الاستيراد بنجاح</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:20 }}>
        {[
          { l:"تم إضافتها", v:result.inserted, c:C.success },
          { l:"تم تحديثها", v:result.updated,  c:C.primary },
          { l:"تم تخطيها", v:result.skipped,   c:C.muted },
        ].map(x => (
          <div key={x.l} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12,
            padding:12, borderTop:`3px solid ${x.c}` }}>
            <div style={{ fontSize:20, fontWeight:800, color:x.c }}>{x.v}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{x.l}</div>
          </div>
        ))}
      </div>
      <Btn full onClick={onDone}>تم ✓</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GENERIC ENTITY TABLE
// Reusable table for any directory entity
// ═══════════════════════════════════════════════════════
function EntityTable({ config, user, isAdmin }) {
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("الكل");
  const [page, setPage]           = useState(1);
  const [formTarget, setFormTarget] = useState(null); // null=hidden, {}=new, {...}=edit
  const [importing, setImporting] = useState(false);
  const [selected, setSelected]   = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [info, setInfo]           = useState("");
  const [error, setError]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let all = [], from = 0;
    while (true) {
      const { data } = await supabase
        .from(config.table)
        .select("*")
        .order(config.sortBy || config.primaryKey);
      if (!data?.length) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }
    setRecords(all);
    setLoading(false);
  }, [config.table, config.sortBy, config.primaryKey]);

  useEffect(() => { load(); }, [load]);

  // Filtering
  const filtered = useMemo(() => {
    let r = records;
    if (statusFilter !== "الكل") r = r.filter(x => x.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(x => config.searchFields.some(f =>
        String(x[f]||"").toLowerCase().includes(q)
      ));
    }
    return r;
  }, [records, statusFilter, search, config.searchFields]);

  const paged = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  // Toggle status (soft delete)
  async function toggleStatus(record) {
    const newStatus = record.status === STATUS_ACTIVE ? STATUS_DISABLED : STATUS_ACTIVE;
    const { error:e } = await supabase
      .from(config.table)
      .update({ status: newStatus })
      .eq(config.primaryKey, record[config.primaryKey]);
    if (e) { setError("فشل تغيير الحالة"); return; }
    logAction({ user, action:"update", table:config.table,
      recordId:record[config.primaryKey], recordLabel:`${record[config.nameField]} → ${newStatus}` });
    load();
  }

  // Bulk toggle
  async function bulkToggle(newStatus) {
    if (!selected.size) return;
    setBulkLoading(true);
    const ids = [...selected];
    const { error:e } = await supabase
      .from(config.table)
      .update({ status: newStatus })
      .in(config.primaryKey, ids);
    setBulkLoading(false);
    if (e) { setError("فشل العملية الجماعية"); return; }
    setInfo(`تم تغيير حالة ${ids.length} سجل`);
    setSelected(new Set());
    load();
  }

  // Export Excel
  async function exportExcel() {
    const XLSX = await ensureXLSX();
    const rows = filtered.map(r => {
      const obj = {};
      config.exportColumns.forEach(({key, label}) => { obj[label] = r[key]||""; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0]||{}).map(()=>({wch:22}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, config.exportSheet||"بيانات");
    XLSX.writeFile(wb, `${config.exportSheet||"تصدير"}-${tsStamp()}.xlsx`);
  }

  // Select all on current page
  function toggleSelectAll() {
    if (paged.every(r => selected.has(r[config.primaryKey]))) {
      const next = new Set(selected);
      paged.forEach(r => next.delete(r[config.primaryKey]));
      setSelected(next);
    } else {
      const next = new Set(selected);
      paged.forEach(r => next.add(r[config.primaryKey]));
      setSelected(next);
    }
  }

  if (importing) return (
    <ImportEngine
      config={config.importConfig}
      user={user}
      onDone={()=>{ setImporting(false); load(); }}
      onCancel={()=>setImporting(false)}
    />
  );

  if (formTarget !== null) return (
    <config.FormComponent
      initial={formTarget.id || formTarget[config.primaryKey] ? formTarget : null}
      config={config}
      user={user}
      onSaved={()=>{ setFormTarget(null); load(); }}
      onCancel={()=>setFormTarget(null)}
    />
  );

  return (
    <div style={{ padding:16, direction:"rtl" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <h3 style={{ margin:0, fontSize:17, color:C.dark, fontWeight:800 }}>{config.title}</h3>
          <p style={{ margin:"2px 0 0", fontSize:12, color:C.muted }}>
            {filtered.length} من {records.length} سجل
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {isAdmin && <Btn sm onClick={()=>setFormTarget({})}>➕ إضافة</Btn>}
          <Btn sm variant="secondary" onClick={exportExcel}>📊 Excel</Btn>
          {isAdmin && <Btn sm variant="secondary" onClick={()=>setImporting(true)}>📥 استيراد</Btn>}
        </div>
      </div>

      {/* Messages */}
      <ErrorBanner message={error}/>
      {info && (
        <div style={{ background:C.successBg, border:`1px solid ${C.success}40`, borderRadius:10,
          padding:"10px 14px", fontSize:13, color:C.success, marginBottom:12 }}>
          ✅ {info}
        </div>
      )}

      {/* Search + Filter */}
      <input
        value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
        placeholder={`🔍 ${config.searchPlaceholder||"بحث..."}`}
        style={{ ...inputStyle, marginBottom:10 }}
      />
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
        {["الكل", STATUS_ACTIVE, STATUS_DISABLED, ...(config.filterOptions||[])].map(f => (
          <button key={f} onClick={()=>{ setStatusFilter(f); setPage(1); }} style={{
            padding:"7px 14px", borderRadius:20, fontSize:12, fontFamily:"inherit", cursor:"pointer",
            border:`1.5px solid ${statusFilter===f ? C.primary : C.border}`,
            background: statusFilter===f ? C.primaryBg : "#fff",
            color: statusFilter===f ? C.primary : C.muted,
            fontWeight: statusFilter===f ? 700 : 400
          }}>{f}</button>
        ))}
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div style={{ background:C.primaryBg, border:`1px solid ${C.primary}30`, borderRadius:12,
          padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:13, color:C.primary, fontWeight:700 }}>{selected.size} محدد</span>
          <Btn sm loading={bulkLoading} onClick={()=>bulkToggle(STATUS_ACTIVE)}>تفعيل الكل</Btn>
          <Btn sm variant="secondary" loading={bulkLoading} onClick={()=>bulkToggle(STATUS_DISABLED)}>تعطيل الكل</Btn>
          <button onClick={()=>setSelected(new Set())} style={{ background:"none", border:"none",
            color:C.muted, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>إلغاء التحديد</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40 }}><Spinner size={36}/></div>
      ) : paged.length === 0 ? (
        <Card style={{ textAlign:"center", padding:32 }}>
          <p style={{ margin:0, color:C.muted, fontSize:14 }}>لا توجد نتائج</p>
        </Card>
      ) : (
        <div style={{ borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden",
          boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>

          {/* Select All Row */}
          <div style={{ background:C.bg, padding:"8px 14px", borderBottom:`1px solid ${C.border}`,
            display:"flex", alignItems:"center", gap:10 }}>
            <input type="checkbox"
              checked={paged.length > 0 && paged.every(r => selected.has(r[config.primaryKey]))}
              onChange={toggleSelectAll}
              style={{ width:16, height:16 }}
            />
            <span style={{ fontSize:12, color:C.muted }}>تحديد الصفحة الحالية</span>
          </div>

          {paged.map((record, i) => (
            <div key={record[config.primaryKey]}
              style={{ padding:"12px 14px", background:i%2===0?"#fff":"#FAFAFA",
                borderBottom: i<paged.length-1 ? `1px solid ${C.border}` : "none",
                display:"flex", alignItems:"center", gap:10 }}>

              <input type="checkbox"
                checked={selected.has(record[config.primaryKey])}
                onChange={()=>{
                  const next = new Set(selected);
                  next.has(record[config.primaryKey]) ? next.delete(record[config.primaryKey]) : next.add(record[config.primaryKey]);
                  setSelected(next);
                }}
                style={{ width:16, height:16, flexShrink:0 }}
              />

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark }}>
                    {record[config.nameField]}
                  </p>
                  <StatusBadge status={record.status}/>
                  {config.extraBadge && config.extraBadge(record)}
                </div>
                <p style={{ margin:0, fontSize:11, color:C.muted }}>
                  {config.subtitleFields.map(f =>
                    record[f] ? `${config.fieldLabels?.[f]||f}: ${record[f]}` : null
                  ).filter(Boolean).join(" · ")}
                </p>
              </div>

              {isAdmin && (
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={()=>setFormTarget(record)}
                    style={{ background:C.primaryBg, border:"none", borderRadius:8,
                      padding:"6px 10px", fontSize:12, color:C.primary, cursor:"pointer",
                      fontFamily:"inherit", fontWeight:600 }}>✏️</button>
                  <button onClick={()=>toggleStatus(record)}
                    style={{ background:record.status===STATUS_ACTIVE?"#FFF5F5":C.successBg,
                      border:"none", borderRadius:8, padding:"6px 10px", fontSize:12,
                      color:record.status===STATUS_ACTIVE?C.danger:C.success,
                      cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                    {record.status===STATUS_ACTIVE ? "تعطيل" : "تفعيل"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={p=>{ setPage(p); setSelected(new Set()); }}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// GENERIC FORM COMPONENT (Bottom Sheet)
// ═══════════════════════════════════════════════════════
function EntityForm({ initial, config, user, onSaved, onCancel }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(initial || config.defaultRecord);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k,v) { setForm(p=>({...p,[k]:v})); }

  async function save() {
    const missing = config.requiredFormFields?.filter(f => !form[f]?.trim());
    if (missing?.length) {
      setError("الحقول الإلزامية: " + missing.map(f=>config.fieldLabels?.[f]||f).join(", "));
      return;
    }
    setSaving(true); setError("");
    const payload = {};
    config.formFields.forEach(f => { payload[f.key] = form[f.key]||""; });

    let err;
    if (isEdit) {
      ({ error:err } = await supabase.from(config.table)
        .update(payload).eq(config.primaryKey, initial[config.primaryKey]));
    } else {
      ({ error:err } = await supabase.from(config.table).insert(payload));
    }
    setSaving(false);
    if (err) {
      setError(
        err.code==="23505" ? `${config.duplicateMsg||"هذا المعرف مستخدم بالفعل"}` :
        err.code==="42501" ? "ليست لديك صلاحية تنفيذ هذا الإجراء" :
        "حدث خطأ أثناء الحفظ: " + err.message
      );
      return;
    }
    logAction({ user, action:isEdit?"update":"create", table:config.table,
      recordId:form[config.primaryKey], recordLabel:form[config.nameField] });
    onSaved();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:60,
      display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:C.bg, width:"100%", maxHeight:"92vh", overflowY:"auto",
        borderRadius:"18px 18px 0 0", padding:18, direction:"rtl" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ margin:0, fontSize:16, color:C.dark, fontWeight:800 }}>
            {isEdit ? `تعديل — ${initial[config.nameField]}` : config.addTitle}
          </h3>
          <button onClick={onCancel} style={{ background:"none", border:"none",
            fontSize:22, color:C.muted, cursor:"pointer" }}>✕</button>
        </div>

        <ErrorBanner message={error}/>

        {config.formFields.map(field => {
          if (field.type === "segment") return (
            <SegmentedPicker key={field.key} label={field.label}
              options={field.options} value={form[field.key]||field.options[0]}
              onChange={v=>set(field.key,v)}/>
          );
          if (field.type === "status") return (
            <SegmentedPicker key={field.key} label={field.label}
              options={[STATUS_ACTIVE, STATUS_DISABLED]}
              value={form[field.key]||STATUS_ACTIVE}
              onChange={v=>set(field.key,v)}/>
          );
          if (field.type === "maps") return (
            <div key={field.key}>
              <FieldInput label={field.label} value={form[field.key]}
                onChange={v=>set(field.key,v)} dir="ltr"
                placeholder="https://maps.google.com/..."/>
              {form[field.key] && (
                <a href={form[field.key]} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:12, color:C.primary, display:"block", marginTop:-6, marginBottom:8 }}>
                  🗺️ فتح الخريطة ↗
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

        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          <Btn full variant="secondary" onClick={onCancel}>إلغاء</Btn>
          <Btn full loading={saving} onClick={save}>
            {isEdit ? "حفظ التعديلات" : config.addTitle}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SCHOOLS CONFIG
// ═══════════════════════════════════════════════════════
const SCHOOLS_CONFIG = {
  table: "survey_schools",
  primaryKey: "id",
  nameField: "name",
  sortBy: "name",
  title: "المدارس",
  addTitle: "إضافة مدرسة",
  duplicateMsg: "هذا الرقم الوزاري مستخدم بالفعل",
  searchPlaceholder: "بحث بالاسم أو الرقم الوزاري أو المدير",
  searchFields: ["name","id","principal","district","sector"],
  subtitleFields: ["id","stage","district"],
  fieldLabels: { id:"رقم وزاري", stage:"المرحلة", district:"الحي", sector:"القطاع", principal:"المدير" },
  filterOptions: STAGES,
  exportSheet: "المدارس",
  exportColumns: [
    {key:"id",          label:"الرقم الوزاري"},
    {key:"name",        label:"اسم المدرسة"},
    {key:"stage",       label:"المرحلة"},
    {key:"sector",      label:"القطاع"},
    {key:"district",    label:"الحي"},
    {key:"national_address", label:"العنوان الوطني"},
    {key:"maps_url",    label:"موقع خرائط"},
    {key:"principal",   label:"المدير/ة"},
    {key:"phone",       label:"الجوال"},
    {key:"email",       label:"البريد"},
    {key:"status",      label:"الحالة"},
    {key:"created_at",  label:"تاريخ الإضافة"},
    {key:"updated_at",  label:"آخر تعديل"},
  ],
  extraBadge: (r) => r.stage ? (
    <span style={{ background:`${C.primary}15`, color:C.primary,
      borderRadius:20, padding:"2px 8px", fontSize:10, fontWeight:700 }}>{r.stage}</span>
  ) : null,
  requiredFormFields: ["id","name"],
  defaultRecord: { id:"", name:"", stage:"الابتدائية", sector:"", district:"",
    national_address:"", maps_url:"", principal:"", phone:"", email:"", status:STATUS_ACTIVE },
  formFields: [
    { key:"id",               label:"الرقم الوزاري",    dir:"ltr", placeholder:"مثال: 32100" },
    { key:"name",             label:"اسم المدرسة" },
    { key:"stage",            label:"المرحلة الدراسية", type:"segment", options:STAGES },
    { key:"sector",           label:"القطاع" },
    { key:"district",         label:"الحي" },
    { key:"national_address", label:"العنوان الوطني",   placeholder:"مثال: 7382 شارع..." },
    { key:"maps_url",         label:"رابط خرائط Google", type:"maps" },
    { key:"principal",        label:"اسم المدير/ة" },
    { key:"phone",            label:"جوال المدير/ة",    dir:"ltr" },
    { key:"email",            label:"البريد الإلكتروني", dir:"ltr", inputType:"email" },
    { key:"status",           label:"الحالة",            type:"status" },
  ],
  importConfig: {
    table: "survey_schools",
    primaryKey: "id",
    conflictColumn: "id",
    requiredFields: ["id","name"],
    columnMap: {
      "الرقم الوزاري":   "id",
      "اسم المدرسة":     "name",
      "المرحلة":         "stage",
      "القطاع":          "sector",
      "الحي":            "district",
      "العنوان الوطني":  "national_address",
      "رابط الخريطة":   "maps_url",
      "المدير":          "principal",
      "الجوال":          "phone",
      "البريد":          "email",
    },
    defaultValues: { status: STATUS_ACTIVE },
    previewColumns: [
      {key:"id",        label:"الرقم الوزاري"},
      {key:"name",      label:"اسم المدرسة"},
      {key:"stage",     label:"المرحلة"},
      {key:"district",  label:"الحي"},
      {key:"principal", label:"المدير/ة"},
    ],
  },
  FormComponent: EntityForm,
};

// ═══════════════════════════════════════════════════════
// SUPERVISORS CONFIG
// ═══════════════════════════════════════════════════════
const SUPERVISORS_CONFIG = {
  table: "supervisors",
  primaryKey: "national_id",
  nameField: "name",
  sortBy: "name",
  title: "المشرفون",
  addTitle: "إضافة مشرف",
  duplicateMsg: "رقم الهوية هذا مستخدم بالفعل",
  searchPlaceholder: "بحث بالاسم أو رقم الهوية أو القسم",
  searchFields: ["name","national_id","department","section","job_title"],
  subtitleFields: ["national_id","department","job_title"],
  fieldLabels: { national_id:"رقم الهوية", department:"الإدارة", job_title:"المسمى" },
  exportSheet: "المشرفون",
  exportColumns: [
    {key:"national_id", label:"رقم الهوية"},
    {key:"name",        label:"الاسم الكامل"},
    {key:"department",  label:"الإدارة"},
    {key:"section",     label:"القسم"},
    {key:"job_title",   label:"المسمى الوظيفي"},
    {key:"phone",       label:"الجوال"},
    {key:"email",       label:"البريد"},
    {key:"status",      label:"الحالة"},
    {key:"created_at",  label:"تاريخ الإضافة"},
    {key:"updated_at",  label:"آخر تعديل"},
  ],
  requiredFormFields: ["national_id","name"],
  defaultRecord: { national_id:"", name:"", department:"", section:"",
    job_title:"", phone:"", email:"", status:STATUS_ACTIVE },
  formFields: [
    { key:"national_id", label:"رقم الهوية الوطنية", dir:"ltr", placeholder:"10 أرقام" },
    { key:"name",        label:"الاسم الكامل" },
    { key:"department",  label:"الإدارة" },
    { key:"section",     label:"القسم" },
    { key:"job_title",   label:"المسمى الوظيفي" },
    { key:"phone",       label:"الجوال", dir:"ltr" },
    { key:"email",       label:"البريد الإلكتروني", dir:"ltr", inputType:"email" },
    { key:"status",      label:"الحالة", type:"status" },
  ],
  importConfig: {
    table: "supervisors",
    primaryKey: "national_id",
    conflictColumn: "national_id",
    requiredFields: ["national_id","name"],
    columnMap: {
      "رقم الهوية":      "national_id",
      "الاسم الكامل":    "name",
      "الإدارة":         "department",
      "القسم":           "section",
      "المسمى الوظيفي": "job_title",
      "الجوال":          "phone",
      "البريد":          "email",
    },
    defaultValues: { status: STATUS_ACTIVE },
    previewColumns: [
      {key:"national_id", label:"رقم الهوية"},
      {key:"name",        label:"الاسم"},
      {key:"department",  label:"الإدارة"},
      {key:"job_title",   label:"المسمى"},
    ],
  },
  FormComponent: EntityForm,
};

// ═══════════════════════════════════════════════════════
// ADMINISTRATORS CONFIG
// ═══════════════════════════════════════════════════════
const ADMINISTRATORS_CONFIG = {
  table: "administrators",
  primaryKey: "national_id",
  nameField: "full_name",
  sortBy: "full_name",
  title: "المديرون",
  addTitle: "إضافة مدير",
  duplicateMsg: "رقم الهوية هذا مستخدم بالفعل",
  searchPlaceholder: "بحث بالاسم أو رقم الهوية أو القسم",
  searchFields: ["full_name","national_id","department","section","job_title"],
  subtitleFields: ["national_id","department","job_title"],
  fieldLabels: { national_id:"رقم الهوية", department:"الإدارة", job_title:"المسمى" },
  exportSheet: "المديرون",
  exportColumns: [
    {key:"national_id", label:"رقم الهوية"},
    {key:"full_name",   label:"الاسم الكامل"},
    {key:"department",  label:"الإدارة"},
    {key:"section",     label:"القسم"},
    {key:"job_title",   label:"المسمى الوظيفي"},
    {key:"phone",       label:"الجوال"},
    {key:"email",       label:"البريد"},
    {key:"status",      label:"الحالة"},
    {key:"created_at",  label:"تاريخ الإضافة"},
    {key:"updated_at",  label:"آخر تعديل"},
  ],
  requiredFormFields: ["national_id","full_name"],
  defaultRecord: { national_id:"", full_name:"", department:"", section:"",
    job_title:"", phone:"", email:"", status:STATUS_ACTIVE },
  formFields: [
    { key:"national_id", label:"رقم الهوية الوطنية", dir:"ltr", placeholder:"10 أرقام" },
    { key:"full_name",   label:"الاسم الكامل" },
    { key:"department",  label:"الإدارة" },
    { key:"section",     label:"القسم" },
    { key:"job_title",   label:"المسمى الوظيفي" },
    { key:"phone",       label:"الجوال", dir:"ltr" },
    { key:"email",       label:"البريد الإلكتروني", dir:"ltr", inputType:"email" },
    { key:"status",      label:"الحالة", type:"status" },
  ],
  importConfig: {
    table: "administrators",
    primaryKey: "national_id",
    conflictColumn: "national_id",
    requiredFields: ["national_id","full_name"],
    columnMap: {
      "رقم الهوية":      "national_id",
      "الاسم الكامل":    "full_name",
      "الإدارة":         "department",
      "القسم":           "section",
      "المسمى الوظيفي": "job_title",
      "الجوال":          "phone",
      "البريد":          "email",
    },
    defaultValues: { status: STATUS_ACTIVE },
    previewColumns: [
      {key:"national_id", label:"رقم الهوية"},
      {key:"full_name",   label:"الاسم"},
      {key:"department",  label:"الإدارة"},
      {key:"job_title",   label:"المسمى"},
    ],
  },
  FormComponent: EntityForm,
};

// ═══════════════════════════════════════════════════════
// DIRECTORY PAGE — Main entry point
// ═══════════════════════════════════════════════════════
export default function DirectoryPage({ user, isAdmin }) {
  const [activeTab, setActiveTab] = useState("schools");

  const TABS = [
    { id:"schools",        label:"🏫 المدارس",   config: SCHOOLS_CONFIG },
    { id:"supervisors",    label:"👤 المشرفون",  config: SUPERVISORS_CONFIG },
    { id:"administrators", label:"🎓 المديرون",  config: ADMINISTRATORS_CONFIG },
  ];

  const current = TABS.find(t=>t.id===activeTab);

  return (
    <div style={{ direction:"rtl" }}>
      {/* تبويبات الدليل */}
      <div style={{ display:"flex", borderBottom:`2px solid ${C.border}`,
        background:C.white, position:"sticky", top:0, zIndex:5,
        boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            flex:1, padding:"13px 4px", border:"none", background:"none",
            cursor:"pointer", fontFamily:"inherit", fontSize:13,
            fontWeight: activeTab===t.id ? 700 : 500,
            color: activeTab===t.id ? C.primary : C.muted,
            borderBottom: `3px solid ${activeTab===t.id ? C.primary : "transparent"}`,
            marginBottom:-2, transition:"all 0.15s"
          }}>{t.label}</button>
        ))}
      </div>

      {/* المحتوى */}
      <EntityTable
        key={activeTab}
        config={current.config}
        user={user}
        isAdmin={isAdmin}
      />
    </div>
  );
}

