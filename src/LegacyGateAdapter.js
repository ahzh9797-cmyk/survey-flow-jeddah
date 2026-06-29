/**
 * LegacyGateAdapter.js
 * Converts old survey-level gate_question_id/gate_required_value
 * into the new per-question conditions architecture.
 *
 * Runs client-side — zero DB writes — fully transparent.
 */

import { uid } from "./LogicUtils.js";

/**
 * adaptSurvey
 * Given a survey object (with gate_question_id + questions array),
 * returns a new questions array where the gate question carries
 * a per-question condition equivalent to the old behaviour.
 *
 * Old behaviour:
 *   If gate_question answer ≠ gate_required_value → end survey
 *
 * New behaviour:
 *   gate_question.conditions = [{
 *     operator: "AND",
 *     rules: [{ sourceId: gateId, operator: "neq", value: requiredValue }],
 *     actions: [{ type: "endSurvey" }]
 *   }]
 *
 * All other questions remain unchanged.
 */
export function adaptLegacySurvey(survey, questions) {
  if (!survey?.gate_question_id || !survey?.gate_required_value) {
    return questions; // Nothing to adapt
  }

  const gateId    = survey.gate_question_id;
  const gateValue = survey.gate_required_value;

  return questions.map(q => {
    if (q.id !== gateId) return q;

    // Already has conditions? Don't double-add
    if ((q.conditions || []).length > 0) return q;

    const legacyCondition = {
      id:       uid(),
      enabled:  true,
      priority: 0,
      operator: "AND",
      _legacyConverted: true,
      rules: [{
        id:       uid(),
        sourceId: gateId,
        operator: "neq",
        value:    gateValue,
        value2:   "",
      }],
      actions: [{
        id:      uid(),
        type:    "endSurvey",
        targetId: "",
        message: "",
      }],
    };

    return { ...q, conditions: [legacyCondition] };
  });
}

/**
 * isLegacySurvey
 * Returns true if the survey still uses the old gate architecture
 */
export function isLegacySurvey(survey) {
  return !!(survey?.gate_question_id && survey?.gate_required_value);
}

/**
 * stripLegacyGate
 * Returns updated survey payload with gate fields nulled out.
 * Called at save time when the user explicitly edits the survey
 * (so the new per-question conditions replace the old fields).
 */
export function stripLegacyGate(surveyPayload) {
  return {
    ...surveyPayload,
    gate_question_id:    null,
    gate_required_value: null,
  };
}

