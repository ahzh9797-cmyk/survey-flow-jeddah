/**
 * ConditionEngine.js
 * Evaluates per-question conditions against live answers.
 * Pure functions — memoization-friendly — no React imports.
 *
 * Usage:
 *   const state = evaluateSurvey(questions, answers);
 *   // state.visible   = Set<questionId>   — visible questions
 *   // state.required  = Set<questionId>   — required questions
 *   // state.disabled  = Set<questionId>   — disabled questions
 *   // state.endAt     = questionId | null — stop rendering after this
 *   // state.messages  = Map<questionId, string>
 */

// ── Single rule evaluator ─────────────────────────────
function evalRule(rule, answers) {
  const { sourceId, operator, value, value2 } = rule;
  const raw = answers[sourceId];
  const ans = raw === undefined || raw === null ? "" : String(raw).trim();
  const val = String(value || "").trim();

  switch (operator) {
    case "eq":          return ans === val;
    case "neq":         return ans !== val;
    case "gt":          return Number(ans) > Number(val);
    case "lt":          return Number(ans) < Number(val);
    case "gte":         return Number(ans) >= Number(val);
    case "lte":         return Number(ans) <= Number(val);
    case "contains":    return ans.includes(val);
    case "notContains": return !ans.includes(val);
    case "startsWith":  return ans.startsWith(val);
    case "endsWith":    return ans.endsWith(val);
    case "isEmpty":     return !ans;
    case "isNotEmpty":  return !!ans;
    case "between": {
      const n = Number(ans), lo = Number(val), hi = Number(value2 || val);
      return n >= lo && n <= hi;
    }
    default: return false;
  }
}

// ── Condition evaluator (AND / OR across rules) ───────
function evalCondition(condition, answers) {
  if (!condition.enabled) return false;
  const rules = condition.rules || [];
  if (!rules.length) return false;

  if (condition.operator === "OR") {
    return rules.some(r => evalRule(r, answers));
  }
  // Default: AND
  return rules.every(r => evalRule(r, answers));
}

// ── Action applicator ─────────────────────────────────
function applyAction(action, qId, state) {
  switch (action.type) {
    case "hide":
      state.visible.delete(qId);
      break;
    case "show":
      state.visible.add(qId);
      break;
    case "require":
      state.required.add(qId);
      break;
    case "unrequire":
      state.required.delete(qId);
      break;
    case "disable":
      state.disabled.add(qId);
      break;
    case "enable":
      state.disabled.delete(qId);
      break;
    case "endSurvey":
      // endAt = this question's id (stop after showing this one)
      if (!state.endAt) state.endAt = qId;
      break;
    case "showMessage":
      state.messages.set(qId, action.message || "");
      break;
    case "jump":
      state.jumps.set(qId, action.targetId);
      break;
    case "skip":
      state.visible.delete(action.targetId || qId);
      break;
    default:
      break;
  }
}

/**
 * evaluateSurvey
 *
 * @param {Array}  flatQuestions — flat array of question objects (no groups)
 * @param {Object} answers       — { [questionId]: value }
 * @returns {Object} evaluation state
 */
export function evaluateSurvey(flatQuestions, answers = {}) {
  // Initial state: all questions visible + required per their own flag
  const state = {
    visible:  new Set(flatQuestions.map(q => q.id)),
    required: new Set(flatQuestions.filter(q => q.required).map(q => q.id)),
    disabled: new Set(),
    endAt:    null,
    messages: new Map(),
    jumps:    new Map(),
  };

  // Evaluate in display order (priority within each question)
  for (const q of flatQuestions) {
    const conditions = [...(q.conditions || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    for (const cond of conditions) {
      if (evalCondition(cond, answers)) {
        for (const action of (cond.actions || [])) {
          applyAction(action, q.id, state);
        }
      }
    }
  }

  return state;
}

/**
 * getVisibleQuestions
 * Returns questions in order, stopping at endAt if set.
 */
export function getVisibleQuestions(flatQuestions, evalState) {
  const result = [];
  for (const q of flatQuestions) {
    if (!evalState.visible.has(q.id)) continue;
    result.push(q);
    if (evalState.endAt === q.id) break;
  }
  return result;
}

/**
 * validateAnswer
 * Returns error string or null.
 */
export function validateAnswer(q, value, evalState) {
  if (!evalState.visible.has(q.id)) return null;       // hidden = no validation
  if (evalState.disabled.has(q.id)) return null;       // disabled = no validation
  if (evalState.required.has(q.id) && !value) {
    return "هذا الحقل مطلوب";
  }
  return null;
}

/**
 * validateAllAnswers
 * Returns { [questionId]: errorString }
 */
export function validateAllAnswers(flatQuestions, answers, evalState) {
  const errs = {};
  for (const q of flatQuestions) {
    const err = validateAnswer(q, answers[q.id], evalState);
    if (err) errs[q.id] = err;
  }
  return errs;
}

