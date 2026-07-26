import { useState, useEffect } from "react";
import { supabase, Spinner, ensureXLSX, tsStamp } from "./lib.jsx";

// لوحة إدارة "رضا المستفيد" — مستقلة تمامًا عن محرك الاستبيانات الرئيسي

const T = {
  emerald700:"#047857", emerald600:"#059669", emerald100:"#D1FAE5",
  slate900:"#0F172A", slate700:"#334155", slate500:"#64748B",
  slate400:"#94A3B8", slate200:"#E2E8F0", slate100:"#F1F5F9",
  white:"#FFFFFF", bg:"#F0F4F8", danger:"#DC2626", blue:"#0284C7",
};

const TABS = [
  { id:"departments", label:"الأقسام والروابط" },
  { id:"questions",   label:"الأسئلة" },
  { id:"responses",   label:"الردود والتصدير" },
];

function TabBar({ active, onChange }) {
  return (
    <div style={{ display:"flex", gap:6, marginBottom:16, background:T.slate100, padding:4, borderRadius:12 }}>
      {TABS.map(t => (
        <button key={t.id} onClick={()=>onChange(t.id)} style={{
          flex:1, padding:"8px 6px", border:"none", borderRadius:9, cursor:"pointer",
          fontFamily:"inherit", fontSize:12, fontWeight:700,
          background: active===t.id ? T.white : "transparent",
          color: active===t.id ? T.emerald700 : T.slate500,
          boxShadow: active===t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ── تبويب: الأقسام والروابط ──────────────────────────────
function DepartmentsTab({ departments }) {
  const [copiedId, setCopiedId] = useState(null);

  function copy(dept) {
    const url = `${window.location.origin}/?beneficiary=${dept.id}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(dept.id);
    setTimeout(()=>setCopiedId(null), 1500);
  }

  return (
    <div>
      {departments.map(d => {
        const url = `${window.location.origin}/?beneficiary=${d.id}`;
        return (
          <div key={d.id} style={{
            background:T.white, borderRadius:16, border:`1px solid ${T.slate200}`,
            padding:"14px 16px", marginBottom:10, boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
          }}>
            <p style={{ margin:"0 0 8px", fontSize:14, fontWeight:800, color:T.slate900 }}>{d.name}</p>
            <p style={{ margin:"0 0 8px", fontSize:11, color:T.slate500, wordBreak:"break-all", direction:"ltr", textAlign:"left" }}>{url}</p>
            <button onClick={()=>copy(d)} style={{
              background:"none", border:"none", padding:0, fontSize:12, fontWeight:700,
              color:T.emerald700, cursor:"pointer", fontFamily:"inherit",
            }}>{copiedId===d.id ? "تم النسخ ✓" : "نسخ الرابط"}</button>
          </div>
        );
      })}
      <p style={{ fontSize:11, color:T.slate400, marginTop:8, lineHeight:1.7 }}>
        كل رابط أعلاه هو نفسه الباركود الخاص بالقسم — يحدد القسم تلقائيًا بدون أي إدخال من الزائر.
      </p>
    </div>
  );
}

// ── تبويب: الأسئلة ────────────────────────────────────────
function QuestionsTab({ questions, refetch }) {
  const [editing, setEditing] = useState(null); // question object being edited, or "new"
  const [saving, setSaving] = useState(false);

  async function save(q) {
    setSaving(true);
    if (q.id) {
      await supabase.from("beneficiary_questions").update({
        label:q.label, type:q.type, required:q.required, options:q.options, order_index:q.order_index,
      }).eq("id", q.id);
    } else {
      const maxOrder = questions.reduce((m,x)=>Math.max(m,x.order_index||0), 0);
      await supabase.from("beneficiary_questions").insert({
        label:q.label, type:q.type, required:q.required, options:q.options, order_index:maxOrder+1,
      });
    }
    setSaving(false);
    setEditing(null);
    refetch();
  }

  async function remove(id) {
    if (!window.confirm("حذف هذا السؤال نهائيًا؟")) return;
    await supabase.from("beneficiary_questions").delete().eq("id", id);
    refetch();
  }

  if (editing) {
    return <QuestionEditor question={editing} onSave={save} onCancel={()=>setEditing(null)} saving={saving}/>;
  }

  return (
    <div>
      {questions.map(q => (
        <div key={q.id} style={{
          background:T.white, borderRadius:14, border:`1px solid ${T.slate200}`,
          padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:10,
        }}>
          <div style={{ flex:1 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:T.slate900 }}>{q.label}</p>
            <p style={{ margin:"2px 0 0", fontSize:11, color:T.slate500 }}>
              {{ text:"نص قصير", textarea:"نص طويل", select:"قائمة اختيار", rating:"تقييم نجوم" }[q.type]}
              {q.required ? " · إلزامي" : " · اختياري"}
            </p>
          </div>
          <button onClick={()=>setEditing(q)} style={{
            background:T.slate100, border:"none", borderRadius:9, padding:"6px 10px",
            fontSize:11, fontWeight:700, color:T.slate700, cursor:"pointer", fontFamily:"inherit",
          }}>تعديل</button>
          <button onClick={()=>remove(q.id)} style={{
            background:"#FEF2F2", border:"none", borderRadius:9, padding:"6px 10px",
            fontSize:11, fontWeight:700, color:T.danger, cursor:"pointer", fontFamily:"inherit",
          }}>حذف</button>
        </div>
      ))}
      <button onClick={()=>setEditing({ label:"", type:"text", required:true, options:[] })} style={{
        width:"100%", marginTop:8, padding:"12px", background:T.emerald700, color:"#fff",
        border:"none", borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
      }}>+ إضافة سؤال جديد</button>
    </div>
  );
}

function QuestionEditor({ question, onSave, onCancel, saving }) {
  const [q, setQ] = useState({ ...question, optionsText: (question.options||[]).join("، ") });

  function submit() {
    const options = q.type==="select"
      ? q.optionsText.split("،").map(s=>s.trim()).filter(Boolean)
      : [];
    onSave({ ...q, options });
  }

  const inputStyle = {
    width:"100%", padding:"11px 13px", border:`1.5px solid ${T.slate200}`,
    borderRadius:11, fontSize:14, fontFamily:"inherit", direction:"rtl",
    boxSizing:"border-box", background:T.white, color:T.slate900,
  };

  return (
    <div style={{ background:T.white, borderRadius:16, border:`1px solid ${T.slate200}`, padding:16 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.slate700, marginBottom:6 }}>نص السؤال</label>
      <input value={q.label} onChange={e=>setQ({...q, label:e.target.value})} style={{...inputStyle, marginBottom:14}}/>

      <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.slate700, marginBottom:6 }}>نوع السؤال</label>
      <select value={q.type} onChange={e=>setQ({...q, type:e.target.value})} style={{...inputStyle, marginBottom:14}}>
        <option value="text">نص قصير</option>
        <option value="textarea">نص طويل</option>
        <option value="select">قائمة اختيار</option>
        <option value="rating">تقييم نجوم</option>
      </select>

      {q.type==="select" && (
        <>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.slate700, marginBottom:6 }}>الخيارات (افصل بينها بـ「،」)</label>
          <input value={q.optionsText} onChange={e=>setQ({...q, optionsText:e.target.value})} style={{...inputStyle, marginBottom:14}}/>
        </>
      )}

      <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, fontSize:13, color:T.slate700, cursor:"pointer" }}>
        <input type="checkbox" checked={q.required} onChange={e=>setQ({...q, required:e.target.checked})}/>
        إلزامي
      </label>

      <div style={{ display:"flex", gap:8 }}>
        <button onClick={submit} disabled={saving || !q.label.trim()} style={{
          flex:1, padding:"11px", background:T.emerald700, color:"#fff", border:"none",
          borderRadius:11, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
          opacity: saving||!q.label.trim() ? 0.6 : 1,
        }}>{saving ? "جارٍ الحفظ..." : "حفظ"}</button>
        <button onClick={onCancel} style={{
          flex:1, padding:"11px", background:T.slate100, color:T.slate700, border:"none",
          borderRadius:11, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
        }}>إلغاء</button>
      </div>
    </div>
  );
}

// ── تبويب: الردود والتصدير ────────────────────────────────
function ResponsesTab({ departments, questions }) {
  const [responses, setResponses] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [deptFilter,setDeptFilter]= useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("beneficiary_responses").select("*").order("submitted_at", { ascending:false });
      setResponses(data || []);
      setLoading(false);
    })();
  }, []);

  const deptName = id => departments.find(d=>d.id===id)?.name || "—";
  const filtered = deptFilter==="all" ? responses : responses.filter(r=>r.department_id===deptFilter);

  function formatFullDateTime(value) {
    const d = new Date(value);
    const dayDate = d.toLocaleDateString("ar-SA", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
    const time = d.toLocaleTimeString("ar-SA", { hour:"2-digit", minute:"2-digit" });
    return `${dayDate} - ${time}`;
  }

  async function exportExcel() {
    const XLSX = await ensureXLSX();
    const headers = ["القسم", "اليوم والتاريخ والوقت", ...questions.map(q=>q.label)];
    const rows = filtered.map(r => [
      deptName(r.department_id),
      formatFullDateTime(r.submitted_at),
      ...questions.map(q => r.answers?.[q.id] ?? ""),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "رضا المستفيد");
    XLSX.writeFile(wb, `رضا-المستفيد-${tsStamp()}.xlsx`);
  }

  if (loading) return <div style={{ padding:30, textAlign:"center" }}><Spinner size={24}/></div>;

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
        <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} style={{
          flex:1, padding:"9px 12px", border:`1.5px solid ${T.slate200}`, borderRadius:10,
          fontSize:12, fontFamily:"inherit", direction:"rtl", background:T.white, color:T.slate900,
        }}>
          <option value="all">كل الأقسام</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={exportExcel} disabled={!filtered.length} style={{
          padding:"9px 16px", background:T.emerald700, color:"#fff", border:"none",
          borderRadius:10, fontSize:12, fontWeight:700, cursor:filtered.length?"pointer":"default",
          fontFamily:"inherit", opacity:filtered.length?1:0.5, whiteSpace:"nowrap",
        }}>تصدير Excel</button>
      </div>

      <p style={{ fontSize:12, color:T.slate500, marginBottom:10 }}>{filtered.length} رد</p>

      {filtered.map(r => (
        <div key={r.id} style={{
          background:T.white, borderRadius:14, border:`1px solid ${T.slate200}`,
          padding:"12px 14px", marginBottom:8,
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:12, fontWeight:700, color:T.emerald700 }}>{deptName(r.department_id)}</span>
            <span style={{ fontSize:11, color:T.slate400 }}>{formatFullDateTime(r.submitted_at)}</span>
          </div>
          {questions.filter(q=>q.type!=="rating").slice(0,3).map(q => (
            r.answers?.[q.id] ? (
              <p key={q.id} style={{ margin:"2px 0", fontSize:12, color:T.slate700 }}>
                <b style={{ color:T.slate500, fontWeight:600 }}>{q.label}:</b> {String(r.answers[q.id])}
              </p>
            ) : null
          ))}
        </div>
      ))}
    </div>
  );
}

// ── الصفحة الرئيسية ────────────────────────────────────────
export default function BeneficiaryAdmin() {
  const [tab, setTab] = useState("departments");
  const [departments, setDepartments] = useState([]);
  const [questions,   setQuestions]   = useState([]);
  const [loading,     setLoading]     = useState(true);

  async function fetchAll() {
    setLoading(true);
    const [{ data: deptRows }, { data: qRows }] = await Promise.all([
      supabase.from("beneficiary_departments").select("*").order("created_at", { ascending:true }),
      supabase.from("beneficiary_questions").select("*").order("order_index", { ascending:true }),
    ]);
    setDepartments(deptRows || []);
    setQuestions(qRows || []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  if (loading) return <div style={{ padding:30, textAlign:"center" }}><Spinner size={24}/></div>;

  return (
    <div style={{ direction:"rtl" }}>
      <div style={{ marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:18, color:T.slate900, fontWeight:800 }}>رضا المستفيد</h2>
        <p style={{ margin:"4px 0 0", fontSize:12, color:T.slate500 }}>نظام مستقل تمامًا عن استبيانات المدارس والمشرفين والإداريين</p>
      </div>

      <TabBar active={tab} onChange={setTab}/>

      {tab==="departments" && <DepartmentsTab departments={departments}/>}
      {tab==="questions"   && <QuestionsTab questions={questions} refetch={fetchAll}/>}
      {tab==="responses"   && <ResponsesTab departments={departments} questions={questions}/>}
    </div>
  );
}

