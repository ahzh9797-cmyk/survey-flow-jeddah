/**
 * PWAUpdateBanner — shows when a new app version is available
 * Drop into App.jsx:
 *   import PWAUpdateBanner from "./PWAUpdateBanner.jsx";
 *   // inside JSX:
 *   <PWAUpdateBanner />
 */

import { useSWUpdate } from "./usePWA.js";

export default function PWAUpdateBanner() {
  const { updateAvailable, applyUpdate } = useSWUpdate();

  if (!updateAvailable) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 100,
      left: 16,
      right: 16,
      background: "linear-gradient(135deg, #064E3B, #065F46)",
      borderRadius: 14,
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      zIndex: 1000,
      boxShadow: "0 8px 32px rgba(6,78,59,0.35)",
      direction: "rtl",
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>🆕</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>
          يتوفر تحديث جديد
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
          اضغط تحديث لتطبيق الإصدار الجديد
        </p>
      </div>
      <button
        onClick={applyUpdate}
        style={{
          background: "#C9A84C",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
          fontFamily: "inherit",
          flexShrink: 0,
        }}>
        تحديث
      </button>
    </div>
  );
}
