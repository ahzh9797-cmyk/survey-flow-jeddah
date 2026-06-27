// ═══════════════════════════════════════════════════════
// SHARED UTILITIES — survey-flow-jeddah
// ═══════════════════════════════════════════════════════

/**
 * توليد معرّف فريد.
 * يستخدم crypto.randomUUID() إن كان متاحاً.
 * وإلا يعود إلى توليد عشوائي مزدوج.
 */
export function genId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * نسخ عميق آمن.
 * يستخدم structuredClone() إن كان متاحاً — يدعم Date، Map، Set، وغيرها.
 * وإلا يعود إلى JSON serialization للبيئات القديمة.
 */
export function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

