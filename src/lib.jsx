import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════
// SUPABASE CONFIG — استبدل بالقيم الفعلية لمشروعك
// ═══════════════════════════════════════════════════════
const SUPABASE_URL = "https://dijkdmjrklvyznjedztd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TgKKUVO-KiQ6-AFMmwVpHQ_X38pPUw-";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Lazy CDN loader for export libraries ──
const _scriptCache = {};
export function loadScript(src) {
  if (_scriptCache[src]) return _scriptCache[src];
  _scriptCache[src] = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { existing.addEventListener("load", resolve); if (existing.dataset.loaded) resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => { s.dataset.loaded = "1"; resolve(); };
    s.onerror = () => reject(new Error("تعذر تحميل مكتبة التصدير"));
    document.body.appendChild(s);
  });
  return _scriptCache[src];
}
export async function ensureXLSX() {
  if (!window.XLSX) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  return window.XLSX;
}
export async function ensurePDF() {
  if (!window.jspdf) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  if (!window.jspdf.jsPDF.API.autoTable) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
  return window.jspdf.jsPDF;
}

// Arabic-safe filename timestamp
export function tsStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export const C = {
  primary:"#0B6E6E",primaryLight:"#0E8E8E",primaryBg:"#EAF5F5",
  accent:"#C49A28",accentLight:"#FDF6E0",dark:"#1A2B2B",
  text:"#2D3E3E",muted:"#6B8585",border:"#D0E4E4",
  white:"#FFFFFF",bg:"#F4F9F9",danger:"#C0392B",success:"#1A7A4A",
  successBg:"#E8F5EE",warn:"#E67E22",warnBg:"#FEF5EC",
};

// ── UI ATOMS ──
export function Spinner({size=24}){
  return(
    <div style={{width:size,height:size,border:`3px solid ${C.border}`,borderTopColor:C.primary,
      borderRadius:"50%",animation:"spin 0.8s linear infinite"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function Stars({value,onChange}){
  const [h,setH]=useState(0);
  return(
    <div style={{display:"flex",gap:6}}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} onClick={()=>onChange&&onChange(n)}
          onMouseEnter={()=>onChange&&setH(n)} onMouseLeave={()=>onChange&&setH(0)}
          style={{fontSize:34,cursor:onChange?"pointer":"default",
            color:n<=(h||value)?C.accent:C.border,lineHeight:1}}>★</span>
      ))}
    </div>
  );
}

export function Btn({children,onClick,variant="primary",full,sm,disabled,loading,style:ex}){
  const V={
    primary:{background:C.primary,color:"#fff",border:"none"},
    secondary:{background:C.primaryBg,color:C.primary,border:`1px solid ${C.border}`},
    gold:{background:C.accent,color:"#fff",border:"none"},
    green:{background:"#25D366",color:"#fff",border:"none"},
    danger:{background:"#fdf0ee",color:C.danger,border:`1px solid #f5c6c0`},
  };
  return(
    <button onClick={onClick} disabled={disabled||loading} style={{
      ...V[variant],borderRadius:10,padding:sm?"8px 14px":"12px 20px",
      fontSize:sm?13:15,fontWeight:700,fontFamily:"inherit",
      cursor:(disabled||loading)?"not-allowed":"pointer",opacity:(disabled||loading)?0.6:1,
      width:full?"100%":"auto",display:"inline-flex",alignItems:"center",
      justifyContent:"center",gap:7,transition:"opacity 0.15s",
      boxSizing:"border-box",...ex
    }}>{loading?<Spinner size={16}/>:children}</button>
  );
}

export function Card({children,style:ex,accent}){
  return(
    <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,
      padding:16,borderRight:accent?`4px solid ${accent}`:undefined,...ex}}>
      {children}
    </div>
  );
}

export function Tag({children,color=C.primary}){
  return(
    <span style={{background:color+"18",color,border:`1px solid ${color}40`,
      borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
      {children}
    </span>
  );
}

export function ErrorBanner({message}){
  if(!message) return null;
  return(
    <div style={{background:"#fdf0ee",border:`1px solid #f5c6c0`,borderRadius:10,
      padding:"10px 14px",fontSize:13,color:C.danger,marginBottom:12}}>
      ⚠️ {message}
    </div>
  );
}

export function ExportMenu({ options }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  async function run(opt) {
    setBusy(opt.key); setError(""); setOpen(false);
    try { await opt.action(); }
    catch (e) { setError("فشل التصدير: " + e.message); }
    setBusy(null);
  }

  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9,
        border:`1.5px solid ${C.border}`, background:"#fff", color:C.primary, fontSize:12,
        fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
        {busy ? <Spinner size={14}/> : "⬇️"} تصدير
      </button>
      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:39 }}/>
          <div style={{ position:"absolute", top:"110%", left:0, background:"#fff", borderRadius:10,
            border:`1px solid ${C.border}`, boxShadow:"0 6px 20px rgba(0,0,0,0.12)", zIndex:40, minWidth:190, overflow:"hidden" }}>
            {options.map(opt => (
              <button key={opt.key} onClick={()=>run(opt)} style={{
                display:"flex", alignItems:"center", gap:8, width:"100%", textAlign:"right", padding:"11px 14px",
                border:"none", background:"#fff", fontSize:12.5, color:C.text, cursor:"pointer", fontFamily:"inherit",
                borderBottom:`1px solid ${C.bg}` }}>
                <span>{opt.icon}</span><span>{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {error && (
        <div style={{ position:"absolute", top:"110%", right:0, marginTop:48, background:"#fdf0ee", color:C.danger,
          fontSize:11, padding:"6px 10px", borderRadius:8, whiteSpace:"nowrap", zIndex:41 }}>{error}</div>
      )}
    </div>
  );
}

// ── PDF Arabic text helper: draws RTL text reversed-shaped is unreliable with core fonts,
// so we render Arabic content via canvas-based text image fallback isn't needed —
// jsPDF + autotable support UTF-8 text directly when using a unicode font is ideal,
// but to keep bundle light we rely on default font with 'right' alignment which renders
// Arabic glyphs correctly in modern jsPDF (basic shaping). For headers we use larger size.
export function pdfRTLText(doc, text, x, y, opts = {}) {
  doc.text(text, x, y, { align: "right", ...opts });
}

// ═══════════════════════════════════════════════════════
// SUPABASE DATA HOOKS
// ═══════════════════════════════════════════════════════

export function useSchoolLookup(){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const lookup = useCallback(async (ministryId) => {
    setLoading(true); setError("");
    const { data, error: err } = await supabase
      .from("survey_schools")
      .select("*")
      .eq("id", ministryId.trim())
      .maybeSingle();
    setLoading(false);
    if (err) { setError("حدث خطأ في الاتصال بقاعدة البيانات"); return null; }
    if (!data) { setError("الرقم الوزاري غير موجود في قاعدة البيانات"); return null; }
    return data;
  }, []);

  return { lookup, loading, error };
}

export function useSurveys(){
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSurveys = useCallback(async () => {
    setLoading(true);
    // نجلب كل الاستبيانات (نشطة + مسودة + بانتظار الاعتماد) لأن السياسة ستفلتر حسب الدور تلقائياً
    const { data: surveysData } = await supabase
      .from("surveys")
      .select("*, survey_questions(*)")
      .order("created_at", { ascending: false });
    setSurveys((surveysData || []).map(s => ({
      ...s,
      questions: (s.survey_questions || []).sort((a,b)=>a.order_index-b.order_index)
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

  return { surveys, loading, refetch: fetchSurveys };
}

export function useResponses(surveyId){
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchResponses = useCallback(async () => {
    if (!surveyId) return;
    setLoading(true);
    let all = [];
    let from = 0;
    const BATCH = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*, survey_schools(name, principal, stage)")
        .eq("survey_id", surveyId)
        .order("submitted_at", { ascending: false })
        .range(from, from + BATCH - 1);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < BATCH) break;
      from += BATCH;
    }
    setResponses(all);
    setLoading(false);
  }, [surveyId]);

  useEffect(() => { fetchResponses(); }, [fetchResponses]);

  return { responses, loading, refetch: fetchResponses };
}

export function useSchoolCount(){
  const [count, setCount] = useState(0);
  useEffect(() => {
    supabase.from("survey_schools").select("*", { count: "exact", head: true })
      .then(({ count }) => setCount(count || 0));
  }, []);
  return count;
}

// ═══════════════════════════════════════════════════════
// ROLES & AUDIT LOG
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// PWA INSTALL PROMPT
// ═══════════════════════════════════════════════════════
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already running as installed app (standalone mode)?
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    if (isStandalone) setInstalled(true);

    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === "accepted";
  }

  return { canInstall: !!deferredPrompt && !installed, installed, promptInstall };
}

export function InstallAppBanner() {
  const { canInstall, installed, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (installed || !canInstall || dismissed) return null;

  return (
    <div style={{ background: C.accentLight, border: `1px solid ${C.accent}40`, borderRadius: 12,
      padding: "12px 14px", margin: "0 16px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 22 }}>📲</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: C.dark }}>ثبّت التطبيق على جهازك</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>وصول أسرع، أيقونة على الشاشة الرئيسية</p>
      </div>
      <button onClick={promptInstall} style={{ background: C.accent, color: "#fff", border: "none",
        borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        تثبيت
      </button>
      <button onClick={()=>setDismissed(true)} style={{ background: "none", border: "none", color: C.muted,
        fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
    </div>
  );
}

export function useUserRole(user) {
  const [role, setRole] = useState(null); // null = loading, 'admin' | 'viewer'
  const [displayName, setDisplayName] = useState("");
  const [roleError, setRoleError] = useState("");

  useEffect(() => {
    if (!user) { setRole(null); return; }
    let active = true;
    supabase.from("user_roles").select("role,display_name").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setRoleError(error.message);
          setRole("viewer");
          return;
        }
        setRole(data?.role || "viewer"); // افتراضياً viewer إن لم يوجد سجل بعد
        setDisplayName(data?.display_name || "");
      });
    return () => { active = false; };
  }, [user]);

  return { role, displayName, isAdmin: role === "admin", roleError };
}

// عدد طلبات التسجيل المعلّقة — يُستخدم لإظهار شارة تنبيه للمدير العام
// إعدادات التطبيق (اللوغو، الاسم، إلخ) — تُجلب مرة واحدة وتُخزن
export function useAppSettings() {
  const [settings, setSettings] = useState({ logo_url:"", app_name:"منظومة الاستبيانات", app_subtitle:"إدارة التعليم — جدة" });
  const reload = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("key,value");
    if (data) {
      const obj = {};
      data.forEach(r => { obj[r.key] = r.value; });
      setSettings(p => ({ ...p, ...obj }));
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { settings, reload };
}

export async function saveSetting(key, value) {
  await supabase.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict:"key" });
}

export function usePendingCount(isAdmin) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    function load() {
      supabase.from("user_roles").select("*", { count:"exact", head:true }).eq("status","pending")
        .then(({ count }) => { if (active) setCount(count || 0); });
    }
    load();
    const interval = setInterval(load, 30000); // تحديث كل 30 ثانية أثناء بقاء المدير في التطبيق
    return () => { active = false; clearInterval(interval); };
  }, [isAdmin]);
  return count;
}

// تسجيل عملية في سجل التدقيق — لا تمنع تنفيذ العملية إن فشل التسجيل نفسه
export async function logAction({ user, action, table, recordId, recordLabel, details }) {
  try {
    await supabase.from("audit_log").insert({
      user_id: user?.id || null,
      user_email: user?.email || null,
      action, table_name: table, record_id: recordId ? String(recordId) : null,
      record_label: recordLabel || null, details: details || null,
    });
  } catch (e) { /* تجاهل أخطاء السجل، لا توقف العملية الأساسية */ }
}

export function RoleBadge({ role }) {
  if (!role) return null;
  const isAdmin = role === "admin";
  return (
    <span style={{ background: isAdmin ? "rgba(196,154,40,0.25)" : "rgba(255,255,255,0.15)",
      color: "#fff", border: `1px solid ${isAdmin ? C.accent : "rgba(255,255,255,0.3)"}`,
      borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 700 }}>
      {isAdmin ? "👑 مدير عام" : "👁️ مشرف (عرض فقط)"}
    </span>
  );
}

export function ViewerNotice({ action = "هذا الإجراء" }) {
  return (
    <div style={{ background: C.warnBg, border: `1px solid ${C.warn}40`, borderRadius: 10,
      padding: "10px 14px", fontSize: 12, color: "#9a5a10", marginBottom: 12, display:"flex", alignItems:"center", gap:8 }}>
      <span>🔒</span><span>صلاحية العرض فقط — {action} متاح للمدير العام فقط</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MINISTRY NUMBER LOOKUP (connected to Supabase)
// ═══════════════════════════════════════════════════════
export function MinistryLookup({ onConfirm }) {
  const [num, setNum] = useState("");
  const [found, setFound] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const { lookup, loading, error } = useSchoolLookup();

  async function handleLookup() {
    const result = await lookup(num);
    if (result) setFound(result);
  }

  function confirm() { setConfirmed(true); onConfirm(found); }

  if (confirmed && found) return (
    <div style={{ background:C.successBg, border:`1.5px solid ${C.success}`, borderRadius:14, padding:16 }}>
      <p style={{ margin:"0 0 6px", fontSize:12, color:C.success, fontWeight:700 }}>✅ تم التحقق من هوية مدرستك</p>
      <p style={{ margin:0, fontSize:16, fontWeight:800, color:C.dark }}>{found.name}</p>
      <p style={{ margin:"4px 0 0", fontSize:13, color:C.muted }}>{found.principal} · {found.stage}</p>
    </div>
  );

  return (
    <div>
      <label style={{ display:"block", fontSize:14, fontWeight:700, color:C.dark, marginBottom:6 }}>
        الرقم الوزاري للمدرسة <span style={{ color:C.danger }}>*</span>
      </label>
      <p style={{ margin:"0 0 10px", fontSize:12, color:C.muted }}>
        أدخل الرقم الوزاري — سيظهر اسم المدرسة والمدير تلقائياً للتحقق
      </p>
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <input value={num} onChange={e=>{ setNum(e.target.value); setFound(null); }}
          placeholder="مثال: 26317 أو M3926412"
          onKeyDown={e => e.key==="Enter" && handleLookup()}
          style={{ flex:1, padding:"12px 14px", border:`1.5px solid ${error?C.danger:found?C.success:C.border}`,
            borderRadius:10, fontSize:15, fontFamily:"inherit", direction:"ltr",
            textAlign:"center", fontWeight:700, outline:"none", letterSpacing:1 }}/>
        <Btn onClick={handleLookup} disabled={!num.trim()} loading={loading} sm>بحث</Btn>
      </div>

      <ErrorBanner message={error}/>

      {found && (
        <div style={{ background:C.successBg, border:`1.5px solid ${C.success}`, borderRadius:12, padding:14, marginBottom:12 }}>
          <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.success }}>✅ تم العثور على المدرسة</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            {[["اسم المدرسة",found.name],["اسم المدير/ة",found.principal],
              ["المرحلة",found.stage],["الرقم الوزاري",found.id]].map(([l,v])=>(
              <div key={l} style={{ background:C.white, borderRadius:8, padding:"8px 10px" }}>
                <p style={{ margin:0, fontSize:10, color:C.muted }}>{l}</p>
                <p style={{ margin:"3px 0 0", fontSize:13, fontWeight:700, color:C.dark, lineHeight:1.4 }}>{v}</p>
              </div>
            ))}
          </div>
          <Btn full onClick={confirm}>✓ تأكيد — هذه مدرستي</Btn>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PUBLIC SURVEY FILL (writes to Supabase)
// ═══════════════════════════════════════════════════════


