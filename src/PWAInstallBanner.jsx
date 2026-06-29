/**
 * PWAInstallBanner — Install prompt banner
 * Uses usePWAInstall hook — no business logic
 *
 * Drop into App.jsx anywhere inside the render tree:
 *   import PWAInstallBanner from "./PWAInstallBanner.jsx";
 *   // inside JSX:
 *   <PWAInstallBanner />
 */

import { useState } from "react";
import { usePWAInstall } from "./usePWA.js";

export default function PWAInstallBanner() {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Already installed or dismissed
  if (isInstalled || dismissed) return null;

  // iOS: show manual instruction
  if (isIOS && !dismissed) {
    return (
      <div style={{
        background: "linear-gradient(135deg, #064E3B, #065F46)",
        borderRadius: 14,
        padding: "12px 14px",
        margin: "0 16px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        boxShadow: "0 4px 16px rgba(6,78,59,0.3)",
        direction: "rtl",
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>📲</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            ثبّت التطبيق على آيفون
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
            اضغط زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية»
          </p>
        </div>
        <button onClick={() => setDismissed(true)} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.5)",
          fontSize: 18, cursor: "pointer", padding: 0, flexShrink: 0,
          lineHeight: 1,
        }}>✕</button>
      </div>
    );
  }

  // Android / Desktop: native prompt available
  if (!canInstall) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #064E3B, #065F46)",
      borderRadius: 14,
      padding: "12px 14px",
      margin: "0 16px 14px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      boxShadow: "0 4px 16px rgba(6,78,59,0.3)",
      direction: "rtl",
    }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>📲</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#fff" }}>
          ثبّت التطبيق على جهازك
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
          وصول أسرع · أيقونة على الشاشة الرئيسية · يعمل بدون إنترنت
        </p>
      </div>
      <button
        onClick={async () => {
          setInstalling(true);
          const accepted = await promptInstall();
          setInstalling(false);
          if (!accepted) setDismissed(true);
        }}
        disabled={installing}
        style={{
          background: "#C9A84C",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 800,
          cursor: installing ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          flexShrink: 0,
          opacity: installing ? 0.7 : 1,
        }}>
        {installing ? "..." : "تثبيت"}
      </button>
      <button onClick={() => setDismissed(true)} style={{
        background: "none", border: "none", color: "rgba(255,255,255,0.4)",
        fontSize: 18, cursor: "pointer", padding: 0, flexShrink: 0,
      }}>✕</button>
    </div>
  );
}

