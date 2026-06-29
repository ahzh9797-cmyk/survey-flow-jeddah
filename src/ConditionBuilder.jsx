/**
 * ConditionBuilder.jsx
 * UI for building per-question conditions.
 * Used inside each question card in the Survey Builder.
 *
 * Props:
 *   conditions   — current conditions array for this question
 *   onChange     — (newConditions) => void
 *   allQuestions — flat array of all questions (for dropdowns)
 *   thisId       — id of the question being configured (to exclude self-ref)
 */

import { useState } from "react";
import {
  OPERATORS, ACTIONS, emptyCondition, emptyRule,
  getOperatorsForType, uid,
} from "./LogicUtils.js";

// ── Colors ───────────────────────────────────────────
const CB = {
  e700:"#047857",e600:"#059669",e50:"#ECFDF5",e100:"#D1FAE5",
  s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
  s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",white:"#FFFFFF",
  danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
  gold:"#C9A84C",goldL:"#FEF3C7",
};

const iSt = (extra={}) => ({
  padding:"7px 9px", border:`1.5px solid ${CB.s200}`, borderRadius:8,
  fontSize:12, fontFamily:"inherit", direction:"rtl",
  boxSizing:"border-box", outline:"none", background:CB.white, color:CB.s900,
  ...extra,
});

function CBtn({ children, onClick, variant="primary", sm, disabled, style={} }) {
  const v = {
    primary:   { background:`linear-gradient(135deg,${CB.e600},#065F46)`, color:"#fff" },
    secondary: { background:CB.s100, color:CB.s700 },
    danger:    { background:CB.dangerBg, color:CB.danger },
    ghost:     { background:"none", color:CB.s500 },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ border:"none", borderRadius:8, cursor:disabled?"not-allowed":"pointer",
        fontFamily:"inherit", fontWeight:700, display:"inline-flex", alignItems:"center",
        justifyContent:"center", gap:4, opacity:disabled?0.5:1,
        padding:sm?"4px 8px":"6px 12px", fontSize:sm?10:12,
        ...v[variant], ...style }}>
      {children}
    </button>
  );
}

// ── Rule row ─────────────────────────────────────────
function RuleRow({ rule, allQuestions, thisId, onChange, onDelete, canDelete }) {
  const sourceQ = allQuestions.find(q => q.id === rule.sourceId);
  const ops = sourceQ ? getOperatorsForType(sourceQ.type) : OPERATORS;
  const showValue2 = rule.operator === "between";
  const hideValue  = ["isEmpty","isNotEmpty"].includes(rule.operator);

  return (
    <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginBottom:6 }}>
      {/* Source question */}
      <select value={rule.sourceId} onChange={e=>onChange({...rule,sourceId:e.target.value,operator:"eq",value:""})}
        style={{ ...iSt({flex:2,minWidth:100}) }}>
        <option value="">— السؤال —</option>
        {allQuestions.filter(q=>q.id!==thisId).map(q=>(
          <option key={q.id} value={q.id}>{q.label?.slice(0,30)||`سؤال ${q._idx+1}`}</option>
        ))}
      </select>

      {/* Operator */}
      <select value={rule.operator} onChange={e=>onChange({...rule,operator:e.target.value,value:""})}
        style={{ ...iSt({flex:1,minWidth:80}) }}>
        {ops.map(op=><option key={op.v} value={op.v}>{op.l}</option>)}
      </select>

      {/* Value */}
      {!hideValue && (
        sourceQ?.type === "select" ? (
          <select value={rule.value} onChange={e=>onChange({...rule,value:e.target.value})}
            style={{ ...iSt({flex:1,minWidth:80}) }}>
            <option value="">— اختر —</option>
            {(sourceQ.options||[]).map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input value={rule.value||""} onChange={e=>onChange({...rule,value:e.target.value})}
            placeholder="القيمة" style={{ ...iSt({flex:1,minWidth:80}) }}/>
        )
      )}

      {/* Value 2 (between) */}
      {showValue2 && (
        <input value={rule.value2||""} onChange={e=>onChange({...rule,value2:e.target.value})}
          placeholder="حتى" style={{ ...iSt({width:64}) }}/>
      )}

      {canDelete && (
        <button onClick={onDelete} style={{ background:"none",border:"none",color:CB.danger,cursor:"pointer",fontSize:16,padding:"0 2px",flexShrink:0 }}>✕</button>
      )}
    </div>
  );
}

// ── Action row ───────────────────────────────────────
function ActionRow({ action, allQuestions, thisId, onChange, onDelete, canDelete }) {
  const needsTarget = ["jump","skip","show","hide","require","unrequire","disable","enable"].includes(action.type);
  const needsMsg    = action.type === "showMessage";

  return (
    <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginBottom:6 }}>
      <select value={action.type} onChange={e=>onChange({...action,type:e.target.value,targetId:"",message:""})}
        style={{ ...iSt({flex:2,minWidth:120}) }}>
        {ACTIONS.map(a=><option key={a.v} value={a.v}>{a.icon} {a.l}</option>)}
      </select>

      {needsTarget && (
        <select value={action.targetId||""} onChange={e=>onChange({...action,targetId:e.target.value})}
          style={{ ...iSt({flex:2,minWidth:100}) }}>
          <option value="">— السؤال المستهدف —</option>
          {allQuestions.map(q=>(
            <option key={q.id} value={q.id}>{q.label?.slice(0,30)||`سؤال ${q._idx+1}`}</option>
          ))}
        </select>
      )}

      {needsMsg && (
        <input value={action.message||""} onChange={e=>onChange({...action,message:e.target.value})}
          placeholder="نص الرسالة..." style={{ ...iSt({flex:3}) }}/>
      )}

      {canDelete && (
        <button onClick={onDelete} style={{ background:"none",border:"none",color:CB.danger,cursor:"pointer",fontSize:16,padding:"0 2px",flexShrink:0 }}>✕</button>
      )}
    </div>
  );
}

// ── Single Condition Card ─────────────────────────────
function ConditionCard({ condition, index, allQuestions, thisId, onChange, onDelete, onDuplicate }) {
  const [open, setOpen] = useState(index === 0);

  function updRule(idx, newRule) {
    const rules = condition.rules.map((r,i)=>i===idx?newRule:r);
    onChange({...condition,rules});
  }
  function delRule(idx) {
    onChange({...condition,rules:condition.rules.filter((_,i)=>i!==idx)});
  }
  function addRule() {
    onChange({...condition,rules:[...condition.rules,emptyRule()]});
  }
  function updAction(idx, newAction) {
    const actions=condition.actions.map((a,i)=>i===idx?newAction:a);
    onChange({...condition,actions});
  }
  function delAction(idx) {
    onChange({...condition,actions:condition.actions.filter((_,i)=>i!==idx)});
  }
  function addAction() {
    onChange({...condition,actions:[...condition.actions,{id:uid(),type:"hide",targetId:"",message:""}]});
  }

  const isEnabled = condition.enabled !== false;

  return (
    <div style={{ background:isEnabled?CB.white:CB.s50, borderRadius:12, border:`1.5px solid ${isEnabled?CB.e100:CB.s200}`, marginBottom:10, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", cursor:"pointer",
        background:isEnabled?CB.e50:CB.s100, borderBottom:`1px solid ${isEnabled?CB.e100:CB.s200}` }}
        onClick={()=>setOpen(p=>!p)}>
        <span style={{ fontSize:12, fontWeight:800, color:isEnabled?CB.e700:CB.s400 }}>
          {open?"▼":"▶"} شرط {index+1}
        </span>
        {condition._legacyConverted && (
          <span style={{ fontSize:9, background:CB.goldL, color:CB.gold, borderRadius:10, padding:"1px 6px", fontWeight:700 }}>قديم</span>
        )}
        <div style={{ flex:1 }}/>
        <label style={{ display:"flex",alignItems:"center",gap:4,fontSize:10,cursor:"pointer" }} onClick={e=>e.stopPropagation()}>
          <input type="checkbox" checked={isEnabled} onChange={e=>onChange({...condition,enabled:e.target.checked})} style={{width:12,height:12}}/>
          مفعّل
        </label>
        <CBtn sm variant="secondary" onClick={e=>{e.stopPropagation();onDuplicate();}}>📄</CBtn>
        <button onClick={e=>{e.stopPropagation();onDelete();}} style={{ background:"none",border:"none",color:CB.danger,cursor:"pointer",fontSize:14,padding:"0 4px" }}>🗑️</button>
      </div>

      {open && (
        <div style={{ padding:"12px" }}>
          {/* AND / OR toggle */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:CB.s700 }}>إذا</span>
            {["AND","OR"].map(op=>(
              <button key={op} onClick={()=>onChange({...condition,operator:op})} style={{
                padding:"4px 12px", borderRadius:20, fontSize:11, fontFamily:"inherit",
                border:`1.5px solid ${condition.operator===op?CB.e600:CB.s200}`,
                background:condition.operator===op?CB.e50:CB.white,
                color:condition.operator===op?CB.e700:CB.s500, cursor:"pointer", fontWeight:700,
              }}>{op==="AND"?"الكل (AND)":"أي (OR)"}</button>
            ))}
            <span style={{ fontSize:11, color:CB.s400 }}>من هذه القواعد تحقق:</span>
          </div>

          {/* Rules */}
          {condition.rules.map((rule,i)=>(
            <RuleRow key={rule.id} rule={rule} allQuestions={allQuestions} thisId={thisId}
              onChange={nr=>updRule(i,nr)}
              onDelete={()=>delRule(i)}
              canDelete={condition.rules.length>1}/>
          ))}
          <CBtn sm variant="secondary" onClick={addRule} style={{ marginBottom:12 }}>＋ قاعدة</CBtn>

          {/* Actions */}
          <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${CB.s100}` }}>
            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:CB.s700 }}>نفّذ:</p>
            {condition.actions.map((action,i)=>(
              <ActionRow key={action.id} action={action} allQuestions={allQuestions} thisId={thisId}
                onChange={na=>updAction(i,na)}
                onDelete={()=>delAction(i)}
                canDelete={condition.actions.length>1}/>
            ))}
            <CBtn sm variant="secondary" onClick={addAction}>＋ إجراء</CBtn>
          </div>

          {/* Priority */}
          <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:CB.s500 }}>الأولوية:</span>
            <input type="number" value={condition.priority||0}
              onChange={e=>onChange({...condition,priority:Number(e.target.value)})}
              style={{ ...iSt({width:60}) }} min={0} max={99}/>
            <span style={{ fontSize:10, color:CB.s400 }}>(أصغر رقم = أعلى أولوية)</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MAIN: ConditionBuilder
// ══════════════════════════════════════════════════════
export default function ConditionBuilder({ conditions, onChange, allQuestions, thisId }) {
  const [open, setOpen] = useState(false);

  function updCondition(idx, newCond) {
    const next = conditions.map((c,i)=>i===idx?newCond:c);
    onChange(next);
  }
  function delCondition(idx) {
    onChange(conditions.filter((_,i)=>i!==idx));
  }
  function dupCondition(idx) {
    const clone = JSON.parse(JSON.stringify(conditions[idx]));
    // New IDs
    clone.id = uid();
    clone.rules = clone.rules.map(r=>({...r,id:uid()}));
    clone.actions = clone.actions.map(a=>({...a,id:uid()}));
    clone._legacyConverted = false;
    const next = [...conditions];
    next.splice(idx+1,0,clone);
    onChange(next);
  }
  function addCondition() {
    onChange([...conditions, emptyCondition()]);
  }

  const hasConditions = conditions.length > 0;

  return (
    <div style={{ marginTop:8 }}>
      <button onClick={()=>setOpen(p=>!p)} style={{
        width:"100%", display:"flex", alignItems:"center", gap:8,
        background:hasConditions?CB.e50:CB.s50,
        border:`1.5px solid ${hasConditions?CB.e100:CB.s200}`,
        borderRadius:10, padding:"8px 12px", cursor:"pointer",
        fontFamily:"inherit",
      }}>
        <span style={{ fontSize:14 }}>🔀</span>
        <span style={{ fontSize:12, fontWeight:700, color:hasConditions?CB.e700:CB.s500, flex:1, textAlign:"right" }}>
          المنطق الشرطي
          {hasConditions && <span style={{ marginRight:6, background:CB.e600, color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:10 }}>{conditions.length}</span>}
        </span>
        <span style={{ color:CB.s400, fontSize:12 }}>{open?"▲":"▼"}</span>
      </button>

      {open && (
        <div style={{ background:CB.s50, border:`1px solid ${CB.s200}`, borderRadius:10, padding:12, marginTop:4 }}>
          {conditions.length===0 && (
            <p style={{ margin:"0 0 10px", fontSize:12, color:CB.s400, textAlign:"center" }}>
              لا توجد شروط — السؤال يظهر دائماً
            </p>
          )}

          {conditions.map((cond,i)=>(
            <ConditionCard
              key={cond.id}
              condition={cond}
              index={i}
              allQuestions={allQuestions}
              thisId={thisId}
              onChange={nc=>updCondition(i,nc)}
              onDelete={()=>delCondition(i)}
              onDuplicate={()=>dupCondition(i)}
            />
          ))}

          <CBtn onClick={addCondition} sm>＋ إضافة شرط</CBtn>
        </div>
      )}
    </div>
  );
}

