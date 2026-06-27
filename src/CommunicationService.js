/**
 * CommunicationService — خدمة الاتصالات المركزية
 *
 * تدعم حالياً: WhatsApp (Green API)
 * مصممة للتوسع: Email، SMS، Push بدون تغيير الـ API
 */

import { supabase } from "./lib.jsx";
import { audit } from "./AuditService.js";
import { sendBulkReminder, NOTIFICATION_CHANNELS } from "./NotificationService.js";

// ═══════════════════════════════════════════════════════
// فئات القوالب
// ═══════════════════════════════════════════════════════
export const TEMPLATE_CATEGORIES = {
  REMINDER:          { id:"reminder",          label:"تذكير",              icon:"🔔" },
  FINAL_REMINDER:    { id:"final_reminder",     label:"تذكير أخير",         icon:"⚠️" },
  SURVEY_PUBLISHED:  { id:"survey_published",   label:"نشر استبيان",        icon:"🚀" },
  SURVEY_CLOSING:    { id:"survey_closing",     label:"استبيان ينتهي قريباً", icon:"⏰" },
  SURVEY_CLOSED:     { id:"survey_closed",      label:"إغلاق استبيان",      icon:"🔒" },
  CUSTOM:            { id:"custom",             label:"مخصص",               icon:"✏️" },
};

// ═══════════════════════════════════════════════════════
// متغيرات القوالب
// ═══════════════════════════════════════════════════════
export const TEMPLATE_VARIABLES = [
  { key:"{{survey_title}}",       label:"عنوان الاستبيان" },
  { key:"{{survey_link}}",        label:"رابط الاستبيان" },
  { key:"{{survey_description}}", label:"وصف الاستبيان" },
  { key:"{{expiry_date}}",        label:"تاريخ الانتهاء" },
  { key:"{{expiry_text}}",        label:"نص تاريخ الانتهاء" },
  { key:"{{recipient_name}}",     label:"اسم المستلم" },
  { key:"{{organization_name}}",  label:"اسم المنظمة" },
];

// ═══════════════════════════════════════════════════════
// استبدال المتغيرات في نص القالب
// ═══════════════════════════════════════════════════════
export function resolveTemplate(body, variables = {}) {
  let resolved = body;
  for (const [key, value] of Object.entries(variables)) {
    resolved = resolved.replaceAll(`{{${key}}}`, value || "");
  }
  // حذف المتغيرات غير المستبدلة
  resolved = resolved.replace(/\{\{[^}]+\}\}/g, "");
  return resolved.trim();
}

export function buildTemplateVariables(survey, recipientName = "", orgName = "إدارة التعليم — جدة") {
  const link = `${window.location.origin}?survey=${survey.id}`;
  const endDate = survey.end_date || survey.expires_at;
  const expiryDate = endDate ? new Date(endDate).toLocaleDateString("ar-SA") : "";
  const expiryText = endDate ? `⏰ آخر موعد: ${expiryDate}` : "";

  return {
    survey_title:       survey.title || "",
    survey_link:        link,
    survey_description: survey.description || "",
    expiry_date:        expiryDate,
    expiry_text:        expiryText,
    recipient_name:     recipientName,
    organization_name:  orgName,
  };
}

// ═══════════════════════════════════════════════════════
// CRUD — قوالب الرسائل
// ═══════════════════════════════════════════════════════
export async function fetchTemplates() {
  const { data, error } = await supabase
    .from("communication_templates")
    .select("*")
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function createTemplate(template, user) {
  const { data, error } = await supabase
    .from("communication_templates")
    .insert({ ...template, created_by: user?.id })
    .select()
    .single();
  if (!error && data) {
    await audit.auditLog?.({ user, action:"template_create", recordId:data.id, recordLabel:data.title })
      .catch(() => {});
  }
  return { data, error };
}

export async function updateTemplate(id, updates, user) {
  const { data, error } = await supabase
    .from("communication_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

export async function archiveTemplate(id, user) {
  const { data, error } = await supabase
    .from("communication_templates")
    .update({ status: "archived" })
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

export async function duplicateTemplate(template, user) {
  const { id, created_at, updated_at, ...rest } = template;
  return createTemplate({ ...rest, title: `نسخة من: ${template.title}` }, user);
}

// ═══════════════════════════════════════════════════════
// إرسال الرسائل
// ═══════════════════════════════════════════════════════

/**
 * إرسال رسائل لمجموعة مستلمين
 * @param {object} params
 * @param {object} params.survey - بيانات الاستبيان
 * @param {Array}  params.recipients - [{name, phone, email?, id}]
 * @param {string} params.messageBody - نص الرسالة بعد استبدال المتغيرات
 * @param {string} params.channel - قناة الإرسال
 * @param {object} params.user - المستخدم المرسل
 * @param {string} [params.templateId] - معرّف القالب المستخدم
 * @param {string} [params.orgName] - اسم المنظمة للـ branding
 */
export async function sendCommunication({
  survey,
  recipients,
  messageBody,
  channel = NOTIFICATION_CHANNELS.WHATSAPP,
  user,
  templateId = null,
  orgName = "إدارة التعليم — جدة",
}) {
  if (!recipients?.length) return { success: false, error: "لا يوجد مستلمون" };

  // إرسال الرسائل
  const results = await sendBulkReminder({
    targets: recipients,
    message: messageBody,
    channels: [channel],
    delayMs: 500,
  });

  // تسجيل في سجل الاتصالات
  const status = results.sent === 0 ? "failed"
    : results.failed > 0 ? "partial"
    : "sent";

  const { error: logErr } = await supabase.from("communication_log").insert({
    survey_id:       survey?.id || null,
    template_id:     templateId,
    sent_by:         user?.id || null,
    sent_by_email:   user?.email || null,
    recipient_count: recipients.length,
    target_type:     survey?.survey_type || null,
    delivery_method: channel,
    status,
    message_body:    messageBody,
    details:         { sent:results.sent, failed:results.failed, skipped:results.skipped },
  });

  // تسجيل في audit
  await audit.auditLog?.({
    user,
    action: "communication_send",
    recordId: survey?.id,
    recordLabel: `إرسال لـ ${recipients.length} مستلم — ${survey?.title || ""}`,
    details: { channel, sent:results.sent, failed:results.failed },
  }).catch(() => {});

  return { ...results, status, logError: logErr };
}

// ═══════════════════════════════════════════════════════
// سجل الاتصالات
// ═══════════════════════════════════════════════════════
export async function fetchCommunicationLog({ surveyId, limit = 100, from = 0 } = {}) {
  let query = supabase
    .from("communication_log")
    .select("*, surveys(title), communication_templates(title)")
    .order("sent_at", { ascending: false })
    .range(from, from + limit - 1);

  if (surveyId) query = query.eq("survey_id", surveyId);

  const { data, error, count } = await query;
  return { data: data || [], error, count };
}

// ═══════════════════════════════════════════════════════
// جلب المستلمين غير المستجيبين
// ═══════════════════════════════════════════════════════
export async function fetchNonRespondents(survey, allSchools) {
  if (survey.survey_type !== "school") return [];

  const { data: responses } = await supabase
    .from("survey_responses")
    .select("school_id")
    .eq("survey_id", survey.id);

  const respondedIds = new Set((responses || []).map(r => r.school_id));
  return allSchools.filter(s => !respondedIds.has(s.id) && s.phone);
}

