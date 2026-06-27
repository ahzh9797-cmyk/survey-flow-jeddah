/**
 * LifecycleActions — أزرار دورة حياة الاستبيان
 * مكون قابل لإعادة الاستخدام يعرض الأفعال المتاحة بناءً على حالة الاستبيان
 */

import { useState } from "react";
import { C, Btn } from "./lib.jsx";
import {
  resolveState,
  getAvailableActions,
  LIFECYCLE_STATE_CONFIG,
  publishSurvey,
  pauseSurvey,
  resumeSurvey,
  closeSurvey,
  archiveSurvey,
  duplicateSurvey,
} from "./SurveyLifecycleService.js";

// ── شارة الحالة ──
export function LifecycleBadge({ survey }) {
  const state = resolveState(survey);
  const config = LIFECYCLE_STATE_CONFIG[state] || LIFECYCLE_STATE_CONFIG.published;
  return (
    <span style={{
      background: config.bg,
      color: config.color,
      border: `1px solid ${config.color}40`,
      borderRadius: 20,
      padding: "3px 12px",
      fontSize: 12,
      fontWeight: 700,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      whiteSpace: "nowrap",
    }}>
      {config.label}
    </span>
  );
}

// ── تأكيد الفعل ──
function ConfirmDialog({ action, survey, onConfirm, onCancel }) {
  const configs = {
    publish:   { title: "نشر الاستبيان؟",      desc: "سيصبح متاحاً للمستجيبين فوراً.",                         btn: "🚀 نشر",          variant: "primary" },
    pause:     { title: "إيقاف مؤقت؟",          desc: "لن يتمكن أحد من الإجابة أثناء الإيقاف.",               btn: "⏸️ إيقاف مؤقت",  variant: "secondary" },
    resume:    { title: "استئناف الاستبيان؟",   desc: "سيعود الاستبيان للعمل ويقبل إجابات جديدة.",             btn: "▶️ استئناف",      variant: "primary" },
    close:     { title: "إغلاق الاستبيان؟",     desc: "لن يقبل إجابات جديدة. يمكن أرشفته لاحقاً.",            btn: "🔒 إغلاق",        variant: "danger" },
    archive:   { title: "أرشفة الاستبيان؟",     desc: "سيُنقل للأرشيف ولن يظهر في القائمة الرئيسية.",         btn: "📦 أرشفة",        variant: "secondary" },
    duplicate: { title: "نسخ الاستبيان؟",       desc: "سيُنشأ استبيان جديد بنفس الأسئلة كمسودة.",             btn: "📄 نسخ",          variant: "secondary" },
  };

  const cfg = configs[action];
  if (!cfg) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, direction: "rtl",
    }}>
      <div style={{ background: C.white, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }}>
        <p style={{ textAlign: "center", fontSize: 16, fontWeight: 700, color: C.dark, margin: "0 0 8px" }}>
          {cfg.title}
        </p>
        <p style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: C.primary, margin: "0 0 6px" }}>
          {survey.title}
        </p>
        <p style={{ textAlign: "center", color: C.muted, fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 }}>
          {cfg.desc}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn full variant="secondary" onClick={onCancel}>إلغاء</Btn>
          <Btn full variant={cfg.variant} onClick={onConfirm}>{cfg.btn}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── المكون الرئيسي ──
export default function LifecycleActions({ survey, user, isAdmin, onRefresh, compact = false }) {
  const [pending, setPending] = useState(null);   // الفعل المنتظر التأكيد
  const [loading, setLoading] = useState(null);   // الفعل قيد التنفيذ
  const [error, setError] = useState("");

  const availableActions = getAvailableActions(survey, isAdmin);

  const ACTION_CONFIG = {
    publish:   { label: "🚀 نشر",          variant: "primary"   },
    pause:     { label: "⏸️ إيقاف مؤقت",  variant: "secondary" },
    resume:    { label: "▶️ استئناف",      variant: "primary"   },
    close:     { label: "🔒 إغلاق",        variant: "danger"    },
    archive:   { label: "📦 أرشفة",        variant: "secondary" },
    duplicate: { label: "📄 نسخ",          variant: "secondary" },
  };

  // الأفعال التي تحتاج تأكيد
  const NEEDS_CONFIRM = ["publish", "pause", "close", "archive"];

  async function executeAction(action) {
    setLoading(action);
    setError("");
    try {
      const fns = { publishSurvey, pauseSurvey, resumeSurvey, closeSurvey, archiveSurvey, duplicateSurvey };
      const fnMap = {
        publish:   fns.publishSurvey,
        pause:     fns.pauseSurvey,
        resume:    fns.resumeSurvey,
        close:     fns.closeSurvey,
        archive:   fns.archiveSurvey,
        duplicate: fns.duplicateSurvey,
      };
      await fnMap[action](survey, user);
      onRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(null);
      setPending(null);
    }
  }

  function handleAction(action) {
    if (NEEDS_CONFIRM.includes(action)) {
      setPending(action);
    } else {
      executeAction(action);
    }
  }

  if (!availableActions.length) return null;

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {availableActions.map(action => {
          const cfg = ACTION_CONFIG[action];
          if (!cfg) return null;
          return (
            <Btn
              key={action}
              sm
              variant={cfg.variant}
              loading={loading === action}
              disabled={!!loading}
              onClick={() => handleAction(action)}
            >
              {cfg.label}
            </Btn>
          );
        })}
      </div>

      {error && (
        <p style={{ color: C.danger, fontSize: 12, margin: "6px 0 0" }}>⚠️ {error}</p>
      )}

      {pending && (
        <ConfirmDialog
          action={pending}
          survey={survey}
          onConfirm={() => executeAction(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}

