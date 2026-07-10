/**
 * AppSidebar.jsx — Phase 3 fix
 * Mobile: drawer is position:fixed, slides from right (RTL), width 288px max,
 *   never affects layout. Backdrop click closes it. Swipe-close via touch.
 * Tablet/Desktop: permanent rail, collapsible. Unchanged behaviour.
 * All nav logic, NAV_SECTIONS, props — 100% unchanged.
 */

import { useState, useEffect, useRef } from "react";

const S = {
  bg900: "#062C24",
  bg800: "#0A3D32",
  bg700: "#0F4D3F",
  line:  "rgba(255,255,255,0.08)",
  textPrimary:   "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.55)",
  textMuted:     "rgba(255,255,255,0.35)",
  accent:    "#10B981",
  accentBg:  "rgba(16,185,129,0.14)",
  gold:      "#C9A84C",
  danger:    "#F87171",
};

export const NAV_SECTIONS = [
  {
    id: "home",
    items: [
      { id: "dashboard",  label: "الاستبيانات",  icon: "📋", tabId: "dashboard" },
      { id: "overview",   label: "نظرة عامة",    icon: "🏠", tabId: "overview" },
      { id: "analytics",  label: "إحصائيات",     icon: "📊", tabId: "analytics" },
    ],
  },
  {
    id: "surveys",
    label: "الاستبيانات",
    items: [
      { id: "surveys-new",       label: "إنشاء استبيان", icon: "➕", tabId: "dashboard", action: "new" },
      { id: "surveys-templates", label: "القوالب",        icon: "🗂️", tabId: "templates" },
    ],
  },
  {
    id: "directory",
    label: "الدليل",
    items: [
      { id: "dir-schools",        label: "المدارس",   icon: "🏫", tabId: "directory" },
      { id: "dir-administrators", label: "المديرون",  icon: "👨‍💼", tabId: "directory" },
      { id: "dir-supervisors",    label: "المشرفون",  icon: "👤", tabId: "directory" },
    ],
  },
  {
    id: "insights",
    label: "التقارير",
    items: [
      { id: "reports",   label: "التقارير",       icon: "📈", tabId: "reports" },
      { id: "library",   label: "مكتبة المحتوى",  icon: "📚", tabId: "library" },
      { id: "review",    label: "مركز المراجعة",  icon: "🔍", tabId: "review" },
      { id: "comms",     label: "الاتصالات",      icon: "📨", tabId: "communication" },
    ],
  },
  {
    id: "admin",
    label: "الإدارة",
    adminOnly: true,
    items: [
      { id: "admin-users",     label: "المستخدمون",  icon: "👥", tabId: "more", action: "users" },
      { id: "admin-super",     label: "المشرفون",    icon: "👤", tabId: "more", action: "supervisors" },
      { id: "admin-audit",     label: "سجل العمليات",icon: "📝", tabId: "more", action: "auditlog" },
      { id: "admin-settings",  label: "الإعدادات",   icon: "⚙️", tabId: "more", action: "settings" },
      { id: "admin-identity",  label: "هوية النظام", icon: "🏛️", tabId: "identity" },
    ],
  },
];

if (typeof document !== "undefined" && !document.getElementById("sidebar-shell-styles")) {
  const s = document.createElement("style");
  s.id = "sidebar-shell-styles";
  s.textContent = `
    .sb-item { transition: background 0.13s ease, color 0.13s ease; }
    .sb-item:hover { background: rgba(255,255,255,0.07); }
    .sb-item.active { background: rgba(16,185,129,0.14); }
    .sb-scroll::-webkit-scrollbar { width: 3px; }
    .sb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
    .sb-collapse-label { transition: opacity 0.15s ease, max-width 0.2s ease; white-space: nowrap; overflow: hidden; }

    /* Mobile drawer — slides in from right (RTL) */
    @keyframes sbSlideIn  { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes sbSlideOut { from { transform: translateX(0); }    to { transform: translateX(100%); } }
    @keyframes sbFadeIn   { from { opacity: 0; } to { opacity: 1; } }
    .sb-drawer-open  { animation: sbSlideIn  0.26s cubic-bezier(0.22,1,0.36,1) both; }
    .sb-drawer-close { animation: sbSlideOut 0.22s cubic-bezier(0.55,0,1,0.45) both; }
    .sb-backdrop     { animation: sbFadeIn   0.2s ease both; }
  `;
  document.head.appendChild(s);
}

function NavItem({ item, isActive, collapsed, onClick }) {
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
        gap: 10,
        padding: collapsed ? "10px 0" : "9px 12px",
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
      <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
      {!collapsed && (
        <span style={{
          fontSize: 13,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? "#fff" : S.textSecondary,
          flex: 1,
          textAlign: "right",
        }}>
          {item.label}
        </span>
      )}
      {!collapsed && disabled && (
        <span style={{ fontSize: 9, color: S.textMuted, background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "2px 6px" }}>
          قريباً
        </span>
      )}
      {isActive && (
        <span style={{
          position: "absolute", right: 0, top: "18%", bottom: "18%",
          width: 3, borderRadius: 4, background: S.accent,
        }} />
      )}
    </button>
  );
}

function NavSection({ section, activeTabId, activeAction, collapsed, onItemClick, isAdmin }) {
  if (section.adminOnly && !isAdmin) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      {section.label && !collapsed && (
        <p style={{
          margin: "0 0 5px", padding: "0 12px",
          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          color: S.textMuted, textTransform: "uppercase",
        }}>
          {section.label}
        </p>
      )}
      {section.label && collapsed && (
        <div style={{ height: 1, background: S.line, margin: "6px 12px" }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 6px" }}>
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

function SidebarInner({ collapsed, isMobileDrawer, activeTabId, activeAction, onItemClick,
                        onToggleCollapse, onCloseMobile, isAdmin, user, role, onSignOut, appName }) {
  const EXPANDED_W  = isMobileDrawer ? 288 : 256;
  const COLLAPSED_W = 76;
  const w = isMobileDrawer ? EXPANDED_W : (collapsed ? COLLAPSED_W : EXPANDED_W);

  return (
    <div style={{
      width: w,
      height: "100%",
      background: `linear-gradient(180deg, ${S.bg900} 0%, ${S.bg800} 100%)`,
      display: "flex",
      flexDirection: "column",
      overflowX: "hidden",
      flexShrink: 0,
      transition: isMobileDrawer ? "none" : "width 0.22s cubic-bezier(0.22,1,0.36,1)",
    }}>
      {/* Brand */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: collapsed && !isMobileDrawer ? "16px 0" : "16px 14px",
        justifyContent: collapsed && !isMobileDrawer ? "center" : "flex-start",
        borderBottom: `1px solid ${S.line}`, flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: "rgba(255,255,255,0.08)", border: `1px solid ${S.line}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
        }}>📋</div>
        {(!collapsed || isMobileDrawer) && (
          <div style={{ overflow: "hidden", flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>
              {appName}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: S.textMuted }}>إدارة التعليم — جدة</p>
          </div>
        )}
        {isMobileDrawer && (
          <button onClick={onCloseMobile} style={{
            background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8,
            width: 28, height: 28, color: "#fff", fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>✕</button>
        )}
      </div>

      {/* Collapse toggle — desktop/tablet only */}
      {!isMobileDrawer && (
        <button onClick={onToggleCollapse} style={{
          margin: "8px 10px 0",
          alignSelf: collapsed ? "center" : "flex-end",
          background: "rgba(255,255,255,0.05)", border: `1px solid ${S.line}`,
          borderRadius: 7, width: 26, height: 26, color: S.textSecondary,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 11, flexShrink: 0,
        }}>
          {collapsed ? "‹" : "›"}
        </button>
      )}

      {/* Nav */}
      <div className="sb-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 0 8px" }}>
        {NAV_SECTIONS.map(section => (
          <NavSection
            key={section.id}
            section={section}
            activeTabId={activeTabId}
            activeAction={activeAction}
            collapsed={collapsed && !isMobileDrawer}
            onItemClick={onItemClick}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${S.line}`,
        padding: collapsed && !isMobileDrawer ? "10px 6px" : "10px 12px",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 9,
          justifyContent: collapsed && !isMobileDrawer ? "center" : "flex-start",
          marginBottom: 8,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            background: S.accentBg, border: `1px solid ${S.accent}40`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
          }}>
            {role === "admin" ? "👑" : "👁️"}
          </div>
          {(!collapsed || isMobileDrawer) && (
            <div style={{ overflow: "hidden", flex: 1 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.email || "مستخدم"}
              </p>
              <p style={{ margin: 0, fontSize: 9, color: S.textMuted }}>
                {role === "admin" ? "مدير عام" : "مشرف"}
              </p>
            </div>
          )}
        </div>
        <button onClick={onSignOut} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          justifyContent: collapsed && !isMobileDrawer ? "center" : "flex-start",
          background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontFamily: "inherit",
        }}>
          <span style={{ fontSize: 13 }}>🚪</span>
          {(!collapsed || isMobileDrawer) && (
            <span style={{ fontSize: 11, fontWeight: 700, color: S.danger }}>تسجيل الخروج</span>
          )}
        </button>
      </div>
    </div>
  );
}

export default function AppSidebar({
  activeTabId, activeAction, onNavigate, isAdmin,
  collapsed, onToggleCollapse,
  mobileOpen, onCloseMobile,
  user, onSignOut, role,
  appName = "منظومة الاستبيانات",
}) {
  // Touch-to-close: track swipe right on the drawer
  const touchStartX = useRef(null);

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    // RTL: swipe right (positive dx) = close
    if (dx > 60) onCloseMobile?.();
    touchStartX.current = null;
  }

  function handleItemClick(item) {
    onNavigate(item);
    if (mobileOpen) onCloseMobile?.();
  }

  return (
    <>
      {/* Desktop / Tablet — inline in flex row, width controlled by parent */}
      {onToggleCollapse && (
        <div style={{ width: "100%", height: "100%" }}>
          <SidebarInner
            collapsed={collapsed}
            isMobileDrawer={false}
            activeTabId={activeTabId}
            activeAction={activeAction}
            onItemClick={handleItemClick}
            onToggleCollapse={onToggleCollapse}
            isAdmin={isAdmin}
            user={user}
            role={role}
            onSignOut={onSignOut}
            appName={appName}
          />
        </div>
      )}

      {/* Mobile drawer — position:fixed, never touches layout */}
      {mobileOpen !== undefined && (
        <>
          {/* Backdrop */}
          {mobileOpen && (
            <div
              className="sb-backdrop"
              onClick={onCloseMobile}
              style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.45)",
                zIndex: 9998,
                WebkitTapHighlightColor: "transparent",
              }}
            />
          )}
          {/* Drawer */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={mobileOpen ? "sb-drawer-open" : undefined}
            style={{
              position: "fixed", top: 0, bottom: 0, right: 0,
              zIndex: 9999,
              height: "100%",
              // hidden when closed — translateX pushes it off-screen without display:none
              // so the closing animation can still play
              transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
              transition: mobileOpen ? "none" : "transform 0.22s cubic-bezier(0.55,0,1,0.45)",
              pointerEvents: mobileOpen ? "auto" : "none",
            }}
          >
            <SidebarInner
              collapsed={false}
              isMobileDrawer={true}
              activeTabId={activeTabId}
              activeAction={activeAction}
              onItemClick={handleItemClick}
              onCloseMobile={onCloseMobile}
              isAdmin={isAdmin}
              user={user}
              role={role}
              onSignOut={onSignOut}
              appName={appName}
            />
          </div>
        </>
      )}
    </>
  );
}

