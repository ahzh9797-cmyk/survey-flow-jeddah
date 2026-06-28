import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, C, Btn, Card, Tag, Spinner, ErrorBanner,
  ensureXLSX, tsStamp, logAction } from "./lib.jsx";

// ── Premium styles ──────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("directory-premium-styles")) {
  const _s = document.createElement("style");
  _s.id = "directory-premium-styles";
  _s.textContent = `
    .dir-row { transition: background 0.12s ease; }
    .dir-row:hover { background: #F0FDF4 !important; }
    .dir-tab { transition: all 0.15s ease; }
    .dir-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .dir-card:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; }
    .dir-btn { transition: all 0.12s ease; }
    .dir-btn:active { transform: scale(0.95); }
    .dir-search:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; outline: none; }
    @keyframes dir-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    .dir-in { animation: dir-in 0.2s ease both; }
    @keyframes spin { to { transform: rotate(360deg) } }
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

// ── unchanged constants ─────────────────────────────────
const STAGES = ["الابتدائية", "المتوسطة", "الثانوية"];
const STATUS_ACTIVE   = "نشط";
const STATUS_DISABLED = "معطل";
const PER_PAGE = 30;

// ── shared input styles ─────────────────────────────────
const iStyle = {
  width:"100%", padding:"11px 13px",
  border:`1.5px solid ${D.s200}`, borderRadius:12,
  fontSize:14, fontFamily:"inherit", direction:"rtl",
  boxSizing:"border-box", outline:"none", marginBottom:10,
  background:D.white, color:D.s900, transition:"border-color 0.2s",
};
const lStyle = { fontSize:12, fontWeight:700, color:D.s700, marginBottom:5, display:"block" };

// ── Premium sub-components ──────────────────────────────

function StatusBadge({ status }) {
  const active = status === STATUS_ACTIVE || !status;
  return (
    <span style={{
      background: active ? D.successBg : D.s100,
      color: active ? D.success : D.s400,
      border: `1px solid ${active ? D.success+"40" : D.s200}`,
      borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:700,
    }}>
      {active ? "● نشط" : "○ معطل"}
    </span>
  );
}

function StageBadge({ stage }) {
  const colors = { "الابتدائية": D.e700, "المتوسطة": D.purple, "الثانوية": D.amber };
  const bgs    = { "الابتدائية": D.e50,  "المتوسطة": D.purpleBg, "الثانوية": D.amberBg };
  return stage ? (
    <span style={{ background:bgs[stage]||D.s100, color:colors[stage]||D.s500,
      border:`1px solid ${colors[stage]||D.s200}30`,
      borderRadius:20, padding:"3px 10px", fontSize:10, fontWeight:700 }}>{stage}</span>
  ) : null;
}

function IconBtn({ icon, label, onClick, color = D.e700, bg = D.e50, danger }) {
  return (
    <button onClick={onClick} className="dir-btn" style={{
      background: danger ? D.dangerBg : bg,
      color: danger ? D.danger : color,
      border: `1px solid ${danger ? "#FECACA" : color+"25"}`,
      borderRadius:9, padding:"6px 12px", fontSize:11,
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
      <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}>🔍</span>
      <input className="dir-search" value={value} onChange={onChange} placeholder={placeholder}
        style={{ ...iStyle, padding:"11px 42px 11px 14px", marginBottom:0 }}/>
      {value && (
        <button onClick={()=>onChange({target:{value:""}})} style={{
          position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
          background:"none", border:"none", color:D.s400, cursor:"pointer", fontSize:16,
        }}>✕</button>
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

function EmptyState({ icon="📋", title="لا توجد نتائج", sub="" }) {
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
      <span>{type==="success" ? "✅" : "⚠️"}</span>{message}
    </div>
  );
}

// ── Premium FieldInput ──────────────────────────────────
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

// ═══════════════════════════════════════════════════════
// IMPORT ENGINE — logic unchanged, UI premium
// ═══════════════════════════════════════════════════════
function ImportEngine({ config, onDone, onCancel, user }) {
  // ── All state & logic unchanged ──
  const [step, setStep] = useState("upload");
  const [raw, setRaw] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importMode, setImportMode] = useState("new_only");
  const [existingKeys, setExistingKeys] = useState(new Set());
  const [result, setResult] = useState(null);

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
      }).filter(r => config.requiredFields.every(f => r[f] && String(r[f]).trim()));
      if (!mapped.length) { setError("لم يتم العثور على بيانات صحيحة. تأكد من أسماء الأعمدة في الملف."); setParsing(false); return; }
      await loadExistingKeys();
      setRaw(mapped);
      setStep("preview");
    } catch (e) { setError("فشل قراءة الملف: " + e.message); }
    setParsing(false);
  }

  const newRecords = useMemo(() => raw.filter(r => !existingKeys.has(r[config.primaryKey])), [raw, existingKeys, config.primaryKey]);
  const duplicates  = useMemo(() => raw.filter(r =>  existingKeys.has(r[config.primaryKey])), [raw, existingKeys, config.primaryKey]);

  async function runImport() {
    setImporting(true); setError("");
    let toProcess = importMode==="update" ? raw : newRecords;
    if (!toProcess.length) { setResult({inserted:0,updated:0,skipped:duplicates.length}); setStep("done"); setImporting(false); return; }
    let inserted=0, updated=0;
    const BATCH=100;
    for (let i=0; i<toProcess.length; i+=BATCH) {
      const batch=toProcess.slice(i,i+BATCH);
      if (importMode==="update") {
        const{error:e}=await supabase.from(config.table).upsert(batch,{onConflict:config.conflictColumn});
        if(e){setError("خطأ: "+e.message);setImporting(false);return;}
        const nib=batch.filter(r=>!existingKeys.has(r[config.primaryKey])).length;
        inserted+=nib; updated+=batch.length-nib;
      } else {
        const{error:e}=await supabase.from(config.table).insert(batch);
        if(e){setError("خطأ: "+e.message);setImporting(false);return;}
        inserted+=batch.length;
      }
    }
    logAction({user,action:"bulk_import",table:config.table,details:{inserted,updated,total:toProcess.length}});
    setResult({inserted,updated,skipped:duplicates.length});
    setStep("done"); setImporting(false);
  }
  // ── End unchanged logic ──

  if (step==="upload") return (
    <div style={{ padding:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={onCancel} style={{ background:D.s100, border:"none", borderRadius:10,
          width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:16, cursor:"pointer", color:D.s500 }}>←</button>
        <h3 style={{ margin:0, fontSize:16, color:D.s900, fontWeight:800 }}>📥 استيراد من Excel</h3>
      </div>

      <div style={{ background:D.e50, border:`1px solid ${D.e100}`, borderRadius:14,
        padding:16, marginBottom:14 }}>
        <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:D.e700 }}>الأعمدة المطلوبة:</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {Object.keys(config.columnMap).map(col => (
            <span key={col} style={{ background:D.white, border:`1px solid ${D.e100}`,
              borderRadius:8, padding:"4px 10px", fontSize:11, color:D.e700, fontWeight:600 }}>{col}</span>
          ))}
        </div>
        <p style={{ margin:"10px 0 0", fontSize:11, color:D.s500 }}>
          إلزامي: <strong style={{color:D.danger}}>{config.requiredFields.map(f =>
            Object.entries(config.columnMap).find(([,v])=>v===f)?.[0]||f).join("، ")}</strong>
        </p>
      </div>

      {error && <div style={{ background:D.dangerBg, border:"1px solid #FECACA", borderRadius:10,
        padding:"10px 14px", fontSize:13, color:D.danger, marginBottom:12 }}>⚠️ {error}</div>}

      <label style={{ display:"block", padding:"30px 20px",
        border:`2px dashed ${D.s200}`, borderRadius:16, textAlign:"center",
        cursor:"pointer", background:D.white, marginBottom:12, transition:"border-color 0.2s" }}
        onMouseEnter={e=>e.currentTarget.style.borderColor=D.e500}
        onMouseLeave={e=>e.currentTarget.style.borderColor=D.s200}>
        <input type="file" accept=".xlsx,.xls,.csv"
          onChange={e=>{ if(e.target.files?.[0]) parseFile(e.target.files[0]); }}
          style={{ display:"none" }}/>
        <div style={{ fontSize:36, marginBottom:8 }}>📄</div>
        <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:700, color:D.s700 }}>
          اضغط لاختيار ملف Excel أو CSV
        </p>
        <p style={{ margin:0, fontSize:11, color:D.s400 }}>xlsx, xls, csv</p>
      </label>

      {parsing && <LoadingState/>}
      <button onClick={onCancel} style={{ width:"100%", padding:"11px", background:D.s100,
        color:D.s700, border:"none", borderRadius:12, fontSize:13, fontWeight:700,
        cursor:"pointer", fontFamily:"inherit" }}>إلغاء</button>
    </div>
  );

  if (step==="preview") return (
    <div style={{ padding:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={()=>setStep("upload")} style={{ background:D.s100, border:"none", borderRadius:10,
          width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:16, cursor:"pointer", color:D.s500 }}>←</button>
        <h3 style={{ margin:0, fontSize:16, color:D.s900, fontWeight:800 }}>🔍 معاينة البيانات</h3>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
        {[
          {l:"إجمالي الصفوف", v:raw.length, c:D.e700},
          {l:"جديدة", v:newRecords.length, c:D.success},
          {l:"مكررة", v:duplicates.length, c:D.warn},
        ].map(x=>(
          <div key={x.l} style={{ background:D.white, border:`1px solid ${D.s200}`,
            borderRadius:14, padding:"12px 8px", textAlign:"center", borderTop:`3px solid ${x.c}` }}>
            <div style={{ fontSize:22, fontWeight:800, color:x.c }}>{x.v}</div>
            <div style={{ fontSize:10, color:D.s400, marginTop:3 }}>{x.l}</div>
          </div>
        ))}
      </div>

      {duplicates.length>0 && (
        <div style={{ background:D.warnBg, border:`1px solid ${D.warn}30`, borderRadius:14,
          padding:14, marginBottom:14 }}>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:D.warn }}>
            ⚠️ {duplicates.length} سجل مكرر — كيف تريد التعامل معها؟
          </p>
          {[
            ["new_only","تجاهل المكررة — استيراد الجديدة فقط"],
            ["update","تحديث المكررة + استيراد الجديدة"],
            ["skip","تخطي المكررة بدون تحديث"],
          ].map(([v,l])=>(
            <label key={v} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13,
              cursor:"pointer", padding:"6px 0", color:importMode===v?D.e700:D.s900, fontWeight:importMode===v?700:400 }}>
              <input type="radio" checked={importMode===v} onChange={()=>setImportMode(v)} style={{width:16,height:16}}/>
              {l}
            </label>
          ))}
        </div>
      )}

      <div style={{ overflowX:"auto", marginBottom:14, borderRadius:12, border:`1px solid ${D.s200}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:400 }}>
          <thead>
            <tr style={{ background:D.e50 }}>
              <th style={{ padding:"9px 12px", textAlign:"right", color:D.e700, borderBottom:`1px solid ${D.s200}`, fontWeight:700 }}>الحالة</th>
              {config.previewColumns.map(col=>(
                <th key={col.key} style={{ padding:"9px 12px", textAlign:"right", color:D.e700,
                  borderBottom:`1px solid ${D.s200}`, fontWeight:700, whiteSpace:"nowrap" }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {raw.slice(0,50).map((r,i)=>{
              const isDup=existingKeys.has(r[config.primaryKey]);
              return (
                <tr key={i} style={{ background:isDup?D.warnBg:i%2===0?D.white:D.s50,
                  borderBottom:`1px solid ${D.s100}` }}>
                  <td style={{ padding:"7px 12px" }}>
                    <span style={{ fontSize:10, fontWeight:700, color:isDup?D.warn:D.success }}>
                      {isDup?"⚠️ مكرر":"✅ جديد"}
                    </span>
                  </td>
                  {config.previewColumns.map(col=>(
                    <td key={col.key} style={{ padding:"7px 12px", color:D.s900, whiteSpace:"nowrap" }}>{r[col.key]||"—"}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {raw.length>50 && (
          <p style={{ textAlign:"center", padding:"8px", fontSize:11, color:D.s400, margin:0 }}>
            ... و{raw.length-50} سجل آخر
          </p>
        )}
      </div>

      {error && <div style={{ background:D.dangerBg, border:"1px solid #FECACA", borderRadius:10,
        padding:"10px 14px", fontSize:13, color:D.danger, marginBottom:12 }}>⚠️ {error}</div>}

      <div style={{ display:"flex", gap:8 }}>
        <button onClick={()=>setStep("upload")} style={{ flex:1, padding:"12px", background:D.s100,
          color:D.s700, border:"none", borderRadius:12, fontSize:13, fontWeight:700,
          cursor:"pointer", fontFamily:"inherit" }}>← رجوع</button>
        <button onClick={runImport} disabled={importing} style={{
          flex:2, padding:"12px", background:importing?`${D.e600}70`:`linear-gradient(135deg,${D.e600},${D.e800})`,
          color:"#fff", border:"none", borderRadius:12, fontSize:13, fontWeight:800,
          cursor:importing?"not-allowed":"pointer", fontFamily:"inherit",
          boxShadow:importing?"none":`0 4px 14px ${D.e600}40`,
        }}>
          {importing ? "جاري الاستيراد..." : `💾 استيراد ${importMode==="update"?raw.length:newRecords.length} سجل`}
        </button>
      </div>
    </div>
  );

  // Done
  return (
    <div style={{ padding:16, textAlign:"center" }}>
      <div style={{ width:80, height:80, borderRadius:"50%", background:D.successBg,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:40, margin:"0 auto 16px" }}>✅</div>
      <h3 style={{ margin:"0 0 6px", color:D.s900, fontWeight:800 }}>تم الاستيراد بنجاح</h3>
      <p style={{ margin:"0 0 20px", fontSize:13, color:D.s500 }}>تم معالجة البيانات بنجاح</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:24 }}>
        {[
          {l:"تم إضافتها", v:result.inserted, c:D.success},
          {l:"تم تحديثها", v:result.updated, c:D.e700},
          {l:"تم تخطيها", v:result.skipped, c:D.s400},
        ].map(x=>(
          <div key={x.l} style={{ background:D.white, border:`1px solid ${D.s200}`,
            borderRadius:14, padding:"14px 8px", borderTop:`3px solid ${x.c}` }}>
            <div style={{ fontSize:22, fontWeight:800, color:x.c }}>{x.v}</div>
            <div style={{ fontSize:10, color:D.s400, marginTop:3 }}>{x.l}</div>
          </div>
        ))}
      </div>
      <button onClick={onDone} style={{ width:"100%", padding:"13px",
        background:`linear-gradient(135deg,${D.e600},${D.e800})`,
        color:"#fff", border:"none", borderRadius:14, fontSize:14, fontWeight:800,
        cursor:"pointer", fontFamily:"inherit", boxShadow:`0 4px 14px ${D.e600}40` }}>
        تم ✓
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ENTITY FORM — logic unchanged, premium UI
// ═══════════════════════════════════════════════════════
function EntityForm({ initial, config, user, onSaved, onCancel }) {
  // ── All logic unchanged ──
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
    else        { ({error:err} = await supabase.from(config.table).insert(payload)); }
    setSaving(false);
    if (err) { setError(err.code==="23505"?config.duplicateMsg||"هذا المعرف مستخدم بالفعل":err.code==="42501"?"ليست لديك صلاحية":"حدث خطأ: "+err.message); return; }
    logAction({ user, action:isEdit?"update":"create", table:config.table, recordId:form[config.primaryKey], recordLabel:form[config.nameField] });
    onSaved();
  }
  // ── End unchanged ──

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:60, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:D.bg, width:"100%", maxHeight:"92vh", overflowY:"auto",
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
              fontSize:16, cursor:"pointer", color:D.s500 }}>✕</button>
          </div>

          {error && <div style={{ background:D.dangerBg, border:"1px solid #FECACA", borderRadius:12,
            padding:"10px 14px", fontSize:13, color:D.danger, marginBottom:14,
            display:"flex", gap:8 }}><span>⚠️</span>{error}</div>}

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
                    style={{ fontSize:12, color:D.e700, display:"block", marginTop:-6, marginBottom:10,
                      display:"flex", alignItems:"center", gap:4 }}>
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ENTITY TABLE — logic unchanged, premium UI
// ═══════════════════════════════════════════════════════
function EntityTable({ config, user, isAdmin }) {
  // ── All state & logic unchanged ──
  const [records,     setRecords]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState("الكل");
  const [page,        setPage]        = useState(1);
  const [formTarget,  setFormTarget]  = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [selected,    setSelected]    = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [info,        setInfo]        = useState("");
  const [error,       setError]       = useState("");

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
    if(statusFilter===STATUS_ACTIVE)   r=r.filter(x=>!x.status||x.status===STATUS_ACTIVE);
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
  // ── End unchanged logic ──

  if (importing) return <ImportEngine config={config.importConfig} user={user} onDone={()=>{setImporting(false);load();}} onCancel={()=>setImporting(false)}/>;
  if (formTarget!==null) return <config.FormComponent initial={formTarget.id||formTarget[config.primaryKey]?formTarget:null} config={config} user={user} onSaved={()=>{setFormTarget(null);load();}} onCancel={()=>setFormTarget(null)}/>;

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <h3 style={{ margin:0, fontSize:17, color:D.s900, fontWeight:800 }}>{config.title}</h3>
          <p style={{ margin:"2px 0 0", fontSize:12, color:D.s500 }}>{filtered.length} من {records.length} سجل</p>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {isAdmin && (
            <button onClick={()=>setFormTarget({})} style={{
              background:`linear-gradient(135deg,${D.e600},${D.e800})`,
              color:"#fff", border:"none", borderRadius:10, padding:"8px 14px",
              fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              boxShadow:`0 3px 10px ${D.e600}40`,
            }}>➕ إضافة</button>
          )}
          <IconBtn icon="📊" label="Excel" onClick={exportExcel}/>
          {isAdmin && <IconBtn icon="📥" label="استيراد" onClick={()=>setImporting(true)}/>}
        </div>
      </div>

      {/* Messages */}
      {error && <InfoBanner message={error} type="error"/>}
      {info  && <InfoBanner message={info}  type="success"/>}

      {/* Search */}
      <SearchInput value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
        placeholder={config.searchPlaceholder||"بحث..."}/>

      {/* Filters */}
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
        {["الكل", STATUS_ACTIVE, STATUS_DISABLED, ...(config.filterOptions||[])].map(f=>(
          <FilterChip key={f} label={f} active={statusFilter===f}
            color={f===STATUS_ACTIVE?D.success:f===STATUS_DISABLED?D.danger:D.e600}
            bg={f===STATUS_ACTIVE?D.successBg:f===STATUS_DISABLED?D.dangerBg:D.e50}
            onClick={()=>{setStatusFilter(f);setPage(1);}}/>
        ))}
      </div>

      {/* Bulk bar */}
      {selected.size>0 && (
        <div style={{ background:D.e50, border:`1px solid ${D.e100}`, borderRadius:12,
          padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
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

      {/* Table */}
      {loading ? <LoadingState/>
      : paged.length===0 ? <EmptyState icon="📋" title="لا توجد نتائج" sub="جرب تغيير البحث أو الفلاتر"/>
      : (
        <div style={{ borderRadius:18, border:`1px solid ${D.s200}`, overflow:"hidden",
          boxShadow:"0 2px 8px rgba(0,0,0,0.05)", background:D.white }}>

          {/* Select all row */}
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
                  <IconBtn icon="✏️" onClick={()=>setFormTarget(record)}/>
                  <IconBtn icon={record.status===STATUS_ACTIVE?"⏸️":"▶️"}
                    onClick={()=>toggleStatus(record)}
                    danger={record.status===STATUS_ACTIVE}
                    color={record.status===STATUS_ACTIVE?D.danger:D.success}
                    bg={record.status===STATUS_ACTIVE?D.dangerBg:D.successBg}/>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <PaginationBar page={page} total={filtered.length} perPage={PER_PAGE}
        onChange={p=>{setPage(p);setSelected(new Set());}}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CONFIGS — unchanged
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
// DIRECTORY PAGE — premium tab bar, logic unchanged
// ═══════════════════════════════════════════════════════
export default function DirectoryPage({ user, isAdmin }) {
  const [activeTab, setActiveTab] = useState("schools");

  const TABS = [
    { id:"schools",        label:"🏫 المدارس",   config:SCHOOLS_CONFIG,        color:D.e700,   bg:D.e50 },
    { id:"supervisors",    label:"👤 المشرفون",  config:SUPERVISORS_CONFIG,    color:D.purple, bg:D.purpleBg },
    { id:"administrators", label:"🎓 الإداريون",  config:ADMINISTRATORS_CONFIG, color:D.amber,  bg:D.amberBg },
  ];

  const current = TABS.find(t=>t.id===activeTab);

  return (
    <div style={{ direction:"rtl" }}>
      {/* Premium tab bar */}
      <div style={{
        background:D.white, position:"sticky", top:0, zIndex:5,
        boxShadow:"0 1px 8px rgba(0,0,0,0.06)",
        borderBottom:`1px solid ${D.s100}`,
      }}>
        <div style={{ display:"flex" }}>
          {TABS.map(t=>{
            const isActive = activeTab===t.id;
            return (
              <button key={t.id} onClick={()=>setActiveTab(t.id)} className="dir-tab" style={{
                flex:1, padding:"13px 4px", border:"none",
                background:isActive?`${t.color}08`:D.white,
                cursor:"pointer", fontFamily:"inherit", fontSize:12,
                fontWeight:isActive?800:500,
                color:isActive?t.color:D.s500,
                borderBottom:`3px solid ${isActive?t.color:"transparent"}`,
                marginBottom:-1, transition:"all 0.15s",
                display:"flex", flexDirection:"column", alignItems:"center", gap:1,
              }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <EntityTable key={activeTab} config={current.config} user={user} isAdmin={isAdmin}/>
    </div>
  );
}

