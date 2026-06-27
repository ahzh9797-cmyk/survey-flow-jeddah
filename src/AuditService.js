/**
 * AuditService — الخدمة المركزية لتسجيل أحداث التدقيق
 *
 * هذه الخدمة هي نقطة الدخول الوحيدة لكتابة أحداث التدقيق.
 * لا يجب على أي وحدة أخرى استدعاء logAction() مباشرة.
 */

import { logAction } from "./lib.jsx";

// ═══════════════════════════════════════════════════════
// أنواع الأحداث المدعومة
// ═══════════════════════════════════════════════════════
export const AUDIT_ACTIONS = {
  // دورة حياة الاستبيانات
  SURVEY_CREATE:    "survey_create",
  SURVEY_UPDATE:    "survey_update",
  SURVEY_PUBLISH:   "survey_publish",
  SURVEY_PAUSE:     "survey_pause",
  SURVEY_RESUME:    "survey_resume",
  SURVEY_CLOSE:     "survey_close",
  SURVEY_ARCHIVE:   "survey_archive",
  SURVEY_DUPLICATE: "survey_duplicate",
  SURVEY_DELETE:    "survey_delete",

  // القوالب
  TEMPLATE_CREATE:  "template_create",
  TEMPLATE_UPDATE:  "template_update",
  TEMPLATE_USE:     "template_use",

  // الدليل
  SCHOOL_CREATE:    "school_create",
  SCHOOL_UPDATE:    "school_update",
  SCHOOL_DELETE:    "school_delete",
  SCHOOL_IMPORT:    "school_import",

  SUPERVISOR_CREATE: "supervisor_create",
  SUPERVISOR_UPDATE: "supervisor_update",
  SUPERVISOR_DELETE: "supervisor_delete",
  SUPERVISOR_IMPORT: "supervisor_import",

  // المستخدمون
  USER_APPROVE:     "user_approve",
  USER_REJECT:      "user_reject",
  USER_ROLE_CHANGE: "user_role_change",

  // التصدير
  EXPORT_EXCEL:     "export_excel",
  EXPORT_PDF:       "export_pdf",
  EXPORT_CSV:       "export_csv",

  // الإعدادات
  SETTINGS_UPDATE:  "settings_update",
};

export const AUDIT_CATEGORIES = {
  SURVEY:    "survey",
  TEMPLATE:  "template",
  DIRECTORY: "directory",
  USER:      "user",
  EXPORT:    "export",
  SETTINGS:  "settings",
  SYSTEM:    "system",
};

// تسميات عربية للعرض
export const AUDIT_ACTION_LABELS = {
  [AUDIT_ACTIONS.SURVEY_CREATE]:    { label: "إنشاء استبيان",    icon: "➕", color: "#1A7A4A" },
  [AUDIT_ACTIONS.SURVEY_UPDATE]:    { label: "تعديل استبيان",    icon: "✏️", color: "#0B6E6E" },
  [AUDIT_ACTIONS.SURVEY_PUBLISH]:   { label: "نشر استبيان",      icon: "🚀", color: "#1A7A4A" },
  [AUDIT_ACTIONS.SURVEY_PAUSE]:     { label: "إيقاف مؤقت",       icon: "⏸️", color: "#E67E22" },
  [AUDIT_ACTIONS.SURVEY_RESUME]:    { label: "استئناف استبيان",  icon: "▶️", color: "#1A7A4A" },
  [AUDIT_ACTIONS.SURVEY_CLOSE]:     { label: "إغلاق استبيان",    icon: "🔒", color: "#C0392B" },
  [AUDIT_ACTIONS.SURVEY_ARCHIVE]:   { label: "أرشفة استبيان",    icon: "📦", color: "#6B8585" },
  [AUDIT_ACTIONS.SURVEY_DUPLICATE]: { label: "نسخ استبيان",      icon: "📄", color: "#0B6E6E" },
  [AUDIT_ACTIONS.SURVEY_DELETE]:    { label: "حذف استبيان",      icon: "🗑️", color: "#C0392B" },
  [AUDIT_ACTIONS.TEMPLATE_CREATE]:  { label: "إنشاء قالب",       icon: "➕", color: "#7B2D8B" },
  [AUDIT_ACTIONS.TEMPLATE_UPDATE]:  { label: "تعديل قالب",       icon: "✏️", color: "#7B2D8B" },
  [AUDIT_ACTIONS.TEMPLATE_USE]:     { label: "استخدام قالب",     icon: "🗂️", color: "#7B2D8B" },
  [AUDIT_ACTIONS.SCHOOL_CREATE]:    { label: "إضافة مدرسة",      icon: "🏫", color: "#1A7A4A" },
  [AUDIT_ACTIONS.SCHOOL_UPDATE]:    { label: "تعديل مدرسة",      icon: "✏️", color: "#0B6E6E" },
  [AUDIT_ACTIONS.SCHOOL_DELETE]:    { label: "حذف مدرسة",        icon: "🗑️", color: "#C0392B" },
  [AUDIT_ACTIONS.SCHOOL_IMPORT]:    { label: "استيراد مدارس",    icon: "📥", color: "#C49A28" },
  [AUDIT_ACTIONS.SUPERVISOR_CREATE]:{ label: "إضافة مشرف",       icon: "👤", color: "#1A7A4A" },
  [AUDIT_ACTIONS.SUPERVISOR_UPDATE]:{ label: "تعديل مشرف",       icon: "✏️", color: "#0B6E6E" },
  [AUDIT_ACTIONS.SUPERVISOR_DELETE]:{ label: "حذف مشرف",         icon: "🗑️", color: "#C0392B" },
  [AUDIT_ACTIONS.SUPERVISOR_IMPORT]:{ label: "استيراد مشرفين",   icon: "📥", color: "#C49A28" },
  [AUDIT_ACTIONS.USER_APPROVE]:     { label: "قبول مستخدم",      icon: "✅", color: "#1A7A4A" },
  [AUDIT_ACTIONS.USER_REJECT]:      { label: "رفض مستخدم",       icon: "❌", color: "#C0392B" },
  [AUDIT_ACTIONS.USER_ROLE_CHANGE]: { label: "تغيير صلاحية",     icon: "🔑", color: "#0B6E6E" },
  [AUDIT_ACTIONS.EXPORT_EXCEL]:     { label: "تصدير Excel",       icon: "📊", color: "#C49A28" },
  [AUDIT_ACTIONS.EXPORT_PDF]:       { label: "تصدير PDF",         icon: "📄", color: "#C49A28" },
  [AUDIT_ACTIONS.EXPORT_CSV]:       { label: "تصدير CSV",         icon: "📋", color: "#C49A28" },
  [AUDIT_ACTIONS.SETTINGS_UPDATE]:  { label: "تحديث الإعدادات",  icon: "⚙️", color: "#6B8585" },
};

// ═══════════════════════════════════════════════════════
// الخدمة الرئيسية
// ═══════════════════════════════════════════════════════

/**
 * تسجيل حدث تدقيق
 * @param {object} params
 * @param {object} params.user - المستخدم الحالي
 * @param {string} params.action - نوع الحدث من AUDIT_ACTIONS
 * @param {string} params.recordId - معرّف السجل المتأثر
 * @param {string} params.recordLabel - اسم/وصف السجل
 * @param {string} [params.category] - تصنيف الحدث
 * @param {object} [params.details] - تفاصيل إضافية
 */
export async function auditLog({ user, action, recordId, recordLabel, category, details }) {
  const actionMeta = AUDIT_ACTION_LABELS[action];
  const resolvedCategory = category || resolveCategory(action);

  await logAction({
    user,
    action,
    table: resolvedCategory,
    recordId,
    recordLabel,
    details: {
      ...details,
      category: resolvedCategory,
      action_label: actionMeta?.label || action,
    },
  });
}

function resolveCategory(action) {
  if (action.startsWith("survey_"))    return AUDIT_CATEGORIES.SURVEY;
  if (action.startsWith("template_"))  return AUDIT_CATEGORIES.TEMPLATE;
  if (action.startsWith("school_") || action.startsWith("supervisor_")) return AUDIT_CATEGORIES.DIRECTORY;
  if (action.startsWith("user_"))      return AUDIT_CATEGORIES.USER;
  if (action.startsWith("export_"))    return AUDIT_CATEGORIES.EXPORT;
  if (action.startsWith("settings_"))  return AUDIT_CATEGORIES.SETTINGS;
  return AUDIT_CATEGORIES.SYSTEM;
}

// ═══════════════════════════════════════════════════════
// دوال مختصرة للأحداث الشائعة
// ═══════════════════════════════════════════════════════

export const audit = {
  surveyCreate:    (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.SURVEY_CREATE,    recordId: id, recordLabel: title }),
  surveyUpdate:    (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.SURVEY_UPDATE,    recordId: id, recordLabel: title }),
  surveyPublish:   (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.SURVEY_PUBLISH,   recordId: id, recordLabel: title }),
  surveyPause:     (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.SURVEY_PAUSE,     recordId: id, recordLabel: title }),
  surveyResume:    (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.SURVEY_RESUME,    recordId: id, recordLabel: title }),
  surveyClose:     (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.SURVEY_CLOSE,     recordId: id, recordLabel: title }),
  surveyArchive:   (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.SURVEY_ARCHIVE,   recordId: id, recordLabel: title }),
  surveyDuplicate: (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.SURVEY_DUPLICATE, recordId: id, recordLabel: `نسخة: ${title}` }),
  templateCreate:  (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.TEMPLATE_CREATE,  recordId: id, recordLabel: title }),
  templateUpdate:  (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.TEMPLATE_UPDATE,  recordId: id, recordLabel: title }),
  templateUse:     (user, id, title)  => auditLog({ user, action: AUDIT_ACTIONS.TEMPLATE_USE,     recordId: id, recordLabel: title }),
  schoolCreate:    (user, id, name)   => auditLog({ user, action: AUDIT_ACTIONS.SCHOOL_CREATE,    recordId: id, recordLabel: name }),
  schoolUpdate:    (user, id, name)   => auditLog({ user, action: AUDIT_ACTIONS.SCHOOL_UPDATE,    recordId: id, recordLabel: name }),
  schoolDelete:    (user, id, name)   => auditLog({ user, action: AUDIT_ACTIONS.SCHOOL_DELETE,    recordId: id, recordLabel: name }),
  schoolImport:    (user, count)      => auditLog({ user, action: AUDIT_ACTIONS.SCHOOL_IMPORT,    recordLabel: `${count} مدرسة`, details: { count } }),
  supervisorCreate:(user, id, name)   => auditLog({ user, action: AUDIT_ACTIONS.SUPERVISOR_CREATE,recordId: id, recordLabel: name }),
  supervisorUpdate:(user, id, name)   => auditLog({ user, action: AUDIT_ACTIONS.SUPERVISOR_UPDATE,recordId: id, recordLabel: name }),
  supervisorDelete:(user, id, name)   => auditLog({ user, action: AUDIT_ACTIONS.SUPERVISOR_DELETE,recordId: id, recordLabel: name }),
  supervisorImport:(user, count)      => auditLog({ user, action: AUDIT_ACTIONS.SUPERVISOR_IMPORT,recordLabel: `${count} مشرف`, details: { count } }),
  userApprove:     (user, id, name)   => auditLog({ user, action: AUDIT_ACTIONS.USER_APPROVE,     recordId: id, recordLabel: name }),
  userReject:      (user, id, name)   => auditLog({ user, action: AUDIT_ACTIONS.USER_REJECT,      recordId: id, recordLabel: name }),
  userRoleChange:  (user, id, role)   => auditLog({ user, action: AUDIT_ACTIONS.USER_ROLE_CHANGE, recordId: id, recordLabel: role }),
  exportExcel:     (user, label)      => auditLog({ user, action: AUDIT_ACTIONS.EXPORT_EXCEL,     recordLabel: label }),
  exportPdf:       (user, label)      => auditLog({ user, action: AUDIT_ACTIONS.EXPORT_PDF,       recordLabel: label }),
  exportCsv:       (user, label)      => auditLog({ user, action: AUDIT_ACTIONS.EXPORT_CSV,       recordLabel: label }),
  settingsUpdate:  (user, key)        => auditLog({ user, action: AUDIT_ACTIONS.SETTINGS_UPDATE,  recordLabel: key }),
};

