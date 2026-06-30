/**
 * AppShell.jsx
 * Phase 1 — Application Shell.
 *
 * Combines AppSidebar + AppTopBar + main content area, and owns the
 * responsive behaviour (desktop permanent rail / tablet collapsible
 * rail / mobile drawer) entirely on its own via a window-resize
 * listener — no external responsive library needed.
 *
 * This component is NOT yet wired into App.jsx. It is a standalone,
 * fully self-contained layout primitive ready for Phase 2, where
 * App.jsx's existing pages get moved to render as `children` of
 * this shell instead of inside the old bottom-nav layout.
 *
 * Usage (Phase 2 preview — not applied yet):
 *
 *   <AppShell
 *     activeTabId={tab}
 *     activeAction={modal?.type}
 *     onNavigate={(item) => { setTab(item.tabId); if (item.action) setModal({type:item.action}); }}
 *     isAdmin={isAdmin}
 *     user={user}
 *     role={role}
 *     onSignOut={() => supabase.auth.signOut()}
 *     schoolCount={schoolCount}
 *     pendingCount={pendingCount}
 *     appName={settings.app_name}
 *     appSubtitle={settings.app_subtitle}
 *     logoUrl={settings.logo_url}
 *   >
 *     { tab==="dashboard" && <ExecutiveDashboard .../> }
 *     ... (existing page content, unchanged)
 *   </AppShell>
 */

import { useState, useEffect, useCallback } from "react";
import AppSidebar from "./AppSidebar.jsx";
import AppTopBar from "./AppTopBar.jsx";

const BREAKPOINTS = {
  mobile: 768,   // < 768px  → drawer
  tablet: 1024,  // 768–1023 → collapsible rail, default collapsed
  // ≥1024            → permanent rail, default expanded
};

const CONTENT_BG = "#F0F4F8";

function useViewport() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);

  useEffect(() => {
    let raf = null;
    function onResize() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const isMobile = width < BREAKPOINTS.mobile;
  const isTablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.tablet;

  return { width, isMobile, isTablet, isDesktop };
}

export default function AppShell({
  // Navigation state (driven by parent App.jsx in Phase 2)
  activeTabId,
  activeAction,
  onNavigate,
  isAdmin,

  // Identity / branding
  user,
  role,
  onSignOut,
  schoolCount,
  pendingCount,
  appName,
  appSubtitle,
  logoUrl,

  // Optional controlled search (wired later, no-op safe today)
  search,
  onSearchChange,

  // Page content
  children,
}) {
  const { isMobile, isTablet, isDesktop } = useViewport();

  // Collapse state — only meaningful on tablet/desktop.
  // Defaults: tablet starts collapsed (icon rail) to save space;
  // desktop starts expanded for the full enterprise look.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (isTablet) setCollapsed(true);
    if (isDesktop) setCollapsed(false);
  }, [isTablet, isDesktop]);

  // Close the mobile drawer automatically if the viewport grows
  // past mobile (e.g. device rotation, browser resize on a tablet).
  useEffect(() => {
    if (!isMobile && mobileDrawerOpen) setMobileDrawerOpen(false);
  }, [isMobile, mobileDrawerOpen]);

  const handleNavigate = useCallback((item) => {
    onNavigate?.(item);
  }, [onNavigate]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: CONTENT_BG, direction: "rtl" }}>
      {/* Sidebar — desktop/tablet render the permanent rail inline;
          mobile renders nothing here (drawer is portal-style fixed) */}
      {!isMobile && (
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
      )}

      {/* Mobile drawer — rendered regardless of isMobile state check
          internally via `mobileOpen`, so it can animate closed too */}
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

      {/* Main column: top bar + content */}
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
          padding: isMobile ? "0 0 24px" : "20px 24px 32px",
          maxWidth: "100%",
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}

