/**
 * AppTopBar.jsx
 * Enterprise top bar — Phase 1 of the redesign.
 *
 * Includes: mobile menu trigger, ministry/system identity, global
 * search input (UI only — wiring to actual search happens when the
 * relevant page is integrated, per the phased plan), notifications
 * bell, current date, and user profile / logout.
 *
 * Purely presentational. No business logic, no Supabase calls.
 */

import { useState, useEffect } from "react";

const TB = {
  white: "#FFFFFF",
  border: "#E2E8F0",
  s900: "#0F172A",
  s700: "#334155",
  s500: "#64748B",
  s400: "#94A3B8",
  s100: "#F1F5F9",
  s50:  "#F8FAFC",
  accent: "#059669",
  accentBg: "#ECFDF5",
  gold: "#C9A84C",
  danger: "#DC2626",
};

if (typeof document !== "undefined" && !document.getElementById("topbar-shell-styles")) {
  const s = document.createElement("style");
  s.id = "topbar-shell-styles";
  s.textContent = `
    .tb-search:focus { border-color: ${TB.accent} !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; }
    .tb-icon-btn { transition: background 0.15s ease, transform 0.1s ease; }
    .tb-icon-btn:hover { background: ${TB.s100}; }
    .tb-icon-btn:active { transform: scale(0.94); }
    .tb-profile-menu { animation: tbMenuIn 0.15s ease both; transform-origin: top left; }
    @keyframes tbMenuIn { from { opacity:0; transform:scale(0.95) translateY(-4px); } to { opacity:1; transform:scale(1) translateY(0); } }
  `;
  document.head.appendChild(s);
}

function IconButton({ icon, badge, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="tb-icon-btn"
      style={{
        position: "relative",
        width: 38, height: 38, borderRadius: 10,
        background: "transparent", border: `1px solid ${TB.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 16, flexShrink: 0,
      }}
    >
      {icon}
      {badge > 0 && (
        <span style={{
          position: "absolute", top: -4, left: -4,
          background: TB.danger, color: "#fff", borderRadius: 10,
          fontSize: 9, fontWeight: 800, minWidth: 16, height: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 3px", border: "1.5px solid #fff",
        }}>{badge > 9 ? "9+" : badge}</span>
      )}
    </button>
  );
}

/**
 * Props:
 *   onOpenMobileMenu — opens the sidebar drawer on mobile/tablet
 *   appName, appSubtitle, logoUrl — branding (same data App.jsx already loads)
 *   schoolCount
 *   user, role, onSignOut
 *   pendingCount — for the notification bell badge (reuses existing usePendingCount)
 *   search, onSearchChange — optional controlled search (no-op safe if unused)
 *   showMenuButton — whether to show the ☰ trigger (true on mobile/tablet)
 */
export default function AppTopBar({
  onOpenMobileMenu,
  appName = "منظومة الاستبيانات",
  appSubtitle = "إدارة التعليم — جدة",
  logoUrl,
  schoolCount,
  user,
  role,
  onSignOut,
  pendingCount = 0,
  search = "",
  onSearchChange,
  showMenuButton = false,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{
      background: TB.white,
      borderBottom: `1px solid ${TB.border}`,
      position: "sticky", top: 0, zIndex: 30,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "10px 16px", minHeight: 60,
      }}>
        {/* Mobile menu trigger */}
        {showMenuButton && (
          <button
            onClick={onOpenMobileMenu}
            className="tb-icon-btn"
            style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: "transparent", border: `1px solid ${TB.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 18, color: TB.s700,
            }}
          >☰</button>
        )}

        {/* Brand (visible mainly when sidebar is a drawer / mobile) */}
        {showMenuButton && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="logo" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "contain" }} />
            ) : (
              <div style={{
                width: 30, height: 30, borderRadius: 8, background: TB.accentBg,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              }}>📋</div>
            )}
            <div style={{ display: "none" }} />
          </div>
        )}

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 420, position: "relative" }}>
          <span style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, color: TB.s400, pointerEvents: "none",
          }}>🔍</span>
          <input
            className="tb-search"
            value={search}
            onChange={e => onSearchChange?.(e.target.value)}
            placeholder="بحث في الاستبيانات، المدارس، المشرفين..."
            style={{
              width: "100%", padding: "9px 38px 9px 14px",
              border: `1.5px solid ${TB.border}`, borderRadius: 10,
              fontSize: 13, fontFamily: "inherit", direction: "rtl",
              background: TB.s50, color: TB.s900, outline: "none",
              boxSizing: "border-box", transition: "all 0.2s",
            }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Date — hidden on very small screens via inline media handled by parent breakpoint */}
        <div className="tb-date-block" style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end",
          marginLeft: 4, flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: TB.s700 }}>{dateStr}</span>
          <span style={{ fontSize: 10, color: TB.s400 }}>{schoolCount} مدرسة مسجّلة</span>
        </div>

        {/* Notifications */}
        <IconButton icon="🔔" badge={pendingCount} title="الإشعارات" onClick={() => {}} />

        {/* Profile */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setProfileOpen(p => !p)}
            className="tb-icon-btn"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "transparent", border: `1px solid ${TB.border}`,
              borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: "50%", background: TB.accentBg,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
            }}>
              {role === "admin" ? "👑" : "👁️"}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: TB.s900, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.email?.split("@")[0] || "مستخدم"}
            </span>
            <span style={{ fontSize: 9, color: TB.s400 }}>▾</span>
          </button>

          {profileOpen && (
            <>
              <div onClick={() => setProfileOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
              <div className="tb-profile-menu" style={{
                position: "absolute", left: 0, top: "calc(100% + 6px)", zIndex: 40,
                background: TB.white, border: `1px solid ${TB.border}`, borderRadius: 12,
                boxShadow: "0 12px 32px rgba(0,0,0,0.12)", minWidth: 200, overflow: "hidden",
              }}>
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${TB.border}` }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: TB.s900, wordBreak: "break-all" }}>
                    {user?.email}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: TB.s400 }}>
                    {role === "admin" ? "👑 مدير عام" : "👁️ مشرف (عرض فقط)"}
                  </p>
                </div>
                <button
                  onClick={onSignOut}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: TB.danger,
                  }}
                >
                  <span>🚪</span> تسجيل الخروج
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
