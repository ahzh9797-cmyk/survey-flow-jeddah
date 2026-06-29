/**
 * QuestionGroup.jsx
 * A collapsible group of questions in the Survey Builder.
 * Supports: collapse, expand, move, duplicate, delete.
 */

import { useState } from "react";

const G = {
  e700:"#047857",e600:"#059669",e50:"#ECFDF5",e100:"#D1FAE5",
  s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
  s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",white:"#FFFFFF",
  danger:"#DC2626",dangerBg:"#FEF2F2",gold:"#C9A84C",
};

export default function QuestionGroup({
  group,
  groupIdx,
  totalGroups,
  children,         // rendered question cards
  onUpdateLabel,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  dragHandleProps,
  isDragging,
  isDragOver,
}) {
  const [collapsed, setCollapsed] = useState(group.collapsed || false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(group.label || "مجموعة");

  function commitLabel() {
    setEditingLabel(false);
    if (label.trim()) onUpdateLabel(label.trim());
  }

  return (
    <div
      style={{
        border: `2px solid ${G.e100}`,
        borderRadius: 18,
        marginBottom: 14,
        background: G.e50,
        opacity: isDragging ? 0.5 : 1,
        boxShadow: isDragOver ? `0 0 0 3px ${G.e600}40` : "none",
        transition: "box-shadow 0.15s",
      }}
      draggable
      {...dragHandleProps}
    >
      {/* Group header */}
      <div style={{
        display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
        background:`${G.e100}70`, borderRadius:"16px 16px 0 0",
        borderBottom:`1px solid ${G.e100}`,
      }}>
        {/* Drag handle */}
        <span title="سحب" style={{ cursor:"grab", color:G.s400, fontSize:16, flexShrink:0 }}>⠿</span>

        {/* Label */}
        {editingLabel ? (
          <input
            autoFocus
            value={label}
            onChange={e=>setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e=>{ if(e.key==="Enter")commitLabel(); }}
            style={{ flex:1, padding:"4px 8px", border:`1.5px solid ${G.e600}`, borderRadius:8,
              fontSize:13, fontFamily:"inherit", direction:"rtl", outline:"none", fontWeight:700 }}
          />
        ) : (
          <span
            onDoubleClick={()=>setEditingLabel(true)}
            title="انقر مرتين للتعديل"
            style={{ flex:1, fontSize:13, fontWeight:800, color:G.e700, cursor:"text" }}>
            📂 {group.label || "مجموعة"}
          </span>
        )}

        {/* Count */}
        <span style={{ fontSize:10, color:G.s400 }}>
          {(group.questions||[]).length} سؤال
        </span>

        {/* Controls */}
        <button onClick={()=>setCollapsed(p=>!p)} title={collapsed?"توسيع":"طي"}
          style={{ background:"none",border:"none",color:G.e700,cursor:"pointer",fontSize:14,padding:"2px 4px" }}>
          {collapsed?"🔽":"🔼"}
        </button>
        <button onClick={()=>setEditingLabel(true)} title="تعديل الاسم"
          style={{ background:"none",border:"none",color:G.s500,cursor:"pointer",fontSize:13,padding:"2px 4px" }}>✏️</button>
        <button onClick={onMoveUp} disabled={groupIdx===0} title="تحريك لأعلى"
          style={{ background:"none",border:"none",color:groupIdx===0?G.s200:G.s500,cursor:groupIdx===0?"not-allowed":"pointer",fontSize:13,padding:"2px" }}>⬆️</button>
        <button onClick={onMoveDown} disabled={groupIdx>=totalGroups-1} title="تحريك لأسفل"
          style={{ background:"none",border:"none",color:groupIdx>=totalGroups-1?G.s200:G.s500,cursor:groupIdx>=totalGroups-1?"not-allowed":"pointer",fontSize:13,padding:"2px" }}>⬇️</button>
        <button onClick={onDuplicate} title="تكرار المجموعة"
          style={{ background:"none",border:"none",color:G.s500,cursor:"pointer",fontSize:13,padding:"2px" }}>📄</button>
        <button onClick={onDelete} title="حذف المجموعة"
          style={{ background:"none",border:"none",color:G.danger,cursor:"pointer",fontSize:13,padding:"2px" }}>🗑️</button>
      </div>

      {/* Questions inside group */}
      {!collapsed && (
        <div style={{ padding:"10px 12px 4px" }}>
          {children}
          {(!group.questions || group.questions.length === 0) && (
            <div style={{ textAlign:"center", padding:"20px 0", color:G.s400, fontSize:12 }}>
              المجموعة فارغة — اسحب أسئلة إلى هنا
            </div>
          )}
        </div>
      )}

      {collapsed && (
        <div style={{ padding:"8px 14px", fontSize:12, color:G.s500 }}>
          {(group.questions||[]).slice(0,3).map(q=>(
            <span key={q.id} style={{ marginLeft:8 }}>• {q.label?.slice(0,20)||"سؤال"}</span>
          ))}
          {(group.questions||[]).length > 3 && <span style={{ color:G.s400 }}>... و{(group.questions||[]).length-3} آخرين</span>}
        </div>
      )}
    </div>
  );
}
