/**
 * AppSidebar.jsx
 * Enterprise navigation sidebar — Phase 1 of the redesign.
 *
 * Behavior:
 *   Desktop (≥1024px): permanent sidebar, collapsible (icon-only ↔ full).
 *   Tablet  (768–1023px): collapsible, defaults to icon-only.
 *   Mobile  (<768px): hidden by default, slides in as a drawer from
 *     the right (RTL) when `open` is true, with a backdrop overlay.
 *
 * This component is purely presentational + navigation state.
 * It does NOT touch business logic, Supabase, or any existing page.
 * Page routing is driven by `activeTab` / `onNavigate`, matching the
 * same `tab` state contract already used in App.jsx today.
 *
 * NAV_SECTIONS is intentionally structured so that future sections
 * (Interactive Map, Archive, Automation, Messages, PDF/Excel export)
 * can be added later as new groups/items without restructuring the
 * sidebar itself — see the commented `FUTURE SECTIONS` block below.
 */

import { useState, useEffect } from "react";

// ── Design tokens — dark emerald sidebar, enterprise palette ──
const S = {
  bg900: "#062C24",      // deepest sidebar background
  bg800: "#0A3D32",      // sidebar surface
  bg700: "#0F4D3F",      // hover / active surface
  line:  "rgba(255,255,255,0.08)",
  textPrimary:   "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.55)",
  textMuted:     "rgba(255,255,255,0.35)",
  accent:    "#10B981",
  accentBg:  "rgba(16,185,129,0.14)",
  gold:      "#C9A84C",
  danger:    "#F87171",
};

// ══════════════════════════════════════════════════════
// NAV STRUCTURE
// Only pages that exist in the project today are wired with a
// `tabId`. Sections without a working page yet are flagged
// `comingSoon: true` so they render disabled (greyed, no click) —
// ready to be enabled the moment that page is built, with zero
// structural changes needed here.
// ══════════════════════════════════════════════════════
export const NAV_SECTIONS = [
  {
    id: "home",
    items: [
      { id: "dashboard", label: "الرئيسية", icon: "🏠", tabId: "dashboard" },
    ],
  },
  {
    id: "surveys",
    label: "الاستبيانات",
    icon: "📝",
    items: [
      { id: "surveys-all",      label: "جميع الاستبيانات", icon: "📋", tabId: "surveys" },
      { id: "surveys-new",      label: "إنشاء استبيان",     icon: "➕", tabId: "surveys", action: "new" },
      { id: "surveys-templates",label: "القوالب",            icon: "🗂️", tabId: "templates" },
    ],
  },
  {
    id: "directory",
    label: "الدليل",
    icon: "📁",
    items: [
      { id: "dir-schools",        label: "إدارة المدارس",   icon: "🏫", tabId: "directory" },
      { id: "dir-administrators", label: "إدارة المديرين",  icon: "👨‍💼", tabId: "directory" },
      { id: "dir-supervisors",    label: "إدارة المشرفين",  icon: "👤", tabId: "directory" },
    ],
  },
  {
    id: "insights",
    items: [
      { id: "analytics", label: "إحصائيات",    icon: "📊", tabId: "analytics" },
      { id: "reports",   label: "التقارير",     icon: "📈", tabId: "reports" },
      { id: "library",   label: "مكتبة المحتوى", icon: "📚", tabId: "library" },
      { id: "review",    label: "مركز المراجعة", icon: "🔍", tabId: "review" },
    ],
  },
  {
    id: "comms",
    items: [
      { id: "communication", label: "الاتصالات", icon: "📨", tabId: "communication" },
    ],
  },

  // ── FUTURE SECTIONS ─────────────────────────────────
  // Uncomment / extend when these pages are actually built.
  // Structure is ready — no sidebar redesign needed later.
  //
  // {
  //   id: "future",
  //   label: "قريباً",
  //   items: [
  //     { id:"map",        label:"الخريطة التفاعلية", icon:"🗺",  comingSoon:true },
  //     { id:"archive",     label:"الأرشيف",            icon:"📂", comingSoon:true },
  //     { id:"automation",  label:"الأتمتة",            icon:"⚡", comingSoon:true },
  //     { id:"messages",    label:"الرسائل",            icon:"💬", comingSoon:true },
  //     { id:"export-pdf",  label:"تصدير PDF",          icon:"📄", comingSoon:true },
  //     { id:"export-xlsx", label:"تصدير Excel",        icon:"📊", comingSoon:true },
  //     { id:"import",      label:"الاستيراد",          icon:"📥", comingSoon:true },
  //   ],
  // },

  {
    id: "admin",
    label: "الإدارة",
    icon: "⚙",
    adminOnly: true,
    items: [
      { id: "admin-users",    label: "إدارة المستخدمين", icon: "👥", tabId: "more", action: "users" },
      { id: "admin-audit",    label: "سجل العمليات",     icon: "📝", tabId: "more", action: "auditlog" },
      { id: "admin-settings", label: "الإعدادات",        icon: "⚙️", tabId: "more", action: "settings" },
    ],
  },
];

// ── Styles injected once ────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("sidebar-shell-styles")) {
  const s = document.createElement("style");
  s.id = "sidebar-shell-styles";
  s.textContent = `
    .sb-item { transition: background 0.15s ease, color 0.15s ease, padding 0.2s ease; }
    .sb-item:hover { background: rgba(255,255,255,0.06); }
    .sb-item.active { background: ${S.accentBg}; }
    .sb-scroll::-webkit-scrollbar { width: 4px; }
    .sb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
    .sb-drawer-enter { animation: sbDrawerIn 0.25s cubic-bezier(0.22,1,0.36,1) both; }
    @keyframes sbDrawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .sb-backdrop-enter { animation: sbBackdropIn 0.2s ease both; }
    @keyframes sbBackdropIn { from { opacity:0; } to { opacity:1; } }
    .sb-collapse-label { transition: opacity 0.15s ease, width 0.2s ease; white-space: nowrap; overflow: hidden; }
    .sb-tooltip { transition: opacity 0.12s ease, transform 0.12s ease; }
  `;
  document.head.appendChild(s);
}

// ── Single nav item row ──────────────────────────────────
function NavItem({ item, isActive, collapsed, onClick, showTooltipSide }) {
  const disabled = !!item.comingSoon;

  return (
    <button
      onClick={() => !disabled && onClick(item)}
      disabled={disabled}
      title={collapsed ? item.label : undefined}
      className={`sb-item${isActive ? " active" : ""}`}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: collapsed ? "10px 0" : "10px 14px",
        justifyContent: collapsed ? "center" : "flex-start",
        border: "none",
        borderRadius: 10,
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? 0.35 : 1,
        position: "relative",
      }}
    >
      <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
      {!collapsed && (
        <span
          className="sb-collapse-label"
          style={{
            fontSize: 13,
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "#fff" : S.textSecondary,
            flex: 1,
            textAlign: "right",
          }}
        >
          {item.label}
        </span>
      )}
      {!collapsed && disabled && (
        <span style={{ fontSize: 9, color: S.textMuted, background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>
          قريباً
        </span>
      )}
      {isActive && (
        <span style={{
          position: "absolute",
          [showTooltipSide === "left" ? "left" : "right"]: 0,
          top: "20%", bottom: "20%",
          width: 3,
          borderRadius: 4,
          background: S.accent,
        }} />
      )}
    </button>
  );
}

// ── Section group ────────────────────────────────────────
function NavSection({ section, activeTabId, activeAction, collapsed, onItemClick, isAdmin }) {
  if (section.adminOnly && !isAdmin) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      {section.label && !collapsed && (
        <p style={{
          margin: "0 0 6px", padding: "0 14px",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
          color: S.textMuted, textTransform: "uppercase",
        }}>
          {section.icon} {section.label}
        </p>
      )}
      {section.label && collapsed && (
        <div style={{ height: 1, background: S.line, margin: "8px 14px" }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: collapsed ? "0 8px" : "0 8px" }}>
        {section.items.map(item => (
          <NavItem
            key={item.id}
            item={item}
            collapsed={collapsed}
            isActive={activeTabId === item.tabId && (item.action ? activeAction === item.action : !item.action)}
            onClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MAIN: AppSidebar
//
// Props:
//   activeTabId   — current App.jsx `tab` value
//   activeAction  — optional sub-action (e.g. modal.type for "more" items)
//   onNavigate(item) — called when a nav item is clicked; receives the
//                       full item object ({ tabId, action, ... }) so the
//                       parent App.jsx can decide exactly how to route it
//                       without this component knowing App's internals.
//   isAdmin       — gates the admin-only section
//   collapsed     — controlled collapse state (desktop/tablet)
//   onToggleCollapse — toggles collapse
//   mobileOpen    — controlled drawer-open state (mobile)
//   onCloseMobile — closes the mobile drawer
//   user, onSignOut, role — for the footer user card
// ══════════════════════════════════════════════════════
export default function AppSidebar({
  activeTabId,
  activeAction,
  onNavigate,
  isAdmin,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  user,
  onSignOut,
  role,
  appName = "منظومة الاستبيانات",
}) {
  // Width values shared between desktop rail and mobile drawer
  const EXPANDED_W = 256;
  const COLLAPSED_W = 76;

  function handleItemClick(item) {
    onNavigate(item);
    if (mobileOpen) onCloseMobile?.();
  }

  const sidebarInner = (isMobileDrawer) => (
    <div
      style={{
        width: isMobileDrawer ? EXPANDED_W : (collapsed ? COLLAPSED_W : EXPANDED_W),
        height: "100%",
        background: `linear-gradient(180deg, ${S.bg900} 0%, ${S.bg800} 100%)`,
        display: "flex",
        flexDirection: "column",
        transition: isMobileDrawer ? "none" : "width 0.22s cubic-bezier(0.22,1,0.36,1)",
        flexShrink: 0,
      }}
    >
      {/* Brand row */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: 10, padding: collapsed && !isMobileDrawer ? "18px 0" : "18px 16px",
        justifyContent: collapsed && !isMobileDrawer ? "center" : "flex-start",
        borderBottom: `1px solid ${S.line}`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: "rgba(255,255,255,0.08)", border: `1px solid ${S.line}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>📋</div>
        {(!collapsed || isMobileDrawer) && (
          <div className="sb-collapse-label" style={{ overflow: "hidden" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>
              {appName}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: S.textMuted }}>إدارة التعليم — جدة</p>
          </div>
        )}

        {/* Mobile close button */}
        {isMobileDrawer && (
          <button
            onClick={onCloseMobile}
            style={{
              marginRight: "auto", background: "rgba(255,255,255,0.08)", border: "none",
              borderRadius: 8, width: 30, height: 30, color: "#fff", fontSize: 15,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >✕</button>
        )}
      </div>

      {/* Collapse toggle (desktop/tablet only) */}
      {!isMobileDrawer && (
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "توسيع" : "طي"}
          style={{
            margin: "10px 14px 0", alignSelf: collapsed ? "center" : "flex-end",
            background: "rgba(255,255,255,0.06)", border: `1px solid ${S.line}`,
            borderRadius: 8, width: 28, height: 28, color: S.textSecondary,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 12, flexShrink: 0,
          }}
        >
          {collapsed ? "‹" : "›"}
        </button>
      )}

      {/* Nav sections — scrollable */}
      <div className="sb-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 0 8px" }}>
        {NAV_SECTIONS.map(section => (
          <NavSection
            key={section.id}
            section={section}
            activeTabId={activeTabId}
            activeAction={activeAction}
            collapsed={collapsed && !isMobileDrawer}
            onItemClick={handleItemClick}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {/* Footer: user card + logout */}
      <div style={{ borderTop: `1px solid ${S.line}`, padding: collapsed && !isMobileDrawer ? "12px 8px" : "12px 14px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          justifyContent: collapsed && !isMobileDrawer ? "center" : "flex-start",
          marginBottom: 8,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: S.accentBg, border: `1px solid ${S.accent}40`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}>
            {role === "admin" ? "👑" : "👁️"}
          </div>
          {(!collapsed || isMobileDrawer) && (
            <div className="sb-collapse-label" style={{ overflow: "hidden", flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.email || "مستخدم"}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: S.textMuted }}>
                {role === "admin" ? "مدير عام" : "مشرف"}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={onSignOut}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8,
            justifyContent: collapsed && !isMobileDrawer ? "center" : "flex-start",
            background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: 9, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 14 }}>🚪</span>
          {(!collapsed || isMobileDrawer) && (
            <span style={{ fontSize: 12, fontWeight: 700, color: S.danger }}>تسجيل الخروج</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop / Tablet: permanent rail ── */}
      <div className="app-sidebar-desktop" style={{ height: "100vh", position: "sticky", top: 0 }}>
        {sidebarInner(false)}
      </div>

      {/* ── Mobile: drawer + backdrop ── */}
      {mobileOpen && (
        <div className="app-sidebar-mobile-portal">
          <div
            className="sb-backdrop-enter"
            onClick={onCloseMobile}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998 }}
          />
          <div
            className="sb-drawer-enter"
            style={{ position: "fixed", top: 0, bottom: 0, right: 0, zIndex: 9999, height: "100vh" }}
          >
            {sidebarInner(true)}
          </div>
        </div>
      )}
    </>
  );
}

