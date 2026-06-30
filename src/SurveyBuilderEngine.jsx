/**
 * SurveyBuilderEngine.jsx
 * Enterprise Survey Builder — Phase 2
 *
 * Replaces the old NewSurveyPage with:
 * - Per-question conditional logic (unlimited)
 * - Question Groups
 * - Full drag & drop reordering
 * - Move Up / Move Down
 * - Duplicate question + group
 * - Legacy gate adapter (old surveys still work)
 * - Live condition preview
 *
 * Props identical to old NewSurveyPage:
 *   onSaved, onCancel, user, isAdmin,
 *   existingSurvey, initialQuestions, initialSurveyType
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase, C, Btn, Card, ErrorBanner } from "./lib.jsx";
import { SURVEY_TYPES, SurveyTypeSelector, SurveySettingsPanel } from "./SurveyService.jsx";
import { AudienceSelector, saveTargeting, loadTargeting, emptyTargeting } from "./TargetingService.jsx";
import { genId, deepClone } from "./utils.js";
import { audit } from "./AuditService.js";
import ConditionBuilder from "./ConditionBuilder.jsx";
import QuestionGroup from "./QuestionGroup.jsx";
import {
  uid, emptyQuestion, emptyGroup, cloneWithNewIds,
  flattenItems, detectCircular, Q_TYPES, qTypeIcon, qTypeLabel,
} from "./LogicUtils.js";
import { adaptLegacySurvey, isLegacySurvey, stripLegacyGate } from "./LegacyGateAdapter.js";
import { evaluateSurvey, getVisibleQuestions } from "./ConditionEngine.js";

// ── Design tokens ────────────────────────────────────
const B = {
  e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",
  e100:"#D1FAE5",e50:"#ECFDF5",
  gold:"#C9A84C",goldL:"#FEF3C7",
  s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
  s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
  white:"#FFFFFF",bg:"#F0F4F8",
  danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
  success:"#059669",successBg:"#ECFDF5",purple:"#7B2D8B",amber:"#B7791F",
};

if (typeof document !== "undefined" && !document.getElementById("builder-styles")) {
  const _s = document.createElement("style");
  _s.id = "builder-styles";
  _s.textContent = `
    .bld-q { transition: box-shadow 0.15s ease, transform 0.15s ease; }
    .bld-q:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08)!important; }
    .bld-q.dragging { opacity:0.4; transform:scale(0.97); }
    .bld-q.dragover { box-shadow:0 0 0 2px #059669!important; }
    .bld-btn { transition:all 0.12s; background:none; border:none; cursor:pointer; padding:6px; border-radius:8px; font-size:14px; color:#64748B; display:flex;align-items:center;justify-content:center; }
    .bld-btn:hover { background:#F1F5F9; color:#334155; }
    .bld-btn:active { transform:scale(0.9); }
    .bld-btn.danger:hover { background:#FEF2F2; color:#DC2626; }
    @keyframes bld-in { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
    .bld-in { animation: bld-in 0.2s ease both; }
    @keyframes spin { to{transform:rotate(360deg)} }
  `;
  document.head.appendChild(_s);
}

const iSt = (extra={}) => ({
  width:"100%", padding:"10px 12px", border:`1.5px solid ${B.s200}`,
  borderRadius:10, fontSize:14, fontFamily:"inherit", direction:"rtl",
  boxSizing:"border-box", outline:"none", background:B.white, color:B.s900,
  transition:"border-color 0.2s", ...extra,
});

// ── Options Editor — professional per-option rows ─────
// Replaces the old single textarea (one option per line) with
// individual rows: drag handle, text input, delete button —
// matching the UX pattern used in Google Forms / Typeform.
function OptionsEditor({ options, onChange }) {
  const opts = options?.length ? options : [""];
  const dragIdx = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  function updateAt(idx, value) {
    const next = [...opts];
    next[idx] = value;
    onChange(next);
  }

  function removeAt(idx) {
    const next = opts.filter((_, i) => i !== idx);
    onChange(next.length ? next : [""]);
  }

  function addOption() {
    onChange([...opts, ""]);
  }

  function moveOption(from, to) {
    if (to < 0 || to >= opts.length) return;
    const next = [...opts];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function onDragStart(idx) { dragIdx.current = idx; }
  function onDragOver(e, idx) { e.preventDefault(); setDragOver(idx); }
  function onDrop(idx) {
    const from = dragIdx.current;
    if (from === null || from === idx) { dragIdx.current = null; setDragOver(null); return; }
    moveOption(from, idx);
    dragIdx.current = null; setDragOver(null);
  }
  function onDragEnd() { dragIdx.current = null; setDragOver(null); }

  // Keyboard: Enter on a row adds a new option right after it and focuses it
  function handleKeyDown(e, idx) {
    if (e.key === "Enter") {
      e.preventDefault();
      const next = [...opts];
      next.splice(idx + 1, 0, "");
      onChange(next);
      // Focus the new input on next tick
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-opt-idx="${idx + 1}"]`);
        el?.focus();
      });
    } else if (e.key === "Backspace" && opts[idx] === "" && opts.length > 1) {
      e.preventDefault();
      removeAt(idx);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-opt-idx="${Math.max(0, idx - 1)}"]`);
        el?.focus();
      });
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:B.s500, marginBottom:6 }}>
        الخيارات ({opts.length})
      </label>

      {opts.map((opt, i) => (
        <div
          key={i}
          draggable
          onDragStart={()=>onDragStart(i)}
          onDragOver={e=>onDragOver(e,i)}
          onDrop={()=>onDrop(i)}
          onDragEnd={onDragEnd}
          style={{
            display:"flex", alignItems:"center", gap:6, marginBottom:6,
            opacity: dragIdx.current===i ? 0.4 : 1,
            boxShadow: dragOver===i && dragIdx.current!==i ? `0 0 0 2px ${B.e600}` : "none",
            borderRadius: 10,
            transition:"box-shadow 0.15s ease, opacity 0.15s ease",
          }}
        >
          {/* Drag handle */}
          <span
            title="اسحب لإعادة الترتيب"
            style={{ cursor:"grab", color:B.s400, fontSize:15, flexShrink:0, padding:"0 2px", touchAction:"none" }}
          >⠿</span>

          {/* Number badge */}
          <span style={{
            width:20, height:20, borderRadius:"50%", flexShrink:0,
            background:B.s100, color:B.s500, fontSize:10, fontWeight:700,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>{i+1}</span>

          {/* Text input */}
          <input
            data-opt-idx={i}
            value={opt}
            onChange={e=>updateAt(i, e.target.value)}
            onKeyDown={e=>handleKeyDown(e, i)}
            placeholder={`خيار ${i+1}`}
            style={{ ...iSt({ flex:1, marginBottom:0, padding:"8px 10px", fontSize:13 }) }}
          />

          {/* Move up/down (touch-friendly alternative to drag) */}
          <button
            type="button"
            title="تحريك لأعلى"
            onClick={()=>moveOption(i, i-1)}
            disabled={i===0}
            style={{ background:"none", border:"none", cursor:i===0?"not-allowed":"pointer",
              color:i===0?B.s200:B.s400, fontSize:13, padding:"2px", flexShrink:0, opacity:i===0?0.4:1 }}
          >⬆️</button>
          <button
            type="button"
            title="تحريك لأسفل"
            onClick={()=>moveOption(i, i+1)}
            disabled={i===opts.length-1}
            style={{ background:"none", border:"none", cursor:i===opts.length-1?"not-allowed":"pointer",
              color:i===opts.length-1?B.s200:B.s400, fontSize:13, padding:"2px", flexShrink:0, opacity:i===opts.length-1?0.4:1 }}
          >⬇️</button>

          {/* Delete */}
          <button
            type="button"
            title="حذف الخيار"
            onClick={()=>removeAt(i)}
            disabled={opts.length===1}
            style={{ background:opts.length===1?"none":B.dangerBg, border:"none", borderRadius:8,
              width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center",
              cursor:opts.length===1?"not-allowed":"pointer", color:opts.length===1?B.s200:B.danger,
              fontSize:13, flexShrink:0 }}
          >✕</button>
        </div>
      ))}

      <button
        type="button"
        onClick={addOption}
        style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:6,
          width:"100%", padding:"8px", marginTop:4,
          background:B.s100, border:`1.5px dashed ${B.s300}`, borderRadius:9,
          color:B.s700, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
        }}
      >＋ إضافة خيار</button>

      <p style={{ margin:"6px 0 0", fontSize:10, color:B.s400 }}>
        💡 اضغط Enter لإضافة خيار جديد بسرعة، أو اسحب ⠿ لإعادة الترتيب
      </p>
    </div>
  );
}

// ── Question Card ─────────────────────────────────────
function QuestionCard({
  item, idx, total, isGate, allFlat,
  onUpdate, onRemove, onMoveUp, onMoveDown, onDuplicate,
  dragHandleProps, isDragging, isDragOver,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const q = item;

  function upd(f, v) { onUpdate({ ...q, [f]: v }); }
  function updConds(conds) { onUpdate({ ...q, conditions: conds }); }

  const typeColor = { text:B.e700, textarea:B.e700, number:B.purple, select:B.amber, rating:B.gold, file:B.success };
  const tc = typeColor[q.type] || B.e700;
  const hasConditions = (q.conditions||[]).length > 0;

  return (
    <div className={`bld-q bld-in${isDragging?" dragging":""}${isDragOver?" dragover":""}`}
      style={{ background:B.white, borderRadius:16, border:`1.5px solid ${hasConditions?B.e100:B.s200}`,
        marginBottom:10, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
        borderRight:`4px solid ${tc}` }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
        background:collapsed?B.s50:B.white, borderBottom:collapsed?"none":`1px solid ${B.s100}` }}>
        <span style={{ background:B.e50, color:B.e700, borderRadius:8, width:26, height:26,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:11, fontWeight:800, flexShrink:0 }}>{idx+1}</span>

        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontSize:13, fontWeight:700, color:B.s900,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {q.label || <span style={{ color:B.s400, fontStyle:"italic" }}>سؤال بدون عنوان</span>}
          </p>
          {collapsed && (
            <p style={{ margin:0, fontSize:10, color:B.s400 }}>
              {qTypeIcon(q.type)} {qTypeLabel(q.type)}
              {q.required && <span style={{ marginRight:6, color:B.danger }}>• مطلوب</span>}
              {hasConditions && <span style={{ marginRight:6, color:B.e700 }}>• {(q.conditions||[]).length} شرط</span>}
            </p>
          )}
        </div>

        {/* Toolbar */}
        <div style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
          <button className="bld-btn" title="سحب" style={{ cursor:"grab" }} {...dragHandleProps}>⠿</button>
          <button className="bld-btn" title="لأعلى" onClick={onMoveUp} disabled={idx===0} style={{ opacity:idx===0?0.3:1 }}>⬆️</button>
          <button className="bld-btn" title="لأسفل" onClick={onMoveDown} disabled={idx>=total-1} style={{ opacity:idx>=total-1?0.3:1 }}>⬇️</button>
          <button className="bld-btn" title="تكرار" onClick={onDuplicate}>📄</button>
          <button className="bld-btn" title={collapsed?"توسيع":"طي"} onClick={()=>setCollapsed(p=>!p)}>
            {collapsed?"🔽":"🔼"}
          </button>
          {total>1 && <button className="bld-btn danger" title="حذف" onClick={onRemove}>🗑️</button>}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding:"12px 14px" }}>
          <input value={q.label||""} onChange={e=>upd("label",e.target.value)}
            placeholder="نص السؤال..."
            style={{ ...iSt({marginBottom:8}) }}
            onFocus={e=>e.target.style.borderColor=B.e500}
            onBlur={e=>e.target.style.borderColor=B.s200}/>

          {/* Description */}
          <input value={q.description||""} onChange={e=>upd("description",e.target.value)}
            placeholder="وصف السؤال (اختياري)"
            style={{ ...iSt({fontSize:12, marginBottom:8, background:B.s50}) }}/>

          {/* Type + Required */}
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" }}>
            <select value={q.type} onChange={e=>upd("type",e.target.value)}
              style={{ ...iSt({flex:1,minWidth:140,marginBottom:0}) }}>
              {Q_TYPES.map(t=><option key={t.v} value={t.v}>{t.icon} {t.l}</option>)}
            </select>
            <label style={{ display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer",color:B.s700,whiteSpace:"nowrap" }}>
              <input type="checkbox" checked={!!q.required} onChange={e=>upd("required",e.target.checked)} style={{width:15,height:15}}/>مطلوب
            </label>
          </div>

          {/* Select options */}
          {q.type==="select" && (
            <OptionsEditor
              options={q.options||[]}
              onChange={next=>upd("options", next)}
            />
          )}

          {/* File types */}
          {q.type==="file" && (
            <div style={{ display:"flex",gap:10,marginBottom:8 }}>
              {[["pdf","PDF"],["xlsx","Excel"]].map(([v,l])=>(
                <label key={v} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,cursor:"pointer" }}>
                  <input type="checkbox"
                    checked={(q.allowedFileTypes||"pdf,xlsx").includes(v)}
                    onChange={e=>{
                      const cur=(q.allowedFileTypes||"pdf,xlsx").split(",").filter(Boolean);
                      const next=e.target.checked?[...new Set([...cur,v])]:cur.filter(x=>x!==v);
                      upd("allowedFileTypes",next.join(","));
                    }}
                    style={{width:14,height:14}}/>{l}
                </label>
              ))}
            </div>
          )}

          {/* Condition Builder */}
          <ConditionBuilder
            conditions={q.conditions||[]}
            onChange={updConds}
            allQuestions={allFlat.map((fq,i)=>({...fq,_idx:i}))}
            thisId={q.id}
          />
        </div>
      )}
    </div>
  );
}

// ── Live Preview Panel ────────────────────────────────
function LivePreview({ items, answers, setAnswers }) {
  const flatQ = flattenItems(items);
  const evalState = useMemo(()=>evaluateSurvey(flatQ, answers),[flatQ, answers]);
  const visible = getVisibleQuestions(flatQ, evalState);

  return (
    <div style={{ background:B.s50, border:`1px solid ${B.s200}`, borderRadius:16, padding:14 }}>
      <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:800, color:B.s900 }}>🔍 معاينة مباشرة</p>
      {visible.map((q,i)=>(
        <div key={q.id} style={{ background:B.white, borderRadius:12, border:`1px solid ${B.s200}`, padding:12, marginBottom:8 }}>
          <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:B.s900 }}>
            {i+1}. {q.label} {q.required&&<span style={{color:B.danger}}>*</span>}
          </p>
          {q.type==="text" && (
            <input value={answers[q.id]||""} onChange={e=>setAnswers(p=>({...p,[q.id]:e.target.value}))}
              style={{ ...iSt({marginBottom:0,fontSize:12}) }}/>
          )}
          {q.type==="select" && (q.options||[]).map(opt=>(
            <button key={opt} onClick={()=>setAnswers(p=>({...p,[q.id]:opt}))}
              style={{ display:"block",width:"100%",textAlign:"right",padding:"8px 10px",marginBottom:4,borderRadius:8,border:`1.5px solid ${answers[q.id]===opt?B.e600:B.s200}`,background:answers[q.id]===opt?B.e50:B.white,cursor:"pointer",fontSize:12,fontFamily:"inherit" }}>
              {opt}
            </button>
          ))}
          {q.type==="number" && (
            <input type="number" value={answers[q.id]||""} onChange={e=>setAnswers(p=>({...p,[q.id]:e.target.value}))}
              style={{ ...iSt({marginBottom:0,fontSize:12}) }}/>
          )}
          {evalState.messages.has(q.id) && (
            <div style={{ background:B.warnBg, borderRadius:8, padding:"6px 10px", marginTop:6 }}>
              <p style={{ margin:0, fontSize:11, color:B.warn }}>{evalState.messages.get(q.id)}</p>
            </div>
          )}
        </div>
      ))}
      {evalState.endAt && (
        <div style={{ background:B.dangerBg, borderRadius:10, padding:10, textAlign:"center" }}>
          <p style={{ margin:0, fontSize:12, color:B.danger, fontWeight:700 }}>🔚 الاستبيان ينتهي هنا بناءً على إجاباتك</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MAIN: SurveyBuilderEngine (= new NewSurveyPage)
// ══════════════════════════════════════════════════════
export default function SurveyBuilderEngine({
  onSaved, onCancel, user, isAdmin,
  existingSurvey, initialQuestions, initialSurveyType,
}) {
  const isEdit = !!existingSurvey;

  // ── Form state ────────────────────────────────────
  const [title,          setTitle]          = useState(existingSurvey?.title || "");
  const [desc,           setDesc]           = useState(existingSurvey?.description || "");
  const [surveyType,     setSurveyType]     = useState(existingSurvey?.survey_type || initialSurveyType || "school");
  const [targeting,      setTargeting]      = useState(emptyTargeting());
  const [targetingLoaded,setTargetingLoaded]= useState(!existingSurvey);
  const [surveySettings, setSurveySettings] = useState({
    response_limit: existingSurvey?.response_limit || "one_per_entity",
    start_date: existingSurvey?.start_date ? new Date(existingSurvey.start_date).toISOString().slice(0,16) : "",
    end_date:   (existingSurvey?.end_date||existingSurvey?.expires_at)
      ? new Date(existingSurvey.end_date||existingSurvey.expires_at).toISOString().slice(0,16) : "",
    survey_status: existingSurvey?.survey_status || "published",
  });

  // ── Items: flat questions + groups ────────────────
  // Each item is either a question (type != "group") or a group (type == "group")
  const [items, setItems] = useState(() => {
    let rawQs = [];
    if (existingSurvey?.questions?.length) {
      rawQs = [...existingSurvey.questions]
        .sort((a,b)=>(a.order_index||0)-(b.order_index||0))
        .map(q=>({
          ...deepClone(q),
          conditions: q.conditions || [],
          options: q.options || [],
          allowedFileTypes: q.allowed_file_types || "pdf,xlsx",
          description: q.description || "",
        }));
      // Adapt legacy gate if needed
      if (isLegacySurvey(existingSurvey)) {
        rawQs = adaptLegacySurvey(existingSurvey, rawQs);
      }
    } else if (initialQuestions?.length) {
      rawQs = initialQuestions.map(q=>({
        ...deepClone(q), id:uid(), conditions:[], options:q.options||[], allowedFileTypes:q.allowed_file_types||"pdf,xlsx",
      }));
    } else {
      rawQs = [emptyQuestion("text")];
    }
    return rawQs;
  });

  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewAns,  setPreviewAns]  = useState({});

  // Drag state
  const dragIdx = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  // Load targeting
  useEffect(()=>{
    if (existingSurvey?.id) {
      loadTargeting(existingSurvey.id).then(t=>{
        if (t && (t.rules?.length || t.selectedSchools?.length)) setTargeting(t);
        else if (existingSurvey.target_stages?.length)
          setTargeting({ rules:existingSurvey.target_stages.map(s=>({method:"stage",value:s})), selectedSchools:[], excludedSchools:[] });
        setTargetingLoaded(true);
      });
    }
  },[existingSurvey?.id]);

  // ── Flat questions (for condition builders) ────────
  const allFlat = useMemo(()=>flattenItems(items),[items]);

  // ── Item operations ───────────────────────────────
  function setItemAt(idx, updFn) {
    setItems(p=>{ const next=[...p]; next[idx]=updFn(p[idx]); return next; });
  }

  function moveItem(idx, dir) {
    const newIdx = idx+dir;
    if (newIdx<0||newIdx>=items.length) return;
    setItems(p=>{ const next=[...p]; [next[idx],next[newIdx]]=[next[newIdx],next[idx]]; return next; });
  }

  function duplicateItem(idx) {
    const clone = cloneWithNewIds(items[idx]);
    setItems(p=>{ const next=[...p]; next.splice(idx+1,0,clone); return next; });
  }

  function removeItem(idx) {
    setItems(p=>p.filter((_,i)=>i!==idx));
  }

  function addQuestion() {
    setItems(p=>[...p, emptyQuestion("text")]);
  }

  function addGroup() {
    setItems(p=>[...p, emptyGroup("مجموعة جديدة")]);
  }

  // Drag handlers
  function onDragStart(idx) { dragIdx.current=idx; }
  function onDragOver(e,idx) { e.preventDefault(); setDragOver(idx); }
  function onDrop(idx) {
    const from=dragIdx.current;
    if(from===null||from===idx){dragIdx.current=null;setDragOver(null);return;}
    setItems(p=>{ const next=[...p]; const [m]=next.splice(from,1); next.splice(idx,0,m); return next; });
    dragIdx.current=null; setDragOver(null);
  }
  function onDragEnd() { dragIdx.current=null; setDragOver(null); }

  // ── Save (business logic identical to original) ───
  async function save() {
    if (!title.trim()) return;

    // Validate circular refs
    const circErr = detectCircular(items);
    if (circErr.length) { setError("خطأ في الشروط: " + circErr.join(" · ")); return; }

    setSaving(true); setError("");

    const approvalStatus = isAdmin ? "approved" : "pending_approval";
    let surveyId = existingSurvey?.id;

    const surveyPayload = stripLegacyGate({
      title, description:desc, survey_type:surveyType,
      survey_status: surveySettings.survey_status,
      response_limit: surveySettings.response_limit,
      start_date: surveySettings.start_date ? new Date(surveySettings.start_date).toISOString() : null,
      end_date:   surveySettings.end_date   ? new Date(surveySettings.end_date).toISOString()   : null,
      expires_at: surveySettings.end_date   ? new Date(surveySettings.end_date).toISOString()   : null,
      target_stages: null,
    });

    if (isEdit) {
      const { error:updErr } = await supabase.from("surveys").update(surveyPayload).eq("id",surveyId);
      if (updErr) { setSaving(false); setError("فشل التحديث: "+updErr.message); return; }
      await supabase.from("survey_questions").delete().eq("survey_id",surveyId);
    } else {
      const { data:survey, error:surveyErr } = await supabase
        .from("surveys")
        .insert({ ...surveyPayload, status:"active", approval_status:approvalStatus, created_by:user?.id })
        .select().single();
      if (surveyErr) {
        setSaving(false);
        setError(surveyErr.code==="42501"?"ليست لديك صلاحية إنشاء استبيانات":"فشل حفظ الاستبيان: "+surveyErr.message);
        return;
      }
      surveyId = survey.id;
    }

    // Save questions (flatten groups, strip _legacy fields)
    // CRITICAL: must preserve each question's own id, because
    // condition.rules[].sourceId and condition.actions[].targetId
    // reference these ids. If we let Supabase auto-generate new
    // ids on every save, every condition silently breaks (its
    // sourceId/targetId becomes orphaned) the next time the
    // survey is reopened or filled in.
    const flat = flattenItems(items);
    const questionsPayload = flat.map((q,i)=>({
      id: q.id, // ← preserve stable id across saves
      survey_id: surveyId,
      label: q.label,
      type: q.type,
      required: q.required,
      options: (q.options || []).filter(o => o && o.trim()),
      order_index: i,
      description: q.description || null,
      conditions: (q.conditions||[]).map(c=>({
        ...c,
        _legacyConverted: undefined, // strip internal flag
      })),
      allowed_file_types: q.type==="file" ? (q.allowedFileTypes||"pdf,xlsx") : null,
    }));

    const { error:qErr } = await supabase.from("survey_questions").insert(questionsPayload);
    if (qErr) { setSaving(false); setError("فشل حفظ الأسئلة: "+qErr.message); return; }

    if (surveyType==="school" && (targeting.rules?.length||targeting.selectedSchools?.length)) {
      await saveTargeting(surveyId, targeting);
    }

    setSaving(false);
    if (isEdit) audit.surveyUpdate(user, surveyId, title);
    else        audit.surveyCreate(user, surveyId, title);
    onSaved();
  }

  // ── Type info banners (unchanged) ─────────────────
  const TYPE_INFO = {
    school:        { bg:"#e8f5ee", border:`1px solid ${B.success}40`, color:B.success,  text:"✅ سؤال الرقم الوزاري تلقائي — يُعرض أولاً للتحقق" },
    supervisor:    { bg:"#f5eefa", border:"1px solid #7B2D8B40",      color:"#7B2D8B",  text:"👤 سؤال رقم الهوية تلقائي — يُعرض أولاً للتحقق" },
    administrator: { bg:"#FFFBEB", border:"1px solid #B7791F40",      color:"#B7791F",  text:"🎓 سؤال رقم الهوية تلقائي — للإداريين" },
    open:          { bg:C.accentLight, border:`1px solid ${C.accent}40`, color:C.accent, text:"🌐 استبيان مفتوح — الاسم اختياري فقط" },
  };
  const ti = TYPE_INFO[surveyType];

  return (
    <div style={{ padding:16, direction:"rtl" }}>
      {/* Back */}
      <button onClick={onCancel} style={{ background:"none",border:"none",color:C.primary,fontSize:14,cursor:"pointer",padding:"0 0 14px",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4 }}>← إلغاء</button>

      <h2 style={{ margin:"0 0 16px", fontSize:18, color:B.s900, fontWeight:800 }}>
        {isEdit?"تعديل الاستبيان":"استبيان جديد"}
      </h2>

      {!isAdmin && (
        <div style={{ background:C.warnBg,border:`1px solid ${C.warn}40`,borderRadius:10,padding:"10px 14px",fontSize:12,color:"#9a5a10",marginBottom:14 }}>
          ℹ️ سيُحفظ كـ<strong> مسودة بانتظار اعتماد المسؤول</strong>.
        </div>
      )}

      {initialQuestions?.length > 0 && (
        <div style={{ background:C.primaryBg,border:`1px solid ${C.primary}30`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.primary,marginBottom:14 }}>
          🗂️ تم تحميل <strong>{initialQuestions.length} سؤال</strong> من القالب.
        </div>
      )}

      {isLegacySurvey(existingSurvey) && (
        <div style={{ background:B.goldL,border:`1px solid ${B.gold}40`,borderRadius:10,padding:"10px 14px",fontSize:12,color:B.gold,marginBottom:14 }}>
          ⚡ تم تحويل الشرط القديم (gate_question) تلقائياً إلى النظام الجديد. سيُحذف الشرط القديم عند الحفظ.
        </div>
      )}

      <Card style={{ marginBottom:14 }}><SurveyTypeSelector value={surveyType} onChange={setSurveyType}/></Card>

      <Card style={{ marginBottom:14 }}>
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block",fontSize:13,fontWeight:700,color:C.text,marginBottom:5 }}>عنوان الاستبيان <span style={{color:C.danger}}>*</span></label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: استبيان البيانات التعريفية"
            style={iSt()}/>
        </div>
        <div>
          <label style={{ display:"block",fontSize:13,fontWeight:700,color:C.text,marginBottom:5 }}>الوصف</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={{ ...iSt(),resize:"vertical" }}/>
        </div>
      </Card>

      <Card style={{ marginBottom:14 }}><SurveySettingsPanel settings={surveySettings} onChange={setSurveySettings}/></Card>

      {surveyType==="school" && targetingLoaded && (
        <Card style={{ marginBottom:14 }}>
          <p style={{ margin:"0 0 14px",fontSize:13,fontWeight:700,color:C.dark }}>🎯 المدارس المستهدفة</p>
          <AudienceSelector entityType="school" value={targeting} onChange={setTargeting}/>
        </Card>
      )}

      {ti && (
        <div style={{ background:ti.bg,border:ti.border,borderRadius:10,padding:"10px 14px",marginBottom:12 }}>
          <p style={{ margin:0,fontSize:13,color:ti.color,fontWeight:700 }}>{ti.text}</p>
        </div>
      )}

      {/* Questions header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
        <p style={{ margin:0,fontSize:13,fontWeight:700,color:B.s700 }}>
          الأسئلة <span style={{ color:B.s400,fontWeight:400 }}>({allFlat.length})</span>
        </p>
        <div style={{ display:"flex",gap:6 }}>
          <button onClick={()=>setShowPreview(p=>!p)} style={{ background:showPreview?B.e50:B.s100,border:`1px solid ${showPreview?B.e100:B.s200}`,borderRadius:9,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",color:showPreview?B.e700:B.s500,fontFamily:"inherit" }}>
            {showPreview?"🔽 إخفاء المعاينة":"🔍 معاينة مباشرة"}
          </button>
          <span style={{ fontSize:10,color:B.s400,alignSelf:"center" }}>اسحب ⠿</span>
        </div>
      </div>

      {/* Live preview */}
      {showPreview && (
        <div style={{ marginBottom:14 }}>
          <LivePreview items={items} answers={previewAns} setAnswers={setPreviewAns}/>
        </div>
      )}

      {/* Question / Group items */}
      {items.map((item,i)=>{
        if (item.type==="group") {
          return (
            <div key={item.id} draggable onDragStart={()=>onDragStart(i)}
              onDragOver={e=>onDragOver(e,i)} onDrop={()=>onDrop(i)} onDragEnd={onDragEnd}>
              <QuestionGroup
                group={item} groupIdx={i} totalGroups={items.length}
                onUpdateLabel={label=>setItemAt(i,g=>({...g,label}))}
                onMoveUp={()=>moveItem(i,-1)}
                onMoveDown={()=>moveItem(i,+1)}
                onDuplicate={()=>duplicateItem(i)}
                onDelete={()=>removeItem(i)}
                isDragging={dragIdx.current===i}
                isDragOver={dragOver===i&&dragIdx.current!==i}
                dragHandleProps={{ onMouseDown:e=>e.currentTarget.closest("[draggable]")?.setAttribute("draggable","true") }}>
                {/* Questions inside group */}
                {(item.questions||[]).map((q,qi)=>(
                  <div key={q.id} draggable
                    onDragStart={()=>{ /* nested drag not implemented */ }}
                    style={{ marginBottom:8 }}>
                    <QuestionCard
                      item={q} idx={qi} total={(item.questions||[]).length}
                      allFlat={allFlat}
                      onUpdate={nq=>setItemAt(i,g=>({ ...g, questions:g.questions.map((gq,gi)=>gi===qi?nq:gq) }))}
                      onRemove={()=>setItemAt(i,g=>({ ...g, questions:g.questions.filter((_,gi)=>gi!==qi) }))}
                      onMoveUp={()=>setItemAt(i,g=>{ const qs=[...g.questions]; [qs[qi],qs[qi-1]]=[qs[qi-1],qs[qi]]; return {...g,questions:qs}; })}
                      onMoveDown={()=>setItemAt(i,g=>{ const qs=[...g.questions]; [qs[qi],qs[qi+1]]=[qs[qi+1],qs[qi]]; return {...g,questions:qs}; })}
                      onDuplicate={()=>setItemAt(i,g=>{ const qs=[...g.questions]; qs.splice(qi+1,0,cloneWithNewIds(q)); return {...g,questions:qs}; })}
                      dragHandleProps={{}}
                    />
                  </div>
                ))}
                <button onClick={()=>setItemAt(i,g=>({...g,questions:[...(g.questions||[]),emptyQuestion()]}))}
                  style={{ background:"none",border:`1.5px dashed ${B.e100}`,borderRadius:8,padding:"6px 12px",fontSize:11,cursor:"pointer",color:B.e700,fontFamily:"inherit",width:"100%",marginBottom:6 }}>
                  ＋ سؤال للمجموعة
                </button>
              </QuestionGroup>
            </div>
          );
        }

        // Flat question
        return (
          <div key={item.id} draggable
            onDragStart={()=>onDragStart(i)}
            onDragOver={e=>onDragOver(e,i)}
            onDrop={()=>onDrop(i)}
            onDragEnd={onDragEnd}>
            <QuestionCard
              item={item} idx={i} total={items.filter(x=>x.type!=="group").length}
              allFlat={allFlat}
              onUpdate={nq=>setItemAt(i,()=>nq)}
              onRemove={()=>removeItem(i)}
              onMoveUp={()=>moveItem(i,-1)}
              onMoveDown={()=>moveItem(i,+1)}
              onDuplicate={()=>duplicateItem(i)}
              isDragging={dragIdx.current===i}
              isDragOver={dragOver===i&&dragIdx.current!==i}
              dragHandleProps={{}}
            />
          </div>
        );
      })}

      {/* Error */}
      <ErrorBanner message={error}/>

      {/* Bottom actions */}
      <div style={{ display:"flex",gap:8,marginBottom:8 }}>
        <button onClick={addQuestion} style={{ flex:1,padding:"11px",background:B.s100,color:B.s700,border:`1.5px dashed ${B.s300}`,borderRadius:12,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
          ＋ سؤال
        </button>
        <button onClick={addGroup} style={{ flex:1,padding:"11px",background:B.e50,color:B.e700,border:`1.5px dashed ${B.e100}`,borderRadius:12,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
          📂 مجموعة
        </button>
        <button onClick={save} disabled={!title.trim()||saving}
          style={{ flex:2,padding:"11px",background:(!title.trim()||saving)?`${B.e600}50`:`linear-gradient(135deg,${B.e600},${B.e800})`,color:"#fff",border:"none",borderRadius:12,fontSize:13,fontWeight:800,cursor:(!title.trim()||saving)?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:(!title.trim()||saving)?"none":`0 4px 14px ${B.e600}40` }}>
          {saving?"جاري الحفظ...":"✓ حفظ"}
        </button>
      </div>
    </div>
  );
}
