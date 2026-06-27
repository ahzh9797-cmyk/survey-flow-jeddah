/**
 * SurveyLifecycleService — خدمة دورة حياة الاستبيانات
 *
 * نقطة الدخول الوحيدة لتغيير حالة الاستبيانات.
 * تُدمج مع AuditService و NotificationService.
 */

import { supabase } from "./lib.jsx";
import { audit } from "./AuditService.js";
import { notify } from "./NotificationService.js";
import { deepClone } from "./utils.js";
import { genId } from "./utils.js";

// ═══════════════════════════════════════════════════════
// حالات دورة الحياة
// ═══════════════════════════════════════════════════════
export const SURVEY_LIFECYCLE_STATES = {
  DRAFT:     "draft",
  PUBLISHED: "published",
  PAUSED:    "paused",
  CLOSED:    "closed",
  ARCHIVED:  "archived",
};

export const LIFECYCLE_STATE_CONFIG = {
  draft:     { label: "📝 مسودة",        color: "#718096", bg: "#EDF2F7",  next: ["published"] },
  published: { label: "✅ منشور",         color: "#276749", bg: "#E6F4EE",  next: ["paused", "closed", "archived"] },
  paused:    { label: "⏸️ موقوف مؤقتاً", color: "#B7791F", bg: "#FFFBEB",  next: ["published", "closed", "archived"] },
  closed:    { label: "🔒 مغلق",          color: "#C53030", bg: "#FFF5F5",  next: ["archived"] },
  archived:  { label: "📦 مؤرشف",         color: "#718096", bg: "#EDF2F7",  next: [] },
};

/**
 * الحالة الفعلية للاستبيان — تُعامل NULL كـ published (توافق مع القديم)
 */
export function resolveState(survey) {
  return survey?.survey_status || SURVEY_LIFECYCLE_STATES.PUBLISHED;
}

/**
 * هل يمكن الانتقال من حالة إلى أخرى؟
 */
export function canTransition(currentState, targetState) {
  const resolved = currentState || SURVEY_LIFECYCLE_STATES.PUBLISHED;
  return LIFECYCLE_STATE_CONFIG[resolved]?.next?.includes(targetState) ?? false;
}

/**
 * الأفعال المتاحة للمسؤول بناءً على الحالة الحالية
 */
export function getAvailableActions(survey, isAdmin) {
  if (!isAdmin) return [];
  const state = resolveState(survey);
  const actions = [];

  if (state === "draft")     actions.push("publish");
  if (state === "published") actions.push("pause", "close", "archive", "duplicate");
  if (state === "paused")    actions.push("resume", "close", "archive", "duplicate");
  if (state === "closed")    actions.push("archive", "duplicate");
  if (state === "draft" || state === "published" || state === "paused") actions.push("duplicate");

  return actions;
}

// ═══════════════════════════════════════════════════════
// دوال الانتقال
// ═══════════════════════════════════════════════════════

async function transitionState(surveyId, newState, timestampField, user, auditFn) {
  const now = new Date().toISOString();
  const update = { survey_status: newState };
  if (timestampField) update[timestampField] = now;

  const { error } = await supabase.from("surveys").update(update).eq("id", surveyId);
  if (error) throw new Error(error.message);

  // جلب عنوان الاستبيان للتدقيق
  const { data } = await supabase.from("surveys").select("title").eq("id", surveyId).single();
  await auditFn(user, surveyId, data?.title || surveyId);

  return { success: true, newState };
}

/**
 * نشر استبيان (draft → published)
 */
export async function publishSurvey(survey, user) {
  const state = resolveState(survey);
  if (!canTransition(state, "published")) {
    throw new Error(`لا يمكن نشر استبيان بحالة: ${state}`);
  }

  const result = await transitionState(
    survey.id, "published", "published_at", user, audit.surveyPublish
  );

  // تحديث approval_status أيضاً للتوافق مع النظام القديم
  await supabase.from("surveys")
    .update({ approval_status: "approved" })
    .eq("id", survey.id);

  notify.success(`تم نشر "${survey.title}" بنجاح`);
  return result;
}

/**
 * إيقاف مؤقت (published → paused)
 */
export async function pauseSurvey(survey, user) {
  const state = resolveState(survey);
  if (!canTransition(state, "paused")) {
    throw new Error(`لا يمكن إيقاف استبيان بحالة: ${state}`);
  }

  const result = await transitionState(
    survey.id, "paused", "paused_at", user, audit.surveyPause
  );

  notify.warning(`تم إيقاف "${survey.title}" مؤقتاً`);
  return result;
}

/**
 * استئناف (paused → published)
 */
export async function resumeSurvey(survey, user) {
  const state = resolveState(survey);
  if (!canTransition(state, "published")) {
    throw new Error(`لا يمكن استئناف استبيان بحالة: ${state}`);
  }

  const result = await transitionState(
    survey.id, "published", null, user, audit.surveyResume
  );

  notify.success(`تم استئناف "${survey.title}"`);
  return result;
}

/**
 * إغلاق (published/paused → closed)
 */
export async function closeSurvey(survey, user) {
  const state = resolveState(survey);
  if (!canTransition(state, "closed")) {
    throw new Error(`لا يمكن إغلاق استبيان بحالة: ${state}`);
  }

  const result = await transitionState(
    survey.id, "closed", "closed_at", user, audit.surveyClose
  );

  notify.info(`تم إغلاق "${survey.title}"`);
  return result;
}

/**
 * أرشفة — لا حذف نهائي أبداً
 */
export async function archiveSurvey(survey, user) {
  const state = resolveState(survey);
  if (!canTransition(state, "archived")) {
    throw new Error(`لا يمكن أرشفة استبيان بحالة: ${state}`);
  }

  const result = await transitionState(
    survey.id, "archived", "archived_at", user, audit.surveyArchive
  );

  notify.info(`تمت أرشفة "${survey.title}"`);
  return result;
}

/**
 * نسخ استبيان — ينشئ مسودة جديدة
 */
export async function duplicateSurvey(survey, user) {
  // 1. جلب الأسئلة الكاملة
  const { data: questions, error: qErr } = await supabase
    .from("survey_questions")
    .select("*")
    .eq("survey_id", survey.id)
    .order("order_index");

  if (qErr) throw new Error(qErr.message);

  // 2. إنشاء نسخة من الاستبيان كمسودة
  const { data: newSurvey, error: sErr } = await supabase
    .from("surveys")
    .insert({
      title:           `نسخة من: ${survey.title}`,
      description:     survey.description,
      survey_type:     survey.survey_type,
      survey_status:   SURVEY_LIFECYCLE_STATES.DRAFT,
      approval_status: "draft",
      response_limit:  survey.response_limit,
      created_by:      user?.id,
      duplicate_of:    survey.id,
      status:          "active",
    })
    .select()
    .single();

  if (sErr) throw new Error(sErr.message);

  // 3. نسخ الأسئلة
  if (questions?.length) {
    const newQuestions = questions.map(q => ({
      survey_id:         newSurvey.id,
      label:             q.label,
      type:              q.type,
      required:          q.required,
      options:           deepClone(q.options || []),
      order_index:       q.order_index,
      allowed_file_types: q.allowed_file_types,
    }));

    const { error: nqErr } = await supabase.from("survey_questions").insert(newQuestions);
    if (nqErr) throw new Error(nqErr.message);
  }

  await audit.surveyDuplicate(user, newSurvey.id, survey.title);
  notify.success(`تم نسخ "${survey.title}" — المسودة جاهزة للتعديل`);

  return { success: true, newSurveyId: newSurvey.id };
}

