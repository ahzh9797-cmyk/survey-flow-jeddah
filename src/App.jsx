import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════
// SUPABASE CONFIG — استبدل بالقيم الفعلية لمشروعك
// ═══════════════════════════════════════════════════════
const SUPABASE_URL = "https://dijkdmjrklvyznjedztd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TgKKUVO-KiQ6-AFMmwVpHQ_X38pPUw-";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const C = {
  primary:"#0B6E6E",primaryLight:"#0E8E8E",primaryBg:"#EAF5F5",
  accent:"#C49A28",accentLight:"#FDF6E0",dark:"#1A2B2B",
  text:"#2D3E3E",muted:"#6B8585",border:"#D0E4E4",
  white:"#FFFFFF",bg:"#F4F9F9",danger:"#C0392B",success:"#1A7A4A",
  successBg:"#E8F5EE",warn:"#E67E22",warnBg:"#FEF5EC",
};

// ── UI ATOMS ──
function Spinner({size=24}){
  return(
    <div style={{width:size,height:size,border:`3px solid ${C.border}`,borderTopColor:C.primary,
      borderRadius:"50%",animation:"spin 0.8s linear infinite"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Stars({value,onChange}){
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

function Btn({children,onClick,variant="primary",full,sm,disabled,loading,style:ex}){
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

function Card({children,style:ex,accent}){
  return(
    <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,
      padding:16,borderRight:accent?`4px solid ${accent}`:undefined,...ex}}>
      {children}
    </div>
  );
}

function Tag({children,color=C.primary}){
  return(
    <span style={{background:color+"18",color,border:`1px solid ${color}40`,
      borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
      {children}
    </span>
  );
}

function ErrorBanner({message}){
  if(!message) return null;
  return(
    <div style={{background:"#fdf0ee",border:`1px solid #f5c6c0`,borderRadius:10,
      padding:"10px 14px",fontSize:13,color:C.danger,marginBottom:12}}>
      ⚠️ {message}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SUPABASE DATA HOOKS
// ═══════════════════════════════════════════════════════

function useSchoolLookup(){
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

function useSurveys(){
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSurveys = useCallback(async () => {
    setLoading(true);
    const { data: surveysData } = await supabase
      .from("surveys")
      .select("*, survey_questions(*)")
      .eq("status", "active")
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

function useResponses(surveyId){
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchResponses = useCallback(async () => {
    if (!surveyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("survey_responses")
      .select("*, survey_schools(name, principal, stage)")
      .eq("survey_id", surveyId)
      .order("submitted_at", { ascending: false });
    setResponses(data || []);
    setLoading(false);
  }, [surveyId]);

  useEffect(() => { fetchResponses(); }, [fetchResponses]);

  return { responses, loading, refetch: fetchResponses };
}

function useSchoolCount(){
  const [count, setCount] = useState(0);
  useEffect(() => {
    supabase.from("survey_schools").select("*", { count: "exact", head: true })
      .then(({ count }) => setCount(count || 0));
  }, []);
  return count;
}

// ═══════════════════════════════════════════════════════
// MINISTRY NUMBER LOOKUP (connected to Supabase)
// ═══════════════════════════════════════════════════════
function MinistryLookup({ onConfirm }) {
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
function PublicFill({ survey, onBack }) {
  const [school, setSchool] = useState(null);
  const [ans, setAns] = useState({});
  const [errs, setErrs] = useState({});
  const [step, setStep] = useState("identify");
  const [submitting, setSubmitting] = useState(false);
  const [existingResp, setExistingResp] = useState(null);
  const [submitError, setSubmitError] = useState("");

  const setA = (id, v) => { setAns(p=>({...p,[id]:v})); setErrs(p=>({...p,[id]:null})); };

  async function checkExisting(s) {
    const { data } = await supabase
      .from("survey_responses")
      .select("submitted_at")
      .eq("survey_id", survey.id)
      .eq("school_id", s.id)
      .maybeSingle();
    if (data) setExistingResp(data);
  }

  async function submit() {
    const e = {};
    survey.questions.forEach(q => { if(q.required && !ans[q.id]) e[q.id]="هذا الحقل مطلوب"; });
    if (Object.keys(e).length) { setErrs(e); return; }

    setSubmitting(true); setSubmitError("");
    const { error } = await supabase
      .from("survey_responses")
      .upsert({
        survey_id: survey.id,
        school_id: school.id,
        answers: ans,
        submitted_at: new Date().toISOString(),
      }, { onConflict: "survey_id,school_id" });

    setSubmitting(false);
    if (error) { setSubmitError("حدث خطأ أثناء الإرسال. حاول مرة أخرى."); return; }
    setStep("done");
  }

  if (step === "done") return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24, direction:"rtl", textAlign:"center" }}>
      <div style={{ fontSize:72, marginBottom:16 }}>✅</div>
      <h2 style={{ color:C.primary, margin:"0 0 8px", fontSize:22, fontWeight:800 }}>تم إرسال إجاباتك بنجاح</h2>
      <p style={{ color:C.muted, fontSize:14, maxWidth:320, lineHeight:1.8 }}>
        شكراً <strong style={{color:C.dark}}>{school?.principal}</strong><br/>
        تم تسجيل رد <strong style={{color:C.dark}}>{school?.name}</strong> في قاعدة البيانات
      </p>
      <div style={{ background:C.primaryBg, borderRadius:12, padding:14, marginTop:20, width:"100%", maxWidth:300 }}>
        <p style={{ margin:0, fontSize:11, color:C.muted }}>الرقم الوزاري</p>
        <p style={{ margin:"4px 0 0", fontSize:22, fontWeight:800, color:C.primary, letterSpacing:2 }}>#{school?.id}</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, direction:"rtl" }}>
      <div style={{ background:C.primary, padding:"18px 16px", color:"#fff" }}>
        <p style={{ margin:0, fontSize:11, opacity:0.7 }}>إدارة التعليم — جدة</p>
        <h1 style={{ margin:"4px 0 0", fontSize:18, fontWeight:800 }}>{survey.title}</h1>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:16 }}>
        {existingResp && (
          <div style={{ background:C.warnBg, border:`1px solid ${C.warn}40`, borderRadius:12, padding:14, marginBottom:16 }}>
            <p style={{ margin:0, fontSize:13, color:C.warn, fontWeight:700 }}>
              ⚠️ مدرستك أجابت مسبقاً — إجابتك الجديدة ستحل محل الإجابة السابقة
            </p>
          </div>
        )}

        {step === "identify" && (
          <Card style={{ marginBottom:16 }}>
            <p style={{ margin:"0 0 16px", fontSize:15, fontWeight:800, color:C.dark }}>أولاً: تحقق من هوية مدرستك</p>
            <MinistryLookup onConfirm={async s => { setSchool(s); await checkExisting(s); setStep("fill"); }}/>
          </Card>
        )}

        {step === "fill" && school && (
          <>
            <div style={{ background:C.successBg, border:`1.5px solid ${C.success}`, borderRadius:12, padding:14, marginBottom:16 }}>
              <p style={{ margin:"0 0 4px", fontSize:12, color:C.success, fontWeight:700 }}>✅ تم التحقق</p>
              <p style={{ margin:0, fontSize:15, fontWeight:800, color:C.dark }}>{school.name}</p>
              <p style={{ margin:"3px 0 0", fontSize:12, color:C.muted }}>
                {school.principal} · {school.stage} · رقم وزاري: {school.id}
              </p>
            </div>

            {survey.description && (
              <div style={{ background:C.accentLight, borderRight:`4px solid ${C.accent}`, borderRadius:12, padding:14, marginBottom:16 }}>
                <p style={{ margin:0, fontSize:13, color:C.dark }}>{survey.description}</p>
              </div>
            )}

            {survey.questions.map((q, i) => (
              <Card key={q.id} style={{ marginBottom:14 }}>
                <p style={{ margin:"0 0 12px", fontWeight:700, color:C.dark, fontSize:15, lineHeight:1.5 }}>
                  <span style={{ color:C.primary, marginLeft:6 }}>{i+1}.</span>
                  {q.label}
                  {q.required && <span style={{ color:C.danger, marginRight:4 }}>*</span>}
                </p>
                {q.type==="text" && (
                  <input value={ans[q.id]||""} onChange={e=>setA(q.id,e.target.value)}
                    style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${errs[q.id]?C.danger:C.border}`,
                      borderRadius:10, fontSize:15, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none" }}/>
                )}
                {q.type==="textarea" && (
                  <textarea value={ans[q.id]||""} onChange={e=>setA(q.id,e.target.value)} rows={3}
                    style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${C.border}`, borderRadius:10,
                      fontSize:14, fontFamily:"inherit", direction:"rtl", resize:"vertical", boxSizing:"border-box", outline:"none" }}/>
                )}
                {q.type==="number" && (
                  <input type="number" value={ans[q.id]||""} onChange={e=>setA(q.id,e.target.value)}
                    style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${errs[q.id]?C.danger:C.border}`,
                      borderRadius:10, fontSize:16, fontFamily:"inherit", boxSizing:"border-box", outline:"none", fontWeight:700 }}/>
                )}
                {q.type==="select" && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {(q.options||[]).map(opt => (
                      <button key={opt} onClick={()=>setA(q.id,opt)} style={{
                        padding:"10px 16px", borderRadius:20, border:`2px solid ${ans[q.id]===opt?C.primary:C.border}`,
                        background:ans[q.id]===opt?C.primaryBg:"#fff", color:ans[q.id]===opt?C.primary:C.text,
                        cursor:"pointer", fontSize:14, fontFamily:"inherit", fontWeight:ans[q.id]===opt?700:400 }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type==="rating" && <Stars value={ans[q.id]||0} onChange={v=>setA(q.id,v)}/>}
                {errs[q.id] && <p style={{ color:C.danger, fontSize:12, margin:"8px 0 0" }}>{errs[q.id]}</p>}
              </Card>
            ))}

            <ErrorBanner message={submitError}/>
            <Btn full onClick={submit} loading={submitting} style={{ marginTop:4 }}>
              إرسال الإجابات ✓
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TRACKING PAGE (live from Supabase)
// ═══════════════════════════════════════════════════════
function TrackingPage({ survey, onBack }) {
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
    supabase.from("survey_schools").select("id,name,principal,stage").order("name")
      .then(({ data }) => { setAllSchools(data || []); setLoadingSchools(false); });
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

  if (loadingSchools || loadingResp) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Spinner size={32}/>
    </div>
  );

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ background:C.primary, padding:"14px 16px", color:"#fff", display:"flex", alignItems:"center", gap:10, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", lineHeight:1 }}>←</button>
        <div>
          <div style={{ fontWeight:800, fontSize:15 }}>متابعة الاستجابة</div>
          <div style={{ fontSize:11, opacity:0.7 }}>{survey.title}</div>
        </div>
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
function SurveysList({ surveys, schoolCount, onNew, onShare, onTrack, loading }) {
  if (loading) return (
    <div style={{ minHeight:"50vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={32}/></div>
  );
  return (
    <div style={{ padding:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, color:C.dark, fontWeight:800 }}>الاستبيانات</h2>
          <p style={{ margin:"2px 0 0", color:C.muted, fontSize:12 }}>{surveys.length} استبيان · {schoolCount} مدرسة</p>
        </div>
        <Btn sm onClick={onNew}>＋ جديد</Btn>
      </div>
      {surveys.length === 0 && (
        <Card style={{ textAlign:"center", padding:32 }}>
          <p style={{ color:C.muted, margin:0 }}>لا توجد استبيانات بعد. أنشئ أول استبيان!</p>
        </Card>
      )}
      {surveys.map(s => (
        <Card key={s.id} style={{ marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <h3 style={{ margin:0, fontSize:15, color:C.dark, fontWeight:700, flex:1, lineHeight:1.4 }}>{s.title}</h3>
            <Tag color={C.success}>نشط</Tag>
          </div>
          <p style={{ margin:"0 0 12px", fontSize:12, color:C.muted }}>{s.description}</p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Btn sm variant="secondary" onClick={()=>onTrack(s)}>📊 متابعة الاستجابة</Btn>
            <Btn sm variant="gold" onClick={()=>onShare(s)}>🔗 مشاركة</Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// NEW SURVEY (writes to Supabase)
// ═══════════════════════════════════════════════════════
function NewSurveyPage({ onSaved, onCancel }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [qs, setQs] = useState([{ id:"q1", type:"text", label:"", required:true, options:[] }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const upd = (id,f,v) => setQs(p => p.map(q => q.id===id ? {...q,[f]:v} : q));
  const types = [
    {v:"text",l:"نص قصير"},{v:"textarea",l:"نص طويل"},
    {v:"number",l:"رقم / إحصائية"},{v:"select",l:"اختيار من قائمة"},{v:"rating",l:"تقييم بالنجوم"},
  ];

  async function save() {
    if (!title.trim()) return;
    setSaving(true); setError("");

    const { data: survey, error: surveyErr } = await supabase
      .from("surveys")
      .insert({ title, description: desc, status: "active" })
      .select()
      .single();

    if (surveyErr) { setSaving(false); setError("فشل حفظ الاستبيان: " + surveyErr.message); return; }

    const questionsPayload = qs.map((q, i) => ({
      survey_id: survey.id, label: q.label, type: q.type,
      required: q.required, options: q.options || [], order_index: i,
    }));

    const { error: qErr } = await supabase.from("survey_questions").insert(questionsPayload);
    setSaving(false);
    if (qErr) { setError("فشل حفظ الأسئلة: " + qErr.message); return; }

    onSaved();
  }

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      <button onClick={onCancel} style={{ background:"none", border:"none", color:C.primary, fontSize:14,
        cursor:"pointer", padding:"0 0 14px", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>← إلغاء</button>
      <h2 style={{ margin:"0 0 16px", fontSize:18, color:C.dark, fontWeight:800 }}>استبيان جديد</h2>

      <Card style={{ marginBottom:14 }}>
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>
            عنوان الاستبيان <span style={{color:C.danger}}>*</span>
          </label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: استبيان البيانات التعريفية"
            style={{ width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`, borderRadius:10,
              fontSize:14, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none" }}/>
        </div>
        <div>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>وصف الاستبيان</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} placeholder="وصف مختصر"
            style={{ width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`, borderRadius:10,
              fontSize:14, fontFamily:"inherit", direction:"rtl", resize:"vertical", boxSizing:"border-box", outline:"none" }}/>
        </div>
      </Card>

      <Card style={{ marginBottom:12, background:"#e8f5ee", border:`1px solid ${C.success}40` }}>
        <p style={{ margin:0, fontSize:13, color:C.success, fontWeight:700 }}>✅ سؤال الرقم الوزاري تلقائي</p>
        <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>يُعرض أولاً للتحقق من هوية المستجيب، ثم أسئلتك أدناه.</p>
      </Card>

      {qs.map((q,i) => (
        <Card key={q.id} style={{ marginBottom:12 }} accent={C.primary}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.primary }}>السؤال {i+1}</span>
            {qs.length>1 && (
              <button onClick={()=>setQs(p=>p.filter(x=>x.id!==q.id))} style={{ background:"none", border:"none", cursor:"pointer", color:C.danger, fontSize:18 }}>🗑</button>
            )}
          </div>
          <input value={q.label} onChange={e=>upd(q.id,"label",e.target.value)} placeholder="نص السؤال..."
            style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${C.border}`, borderRadius:10,
              fontSize:14, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none", marginBottom:10 }}/>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <select value={q.type} onChange={e=>upd(q.id,"type",e.target.value)}
              style={{ flex:1, minWidth:140, padding:"9px 10px", border:`1.5px solid ${C.border}`, borderRadius:10,
                fontSize:13, fontFamily:"inherit", color:C.text, background:C.white }}>
              {types.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, cursor:"pointer" }}>
              <input type="checkbox" checked={q.required} onChange={e=>upd(q.id,"required",e.target.checked)} style={{width:16,height:16}}/>مطلوب
            </label>
          </div>
          {q.type==="select" && (
            <textarea value={(q.options||[]).join("\n")} onChange={e=>upd(q.id,"options",e.target.value.split("\n").filter(Boolean))}
              rows={3} placeholder={"خيار 1\nخيار 2\nخيار 3"}
              style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${C.border}`, borderRadius:10,
                fontSize:13, fontFamily:"inherit", direction:"rtl", resize:"none", boxSizing:"border-box", outline:"none", marginTop:8 }}/>
          )}
        </Card>
      ))}

      <ErrorBanner message={error}/>
      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        <Btn sm variant="secondary" onClick={()=>setQs(p=>[...p,{id:`q${Date.now()}`,type:"text",label:"",required:false,options:[]}])}>＋ سؤال</Btn>
        <Btn sm disabled={!title.trim()} loading={saving} onClick={save}>✓ حفظ في قاعدة البيانات</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SHARE SHEET
// ═══════════════════════════════════════════════════════
function ShareSheet({ survey, onClose }) {
  const [tab, setTab] = useState("link");
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?survey=${survey.id}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
  const wa = encodeURIComponent(`السلام عليكم ورحمة الله وبركاته،\n\nنرجو من سعادتكم التكرم بتعبئة الاستبيان التالي:\n*${survey.title}*\n\nالرابط: ${link}\n\nإدارة التعليم — جدة`);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200, display:"flex", alignItems:"flex-end", direction:"rtl" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", background:C.white, borderRadius:"20px 20px 0 0", paddingBottom:32, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0" }}>
          <div style={{ width:40, height:4, background:C.border, borderRadius:4 }}/>
        </div>
        <div style={{ padding:"0 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:17, color:C.dark, fontWeight:800 }}>مشاركة الاستبيان</h3>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.muted }}>✕</button>
          </div>
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginBottom:20 }}>
            {[["link","🔗 رابط"],["qr","📱 QR"],["whatsapp","💬 واتساب"]].map(([k,l]) => (
              <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:"10px 4px", border:"none", background:"none", cursor:"pointer",
                fontSize:12, fontFamily:"inherit", fontWeight:tab===k?700:400, color:tab===k?C.primary:C.muted,
                borderBottom:`2px solid ${tab===k?C.primary:"transparent"}`, marginBottom:-1 }}>{l}</button>
            ))}
          </div>
          {tab==="link" && (
            <div>
              <div style={{ background:C.bg, borderRadius:10, padding:14, marginBottom:12, border:`1px solid ${C.border}`, wordBreak:"break-all", fontSize:13, color:C.muted }}>{link}</div>
              <Btn full variant={copied?"secondary":"primary"} onClick={()=>{ navigator.clipboard.writeText(link).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); }}>
                {copied?"✓ تم النسخ!":"نسخ الرابط"}
              </Btn>
            </div>
          )}
          {tab==="qr" && (
            <div style={{ textAlign:"center", padding:"8px 0" }}>
              <img src={qr} alt="QR" style={{ width:180, height:180, borderRadius:12, border:`1px solid ${C.border}` }}/>
              <p style={{ color:C.muted, fontSize:13, marginTop:12 }}>امسح الرمز للوصول للاستبيان مباشرة</p>
            </div>
          )}
          {tab==="whatsapp" && (
            <a href={`https://wa.me/?text=${wa}`} target="_blank" rel="noopener noreferrer" style={{ display:"block", textDecoration:"none" }}>
              <Btn full variant="green">📱 إرسال عبر واتساب</Btn>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// LOGIN (Supabase Auth)
// ═══════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const schoolCount = useSchoolCount();

  async function handleLogin() {
    setLoading(true); setErr("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) { setErr("البريد أو كلمة المرور غير صحيحة"); return; }
    onLogin(data.user);
  }

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(160deg,${C.primary} 0%,#083d3d 100%)`,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20, direction:"rtl" }}>
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ width:76, height:76, background:C.accent, borderRadius:20, display:"inline-flex", alignItems:"center",
          justifyContent:"center", fontSize:36, marginBottom:14, boxShadow:"0 8px 24px rgba(196,154,40,0.4)" }}>📋</div>
        <h1 style={{ color:"#fff", margin:0, fontSize:24, fontWeight:800 }}>منظومة الاستبيانات</h1>
        <p style={{ color:"rgba(255,255,255,0.65)", margin:"6px 0 0", fontSize:13 }}>إدارة التعليم — جدة · {schoolCount} مدرسة</p>
      </div>
      <div style={{ width:"100%", maxWidth:400, background:C.white, borderRadius:18, padding:24, boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}>
        <h2 style={{ margin:"0 0 20px", fontSize:17, color:C.dark }}>تسجيل الدخول</h2>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>البريد الإلكتروني</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@moe.sa"
            style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${C.border}`, borderRadius:10,
              fontSize:15, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none" }}/>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:C.text, marginBottom:5 }}>كلمة المرور</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${C.border}`, borderRadius:10,
              fontSize:15, fontFamily:"inherit", direction:"rtl", boxSizing:"border-box", outline:"none" }}/>
        </div>
        <ErrorBanner message={err}/>
        <Btn full onClick={handleLogin} loading={loading}>دخول</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════
function AnalyticsPage({ surveys }) {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const schoolCount = useSchoolCount();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const results = {};
      for (const s of surveys) {
        const { count } = await supabase.from("survey_responses").select("*", { count:"exact", head:true }).eq("survey_id", s.id);
        results[s.id] = count || 0;
      }
      setStats(results);
      setLoading(false);
    }
    if (surveys.length) load();
    else setLoading(false);
  }, [surveys]);

  const totalResponded = Object.values(stats).reduce((a,b)=>a+b,0);

  if (loading) return <div style={{ minHeight:"50vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={32}/></div>;

  return (
    <div style={{ padding:16 }}>
      <h2 style={{ margin:"0 0 4px", fontSize:18, color:C.dark, fontWeight:800 }}>الإحصائيات</h2>
      <p style={{ margin:"0 0 18px", fontSize:12, color:C.muted }}>نظرة عامة (بيانات حية من قاعدة البيانات)</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
        {[
          { l:"إجمالي المدارس", v:schoolCount, i:"🏫", c:C.primary },
          { l:"استبيانات نشطة", v:surveys.length, i:"📋", c:C.accent },
          { l:"إجمالي الردود", v:totalResponded, i:"📝", c:C.success },
          { l:"متوسط الردود", v:surveys.length?Math.round(totalResponded/surveys.length):0, i:"📊", c:"#7B2D8B" },
        ].map((x,i) => (
          <Card key={i} style={{ textAlign:"center", padding:14, borderTop:`3px solid ${x.c}` }}>
            <div style={{ fontSize:26 }}>{x.i}</div>
            <div style={{ fontSize:22, fontWeight:800, color:x.c, margin:"4px 0 2px" }}>{x.v}</div>
            <div style={{ fontSize:11, color:C.muted }}>{x.l}</div>
          </Card>
        ))}
      </div>
      {surveys.map(s => {
        const count = stats[s.id] || 0;
        const pct = schoolCount ? Math.round(count/schoolCount*100) : 0;
        return (
          <Card key={s.id} style={{ marginBottom:12 }}>
            <p style={{ margin:"0 0 8px", fontSize:14, fontWeight:700, color:C.dark }}>{s.title}</p>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted, marginBottom:6 }}>
              <span>{count} من {schoolCount} مدرسة</span>
              <span style={{ color:C.primary, fontWeight:700 }}>{pct}%</span>
            </div>
            <div style={{ height:10, background:C.border, borderRadius:6 }}>
              <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${C.primary},${C.primaryLight})`, borderRadius:6 }}/>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("surveys");
  const [modal, setModal] = useState(null);
  const { surveys, loading: loadingSurveys, refetch } = useSurveys();
  const schoolCount = useSchoolCount();

  // check public survey link: ?survey=uuid
  const params = new URLSearchParams(window.location.search);
  const publicSurveyId = params.get("survey");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setAuthChecked(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // public survey fill mode — works WITHOUT login
  if (publicSurveyId) {
    const survey = surveys.find(s => s.id === publicSurveyId);
    if (loadingSurveys) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={32}/></div>;
    if (!survey) return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", direction:"rtl", padding:24, textAlign:"center" }}>
        <p style={{ color:C.muted }}>الاستبيان غير موجود أو غير نشط</p>
      </div>
    );
    return <PublicFill survey={survey} onBack={()=>{}}/>;
  }

  if (!authChecked) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={32}/></div>;

  if (modal?.type === "tracking") return <TrackingPage survey={modal.data} onBack={()=>setModal(null)}/>;

  if (modal?.type === "new") return (
    <div style={{ paddingBottom:80 }}>
      <NewSurveyPage onSaved={()=>{ refetch(); setModal(null); }} onCancel={()=>setModal(null)}/>
    </div>
  );

  if (!user) return <LoginPage onLogin={setUser}/>;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, direction:"rtl", fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif" }}>
      <div style={{ background:C.primary, padding:"14px 16px", color:"#fff", display:"flex", justifyContent:"space-between",
        alignItems:"center", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:C.accent, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>📋</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>منظومة الاستبيانات</div>
            <div style={{ fontSize:10, opacity:0.7 }}>إدارة التعليم — جدة · {schoolCount} مدرسة</div>
          </div>
        </div>
        <button onClick={()=>supabase.auth.signOut()} style={{ background:"rgba(255,255,255,0.15)", border:"none",
          color:"#fff", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>خروج</button>
      </div>

      <div style={{ paddingBottom:80 }}>
        {tab==="surveys" && (
          <SurveysList surveys={surveys} loading={loadingSurveys} schoolCount={schoolCount}
            onNew={()=>setModal({type:"new"})}
            onShare={s=>setModal({type:"share",data:s})}
            onTrack={s=>setModal({type:"tracking",data:s})}/>
        )}
        {tab==="analytics" && <AnalyticsPage surveys={surveys}/>}
      </div>

      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:C.white, borderTop:`1px solid ${C.border}`, display:"flex", zIndex:10 }}>
        {[{id:"surveys",i:"📋",l:"الاستبيانات"},{id:"analytics",i:"📊",l:"إحصائيات"}].map(item => (
          <button key={item.id} onClick={()=>setTab(item.id)} style={{
            flex:1, padding:"10px 0", border:"none", background:"none", cursor:"pointer",
            display:"flex", flexDirection:"column", alignItems:"center", gap:2,
            color:tab===item.id?C.primary:C.muted, fontFamily:"inherit" }}>
            <span style={{ fontSize:20 }}>{item.i}</span>
            <span style={{ fontSize:10, fontWeight:tab===item.id?700:400 }}>{item.l}</span>
            {tab===item.id && <div style={{ width:18, height:3, background:C.primary, borderRadius:2, marginTop:1 }}/>}
          </button>
        ))}
      </div>

      {modal?.type==="share" && <ShareSheet survey={modal.data} onClose={()=>setModal(null)}/>}
    </div>
  );
}
