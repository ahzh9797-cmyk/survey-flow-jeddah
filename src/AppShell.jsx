/**
 * AppShell.jsx — Phase 3 fix
 * Corrects the mobile overlay bug: sidebar on mobile is now portal-style
 * (position:fixed) so it never pushes content. Desktop stays as permanent
 * flex rail. Tablet is collapsible rail. Logic/props unchanged.
 */

import { useState, useEffect, useCallback } from "react";
import AppSidebar from "./AppSidebar.jsx";
import AppTopBar from "./AppTopBar.jsx";

const BREAKPOINTS = { mobile: 768, tablet: 1024 };
const CONTENT_BG  = "#F0F4F8";

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

  // Auto-collapse on tablet, expand on desktop
  useEffect(() => {
    if (isTablet)  setCollapsed(true);
    if (isDesktop) setCollapsed(false);
  }, [isTablet, isDesktop]);

  // Close drawer when viewport grows past mobile
  useEffect(() => {
    if (!isMobile && mobileDrawerOpen) setMobileDrawerOpen(false);
  }, [isMobile, mobileDrawerOpen]);

  const handleNavigate = useCallback((item) => { onNavigate?.(item); }, [onNavigate]);

  // Widths that the sidebar occupies in the layout (desktop/tablet only)
  const EXPANDED_W  = 256;
  const COLLAPSED_W = 76;
  const railWidth   = isMobile ? 0 : (collapsed ? COLLAPSED_W : EXPANDED_W);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: CONTENT_BG, direction: "rtl" }}>

      {/* ── Desktop / Tablet: permanent rail, part of the flex row ── */}
      {!isMobile && (
        <div style={{
          width: railWidth,
          flexShrink: 0,
          transition: "width 0.22s cubic-bezier(0.22,1,0.36,1)",
          position: "relative",
          zIndex: 20,
        }}>
          {/* sticky wrapper so sidebar stays in view while page scrolls */}
          <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
            <AppSidebar
              activeTabId={activeTabId}
              activeAction={activeAction}
              onNavigate={handleNavigate}
              isAdmin={isAdmin}
              collapsed={collapsed}
              onToggleCollapse={() => setCollapsed(p => !p)}
              mobileOpen={false}
              user={user}
              role={role}
              onSignOut={onSignOut}
              appName={appName}
            />
          </div>
        </div>
      )}

      {/* ── Mobile: portal-style drawer (position:fixed, never in flex flow) ── */}
      {isMobile && (
        <AppSidebar
          activeTabId={activeTabId}
          activeAction={activeAction}
          onNavigate={handleNavigate}
          isAdmin={isAdmin}
          collapsed={false}
          mobileOpen={mobileDrawerOpen}
          onCloseMobile={() => setMobileDrawerOpen(false)}
          user={user}
          role={role}
          onSignOut={onSignOut}
          appName={appName}
        />
      )}

      {/* ── Main column ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <AppTopBar
          showMenuButton={isMobile || isTablet}
          onOpenMobileMenu={() => setMobileDrawerOpen(true)}
          appName={appName}
          appSubtitle={appSubtitle}
          logoUrl={logoUrl}
          schoolCount={schoolCount}
          user={user}
          role={role}
          onSignOut={onSignOut}
          pendingCount={pendingCount}
          search={search}
          onSearchChange={onSearchChange}
        />
        <main style={{
          flex: 1,
          padding: isMobile ? "12px 12px 32px" : "20px 24px 40px",
          maxWidth: "100%",
          overflowX: "hidden",
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}

