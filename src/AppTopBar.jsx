/**
 * AppTopBar.jsx — Phase 3 fix
 * Shows hamburger on mobile/tablet to open the mobile drawer.
 * All other props/logic unchanged.
 */

import { useState } from "react";

const TB = {
  white: "#FFFFFF",
  s900:  "#0F172A",
  s700:  "#334155",
  s500:  "#64748B",
  s400:  "#94A3B8",
  s200:  "#E2E8F0",
  s100:  "#F1F5F9",
  s50:   "#F8FAFC",
  e700:  "#047857",
  e600:  "#059669",
  e50:   "#ECFDF5",
  e100:  "#D1FAE5",
  gold:  "#C9A84C",
  goldL: "#FEF3C7",
  warn:  "#D97706",
};

export default function AppTopBar({
  showMenuButton, onOpenMobileMenu,
  appName, appSubtitle, logoUrl,
  schoolCount, user, role, onSignOut,
  pendingCount = 0,
  search = "", onSearchChange,
}) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header style={{
      background: TB.white,
      borderBottom: `1px solid ${TB.s200}`,
      padding: "0 16px",
      height: 56,
      display: "flex",
      alignItems: "center",
      gap: 10,
      position: "sticky",
      top: 0,
      zIndex: 100,
      flexShrink: 0,
    }}>
      {/* Hamburger — mobile / tablet */}
      {showMenuButton && (
        <button
          onClick={onOpenMobileMenu}
          aria-label="فتح القائمة"
          style={{
            background: "none", border: "none", cursor: "pointer",
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: TB.s700,
          }}
        >☰</button>
      )}

      {/* Brand text — shown when sidebar is collapsed or mobile */}
      {showMenuButton && (
        <div style={{ flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: TB.s900, lineHeight: 1.2 }}>
            {appName}
          </p>
          {schoolCount != null && (
            <p style={{ margin: 0, fontSize: 9, color: TB.s500 }}>
              {Number(schoolCount).toLocaleString("ar-SA")} مدرسة مسجلة
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div style={{
        flex: 1, maxWidth: 420, position: "relative",
        marginLeft: showMenuButton ? "auto" : 0,
      }}>
        <span style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          fontSize: 13, pointerEvents: "none", color: TB.s400,
        }}>🔍</span>
        <input
          value={search}
          onChange={e => onSearchChange?.(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="بحث..."
          style={{
            width: "100%", padding: "7px 32px 7px 10px",
            border: `1.5px solid ${searchFocused ? TB.e600 : TB.s200}`,
            borderRadius: 9, fontSize: 12, fontFamily: "inherit",
            direction: "rtl", boxSizing: "border-box", outline: "none",
            background: TB.s50, color: TB.s900,
            transition: "border-color 0.15s",
          }}
        />
      </div>

      {/* Pending approval badge */}
      {pendingCount > 0 && (
        <div style={{
          background: TB.goldL, border: `1px solid ${TB.gold}40`,
          borderRadius: 20, padding: "4px 10px",
          fontSize: 11, fontWeight: 700, color: TB.warn,
          display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
          whiteSpace: "nowrap",
        }}>
          ⏳ {pendingCount}
        </div>
      )}

      {/* Notifications placeholder */}
      <button style={{
        background: "none", border: "none", cursor: "pointer",
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17, color: TB.s500, position: "relative",
      }}>🔔</button>

      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: TB.e50, border: `2px solid ${TB.e100}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, cursor: "default",
      }} title={user?.email || ""}>
        {role === "admin" ? "👑" : "👁️"}
      </div>
    </header>
  );
}

