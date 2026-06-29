/**
 * LogicUtils.js
 * Shared utilities for the Condition Engine
 * Pure functions — no side effects — no Supabase
 */

// ── ID Generation ────────────────────────────────────
export function uid() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// ── Operators ────────────────────────────────────────
export const OPERATORS = [
  { v:"eq",          l:"يساوي",           sym:"=",   types:["text","number","select","rating"] },
  { v:"neq",         l:"لا يساوي",        sym:"≠",   types:["text","number","select","rating"] },
  { v:"gt",          l:"أكبر من",         sym:">",   types:["number","rating"] },
  { v:"lt",          l:"أصغر من",         sym:"<",   types:["number","rating"] },
  { v:"gte",         l:"أكبر من أو يساوي",sym:"≥",   types:["number","rating"] },
  { v:"lte",         l:"أصغر من أو يساوي",sym:"≤",  types:["number","rating"] },
  { v:"contains",    l:"يحتوي على",       sym:"∋",   types:["text","textarea"] },
  { v:"notContains", l:"لا يحتوي",        sym:"∌",   types:["text","textarea"] },
  { v:"startsWith",  l:"يبدأ بـ",         sym:"^",   types:["text","textarea"] },
  { v:"endsWith",    l:"ينتهي بـ",        sym:"$",   types:["text","textarea"] },
  { v:"isEmpty",     l:"فارغ",            sym:"∅",   types:["text","textarea","number","select","file"] },
  { v:"isNotEmpty",  l:"غير فارغ",        sym:"!∅",  types:["text","textarea","number","select","file"] },
  { v:"between",     l:"بين",             sym:"↔",   types:["number","rating"] },
];

export function getOperatorsForType(type) {
  return OPERATORS.filter(op => op.types.includes(type));
}

// ── Actions ──────────────────────────────────────────
export const ACTIONS = [
  { v:"show",        l:"إظهار السؤال",    icon:"👁️" },
  { v:"hide",        l:"إخفاء السؤال",   icon:"🚫" },
  { v:"require",     l:"جعله مطلوباً",    icon:"❗" },
  { v:"unrequire",   l:"جعله اختيارياً",  icon:"○" },
  { v:"jump",        l:"الانتقال إلى",    icon:"⤵️" },
  { v:"skip",        l:"تخطي السؤال",    icon:"⏭️" },
  { v:"endSurvey",   l:"إنهاء الاستبيان", icon:"🔚" },
  { v:"showMessage", l:"إظهار رسالة",     icon:"💬" },
  { v:"disable",     l:"تعطيل السؤال",   icon:"🔒" },
  { v:"enable",      l:"تفعيل السؤال",   icon:"🔓" },
];

// ── Empty builders ───────────────────────────────────
export function emptyRule(questionType = "text") {
  return {
    id:       uid(),
    sourceId: "",     // question id to check
    operator: "eq",
    value:    "",
    value2:   "",     // for "between"
  };
}

export function emptyCondition() {
  return {
    id:       uid(),
    enabled:  true,
    priority: 0,
    operator: "AND",  // AND | OR
    rules:    [emptyRule()],
    actions:  [{ id:uid(), type:"hide", targetId:"", message:"" }],
  };
}

export function emptyGroup(label = "") {
  return {
    id:       uid(),
    type:     "group",
    label:    label || "مجموعة جديدة",
    collapsed: false,
    questions: [],
  };
}

export function emptyQuestion(type = "text") {
  return {
    id:              uid(),
    type,
    label:           "",
    description:     "",
    required:        false,
    options:         [],
    allowedFileTypes: "pdf,xlsx",
    conditions:      [],   // NEW: per-question conditions
  };
}

// ── Deep clone ───────────────────────────────────────
export function cloneWithNewIds(obj) {
  const str = JSON.stringify(obj);
  const clone = JSON.parse(str);
  // Re-assign IDs recursively
  function assignNewIds(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(assignNewIds); return; }
    if (node.id) node.id = uid();
    Object.values(node).forEach(assignNewIds);
  }
  assignNewIds(clone);
  return clone;
}

// ── Flatten all questions (from mixed flat+group structure) ──
export function flattenItems(items) {
  const out = [];
  for (const item of items) {
    if (item.type === "group") {
      for (const q of (item.questions || [])) out.push(q);
    } else {
      out.push(item);
    }
  }
  return out;
}

// ── Circular reference detection ──────────────────────
export function detectCircular(items) {
  const flat = flattenItems(items);
  const qMap = Object.fromEntries(flat.map(q => [q.id, q]));
  const errors = [];

  for (const q of flat) {
    for (const cond of (q.conditions || [])) {
      for (const action of (cond.actions || [])) {
        if (action.type === "jump" && action.targetId === q.id) {
          errors.push(`سؤال "${q.label}" يُحيل إلى نفسه`);
        }
        // Simple cycle: A→B→A
        if (action.type === "jump" && action.targetId) {
          const target = qMap[action.targetId];
          if (target) {
            for (const tc of (target.conditions || [])) {
              for (const ta of (tc.actions || [])) {
                if (ta.type === "jump" && ta.targetId === q.id) {
                  errors.push(`دورة: "${q.label}" ↔ "${target.label}"`);
                }
              }
            }
          }
        }
      }
    }
  }
  return errors;
}

// ── Question type helpers ─────────────────────────────
export const Q_TYPES = [
  { v:"text",     l:"نص قصير",              icon:"✏️" },
  { v:"textarea", l:"نص طويل",              icon:"📝" },
  { v:"number",   l:"رقم / إحصائية",        icon:"🔢" },
  { v:"select",   l:"اختيار من قائمة",      icon:"☑️" },
  { v:"rating",   l:"تقييم بالنجوم",        icon:"⭐" },
  { v:"file",     l:"رفع ملف (PDF/Excel)",  icon:"📎" },
];

export function qTypeLabel(type) {
  return Q_TYPES.find(t => t.v === type)?.l || type;
}
export function qTypeIcon(type) {
  return Q_TYPES.find(t => t.v === type)?.icon || "❓";
}

