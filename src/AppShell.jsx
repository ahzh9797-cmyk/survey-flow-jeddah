/**
 * AppShell.jsx — Ministry Edition v2
 * Design System: IBM Plex Sans Arabic, Lucide icons (SVG inline),
 * وزارة التعليم color palette, no emoji, RTL-first.
 * Logic: 100% unchanged from Phase 3 fix.
 */

import { useState, useEffect, useCallback } from "react";
import AppSidebar from "./AppSidebar.jsx";
import AppTopBar  from "./AppTopBar.jsx";

const BREAKPOINTS = { mobile: 768, tablet: 1024 };

// ── Ministry Design System ──────────────────────────────
export const DS = {
  // وزارة التعليم brand
  primary:    "#006B54",  // الأخضر الرسمي
  primary700: "#005741",
  primary600: "#006B54",
  primary500: "#008A6A",
  primary100: "#D6EFE9",
  primary50:  "#EBF7F4",

  // Secondary
  gold:       "#C9A84C",
  goldLight:  "#FEF3C7",

  // Neutrals
  n900: "#0F172A",
  n800: "#1E293B",
  n700: "#334155",
  n600: "#475569",
  n500: "#64748B",
  n400: "#94A3B8",
  n300: "#CBD5E1",
  n200: "#E2E8F0",
  n100: "#F1F5F9",
  n50:  "#F8FAFC",
  white:"#FFFFFF",
  bg:   "#F0F4F8",

  // Semantic
  danger:     "#DC2626",
  dangerBg:   "#FEF2F2",
  warn:       "#D97706",
  warnBg:     "#FFFBEB",
  success:    "#059669",
  successBg:  "#ECFDF5",
  info:       "#0284C7",
  infoBg:     "#E0F2FE",

  // Typography
  fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif",
  fontMono:   "'IBM Plex Mono', monospace",

  // Radius
  r4:  4, r8:  8, r10: 10, r12: 12,
  r14: 14, r16: 16, r20: 20, r24: 24,

  // Shadow
  shadow1: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadow2: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.05)",
  shadow3: "0 10px 30px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)",
};

// ── Google Fonts injection ──────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("ministry-fonts")) {
  const link = document.createElement("link");
  link.id   = "ministry-fonts";
  link.rel  = "preconnect";
  link.href = "https://fonts.googleapis.com";
  document.head.appendChild(link);
  const link2 = document.createElement("link");
  link2.rel  = "stylesheet";
  link2.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@400;500;700;800&display=swap";
  document.head.appendChild(link2);
}

// ── Global CSS ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("ministry-global")) {
  const s = document.createElement("style");
  s.id = "ministry-global";
  s.textContent = `
    *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: 'IBM Plex Sans Arabic', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif !important;
      background: #F0F4F8;
      margin: 0;
      color: #0F172A;
      -webkit-font-smoothing: antialiased;
    }
    /* Smooth transitions */
    .ms-btn  { transition: background 0.15s, box-shadow 0.15s, transform 0.1s; }
    .ms-btn:active  { transform: scale(0.97); }
    .ms-card { transition: box-shadow 0.15s, transform 0.15s; }
    .ms-card:hover  { box-shadow: 0 6px 20px rgba(0,0,0,0.09) !important; transform: translateY(-1px); }
    .ms-row  { transition: background 0.1s; }
    .ms-row:hover   { background: #F8FAFC !important; }
    /* Page entrance */
    @keyframes ms-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .ms-in { animation: ms-in 0.22s cubic-bezier(0.22,1,0.36,1) both; }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* Focus ring */
    :focus-visible { outline: 2px solid #006B54; outline-offset: 2px; }
    /* Scrollbar */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    /* Input resets */
    input, select, textarea, button {
      font-family: inherit;
    }
  `;
  document.head.appendChild(s);
}

function useViewport() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  useEffect(() => {
    let raf = null;
    function onResize() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    }
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return {
    width,
    isMobile:  width < BREAKPOINTS.mobile,
    isTablet:  width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
    isDesktop: width >= BREAKPOINTS.tablet,
  };
}

export default function AppShell({
  activeTabId, activeAction, onNavigate, isAdmin,
  user, role, onSignOut,
  schoolCount, pendingCount,
  appName, appSubtitle, logoUrl,
  search, onSearchChange,
  children,
}) {
  const { isMobile, isTablet, isDesktop } = useViewport();
  const [collapsed, setCollapsed]           = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (isTablet)  setCollapsed(true);
    if (isDesktop) setCollapsed(false);
  }, [isTablet, isDesktop]);

  useEffect(() => {
    if (!isMobile && mobileDrawerOpen) setMobileDrawerOpen(false);
  }, [isMobile, mobileDrawerOpen]);

  const handleNavigate = useCallback((item) => { onNavigate?.(item); }, [onNavigate]);

  const EXPANDED_W  = 240;
  const COLLAPSED_W = 64;
  const railWidth   = isMobile ? 0 : (collapsed ? COLLAPSED_W : EXPANDED_W);

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:DS.bg, direction:"rtl" }}>

      {/* Desktop / Tablet rail */}
      {!isMobile && (
        <div style={{
          width: railWidth, flexShrink: 0,
          transition: "width 0.22s cubic-bezier(0.22,1,0.36,1)",
          position: "relative", zIndex: 20,
        }}>
          <div style={{ position:"sticky", top:0, height:"100vh", overflow:"hidden" }}>
            <AppSidebar
              activeTabId={activeTabId} activeAction={activeAction}
              onNavigate={handleNavigate} isAdmin={isAdmin}
              collapsed={collapsed} onToggleCollapse={() => setCollapsed(p => !p)}
              mobileOpen={false} user={user} role={role} onSignOut={onSignOut}
              appName={appName}
            />
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <AppSidebar
          activeTabId={activeTabId} activeAction={activeAction}
          onNavigate={handleNavigate} isAdmin={isAdmin}
          collapsed={false} mobileOpen={mobileDrawerOpen}
          onCloseMobile={() => setMobileDrawerOpen(false)}
          user={user} role={role} onSignOut={onSignOut} appName={appName}
        />
      )}

      {/* Main */}
      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>
        <AppTopBar
          showMenuButton={isMobile || isTablet}
          onOpenMobileMenu={() => setMobileDrawerOpen(true)}
          appName={appName} appSubtitle={appSubtitle} logoUrl={logoUrl}
          schoolCount={schoolCount} user={user} role={role} onSignOut={onSignOut}
          pendingCount={pendingCount} search={search} onSearchChange={onSearchChange}
        />
        <main style={{
          flex: 1,
          padding: isMobile ? "16px 12px 40px" : "24px 28px 48px",
          maxWidth: "100%", overflowX: "hidden",
        }}>
          <div className="ms-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
