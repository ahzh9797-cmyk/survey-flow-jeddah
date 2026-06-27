/**
 * NotificationService — خدمة الإشعارات المركزية
 *
 * تصميم قائم على الأحداث (event consumer).
 * جميع الإشعارات — Toast، تنبيهات Dashboard، تذكيرات — تمر من هنا.
 * مصمم للتوسع: SMS وEmail يُضافان لاحقاً دون تغيير الـ API.
 */

// ═══════════════════════════════════════════════════════
// أنواع الإشعارات
// ═══════════════════════════════════════════════════════
export const NOTIFICATION_TYPES = {
  SUCCESS: "success",
  ERROR:   "error",
  WARNING: "warning",
  INFO:    "info",
};

export const NOTIFICATION_CHANNELS = {
  TOAST:    "toast",    // إشعار داخل التطبيق (متاح الآن)
  WHATSAPP: "whatsapp", // واتساب (متاح عبر Green API)
  EMAIL:    "email",    // بريد إلكتروني (placeholder)
  SMS:      "sms",      // رسالة نصية (placeholder)
};

// ═══════════════════════════════════════════════════════
// مستمعو الأحداث (Event Listeners)
// ═══════════════════════════════════════════════════════
const listeners = new Map();

/**
 * الاشتراك في حدث إشعار
 * @param {string} channel - قناة الإشعار
 * @param {function} handler - الدالة المنفذة عند وصول الإشعار
 * @returns {function} دالة لإلغاء الاشتراك
 */
export function subscribe(channel, handler) {
  if (!listeners.has(channel)) listeners.set(channel, new Set());
  listeners.get(channel).add(handler);
  return () => listeners.get(channel)?.delete(handler);
}

/**
 * نشر إشعار على قناة معينة
 */
function emit(channel, notification) {
  listeners.get(channel)?.forEach(h => {
    try { h(notification); } catch (e) { console.error("NotificationService emit error:", e); }
  });
}

// ═══════════════════════════════════════════════════════
// واجهة الإشعارات الرئيسية
// ═══════════════════════════════════════════════════════

/**
 * إرسال إشعار Toast داخل التطبيق
 * @param {string} message - نص الإشعار
 * @param {string} type - نوع الإشعار (success/error/warning/info)
 * @param {number} [duration=3000] - مدة العرض بالميلي ثانية
 */
export function showToast(message, type = NOTIFICATION_TYPES.INFO, duration = 3000) {
  const notification = {
    id: `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    message,
    type,
    duration,
    timestamp: new Date().toISOString(),
  };
  emit(NOTIFICATION_CHANNELS.TOAST, notification);
  return notification.id;
}

// دوال مختصرة
export const notify = {
  success: (msg, duration) => showToast(msg, NOTIFICATION_TYPES.SUCCESS, duration),
  error:   (msg, duration) => showToast(msg, NOTIFICATION_TYPES.ERROR,   duration || 5000),
  warning: (msg, duration) => showToast(msg, NOTIFICATION_TYPES.WARNING, duration),
  info:    (msg, duration) => showToast(msg, NOTIFICATION_TYPES.INFO,    duration),
};

/**
 * إرسال تذكير واتساب (يستخدم Green API الموجود)
 * @param {string} phone - رقم الجوال
 * @param {string} message - نص الرسالة
 * @param {object} [options] - خيارات إضافية
 */
export async function sendWhatsAppReminder(phone, message, options = {}) {
  const GREEN_API_INSTANCE = "7107658040";
  const GREEN_API_TOKEN    = "5057056a62c9475db20433c433349df534e9ee32ba0b47c0a0";

  const cleanPhone = phone.replace(/\D/g, "").replace(/^0/, "966").replace(/^(?!966)/, "966");
  const url = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}/sendMessage/${GREEN_API_TOKEN}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: `${cleanPhone}@c.us`, message }),
    });
    const success = res.ok;
    emit(NOTIFICATION_CHANNELS.WHATSAPP, { phone: cleanPhone, success, timestamp: new Date().toISOString() });
    return { success, phone: cleanPhone };
  } catch (error) {
    emit(NOTIFICATION_CHANNELS.WHATSAPP, { phone: cleanPhone, success: false, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * إرسال بريد إلكتروني (Placeholder — للتطوير المستقبلي)
 */
export async function sendEmailReminder(email, subject, body) {
  console.warn("NotificationService: Email channel not yet configured.");
  emit(NOTIFICATION_CHANNELS.EMAIL, { email, subject, status: "not_configured" });
  return { success: false, reason: "not_configured" };
}

/**
 * إرسال رسالة نصية (Placeholder — للتطوير المستقبلي)
 */
export async function sendSmsReminder(phone, message) {
  console.warn("NotificationService: SMS channel not yet configured.");
  emit(NOTIFICATION_CHANNELS.SMS, { phone, status: "not_configured" });
  return { success: false, reason: "not_configured" };
}

// ═══════════════════════════════════════════════════════
// خدمة التذكيرات
// ═══════════════════════════════════════════════════════

/**
 * إرسال تذكير لمجموعة من الكيانات
 * @param {object} params
 * @param {Array} params.targets - قائمة المستهدفين [{phone, name, ...}]
 * @param {string} params.message - نص الرسالة
 * @param {string[]} params.channels - القنوات المطلوبة
 * @param {number} [params.delayMs=500] - تأخير بين الرسائل
 * @returns {object} نتيجة الإرسال
 */
export async function sendBulkReminder({ targets, message, channels = [NOTIFICATION_CHANNELS.WHATSAPP], delayMs = 500 }) {
  const results = { sent: 0, failed: 0, skipped: 0, details: [] };

  for (const target of targets) {
    for (const channel of channels) {
      let result;

      if (channel === NOTIFICATION_CHANNELS.WHATSAPP) {
        if (!target.phone) { results.skipped++; continue; }
        result = await sendWhatsAppReminder(target.phone, message);
      } else if (channel === NOTIFICATION_CHANNELS.EMAIL) {
        if (!target.email) { results.skipped++; continue; }
        result = await sendEmailReminder(target.email, "تذكير", message);
      } else if (channel === NOTIFICATION_CHANNELS.SMS) {
        if (!target.phone) { results.skipped++; continue; }
        result = await sendSmsReminder(target.phone, message);
      }

      if (result?.success) results.sent++;
      else results.failed++;

      results.details.push({ target: target.name || target.phone, channel, ...result });

      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}

