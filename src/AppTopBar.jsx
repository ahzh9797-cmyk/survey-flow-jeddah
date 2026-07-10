/**
 * AppTopBar.jsx — Ministry Edition v2
 * - No emoji
 * - SVG icons (Lucide inline)
 * - وزارة التعليم header style
 * - Sticky, accessible, RTL
 */

import { useState } from "react";
import { DS } from "./AppShell.jsx";

const Icon = ({ d, size=16, color="currentColor", strokeWidth=1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink:0, display:"block" }}>
    <path d={d}/>
  </svg>
);

const ICONS = {
  search:  "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  bell:    "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  menu:    "M3 12h18M3 6h18M3 18h18",
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  x:       "M18 6 6 18M6 6l12 12",
};

if (typeof document !== "undefined" && !document.getElementById("topbar-ministry-styles")) {
  const s = document.createElement("style");
  s.id = "topbar-ministry-styles";
  s.textContent = `
    .tb-search-input:focus {
      border-color: #006B54 !important;
      box-shadow: 0 0 0 3px rgba(0,107,84,0.10) !important;
      outline: none;
    }
    .tb-icon-btn {
      transition: background 0.12s;
      border: none; background: none; cursor: pointer;
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .tb-icon-btn:hover { background: #F1F5F9; }
  `;
  document.head.appendChild(s);
}

export default function AppTopBar({
  showMenuButton, onOpenMobileMenu,
  appName, appSubtitle, logoUrl,
  schoolCount, user, role, onSignOut,
  pendingCount = 0,
  search = "", onSearchChange,
}) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);

  return (
    <header style={{
      background: DS.white,
      borderBottom: `1px solid ${DS.n200}`,
      height: 56,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 16px",
      position: "sticky",
      top: 0,
      zIndex: 100,
      flexShrink: 0,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>

      {/* Hamburger — mobile/tablet */}
      {showMenuButton && (
        <button className="tb-icon-btn" onClick={onOpenMobileMenu} aria-label="القائمة">
          <Icon d={ICONS.menu} size={20} color={DS.n600}/>
        </button>
      )}

      {/* Brand — shown on mobile */}
      {showMenuButton && !searchOpen && (
        <div style={{ flex:1, overflow:"hidden" }}>
          <p style={{ margin:0, fontSize:13, fontWeight:700, color:DS.n900, lineHeight:1.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {appName || "منظومة الاستبيانات"}
          </p>
          {schoolCount != null && (
            <p style={{ margin:0, fontSize:9.5, color:DS.n400 }}>
              {Number(schoolCount).toLocaleString("ar-SA")} مدرسة
            </p>
          )}
        </div>
      )}

      {/* Search bar — desktop always visible, mobile toggle */}
      {(!showMenuButton || searchOpen) && (
        <div style={{ flex:1, maxWidth:380, position:"relative" }}>
          <div style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
            <Icon d={ICONS.search} size={15} color={DS.n400}/>
          </div>
          <input
            className="tb-search-input"
            value={search}
            onChange={e => onSearchChange?.(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => { setSearchFocused(false); if (!search) setSearchOpen(false); }}
            placeholder="بحث..."
            style={{
              width:"100%",
              padding:"8px 34px 8px 12px",
              border:`1.5px solid ${searchFocused ? DS.primary : DS.n200}`,
              borderRadius: DS.r10,
              fontSize: 13,
              background: DS.n50,
              color: DS.n900,
              direction:"rtl",
              transition:"border-color 0.15s, box-shadow 0.15s",
            }}
          />
          {search && (
            <button onClick={()=>{ onSearchChange?.(""); }} style={{
              position:"absolute", left:8, top:"50%", transform:"translateY(-50%)",
              background:"none", border:"none", cursor:"pointer", padding:2,
            }}>
              <Icon d={ICONS.x} size={13} color={DS.n400}/>
            </button>
          )}
        </div>
      )}

      {/* Right actions */}
      <div style={{ display:"flex", alignItems:"center", gap:4, marginRight:"auto" }}>

        {/* Search toggle — mobile only */}
        {showMenuButton && !searchOpen && (
          <button className="tb-icon-btn" onClick={()=>setSearchOpen(true)} aria-label="بحث">
            <Icon d={ICONS.search} size={18} color={DS.n500}/>
          </button>
        )}

        {/* Notifications */}
        <button className="tb-icon-btn" aria-label="الإشعارات" style={{ position:"relative" }}>
          <Icon d={ICONS.bell} size={18} color={DS.n500}/>
          {pendingCount > 0 && (
            <span style={{
              position:"absolute", top:5, left:5,
              background:DS.danger, color:"#fff",
              borderRadius:"50%", width:16, height:16,
              fontSize:9, fontWeight:700,
              display:"flex", alignItems:"center", justifyContent:"center",
              border:`2px solid ${DS.white}`,
            }}>{pendingCount > 9 ? "9+" : pendingCount}</span>
          )}
        </button>

        {/* Avatar */}
        <div style={{
          width:32, height:32, borderRadius:"50%", flexShrink:0,
          background:DS.primary50, border:`2px solid ${DS.primary100}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"default",
        }} title={user?.email || ""}>
          <Icon d={ICONS.user} size={15} color={DS.primary600}/>
        </div>
      </div>
    </header>
  );
}

