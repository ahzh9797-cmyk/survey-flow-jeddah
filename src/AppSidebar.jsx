/**
 * AppSidebar.jsx — Ministry Edition v2
 * - No emoji — SVG icons only (Lucide-style inline SVG)
 * - وزارة التعليم brand colors
 * - Organized: الرئيسية / الاستبيانات / الدليل / التقارير / الإدارة
 * - Mobile drawer: position:fixed, never in flex flow
 * - Collapse toggle on desktop/tablet
 */

import { useState, useRef } from "react";
import { DS } from "./AppShell.jsx";

// ── Inline SVG Icons (Lucide-compatible) ───────────────
const Icon = ({ d, size=16, color="currentColor", strokeWidth=1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink:0, display:"block" }}>
    <path d={d}/>
  </svg>
);

const ICONS = {
  home:         "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  surveys:      "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
  plus:         "M12 5v14M5 12h14",
  template:     "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  school:       "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  users:        "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  user:         "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  chart:        "M18 20V10M12 20V4M6 20v-6",
  report:       "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  library:      "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z",
  review:       "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  mail:         "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  settings:     "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  audit:        "M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z",
  identity:     "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  logout:       "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  chevronLeft:  "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  overview:     "M3 3h7v7H3zM13 3h8v7h-8zM3 13h8v8H3zM13 13h7v3h-7zM13 18h7v3h-7z",
  menu:         "M3 12h18M3 6h18M3 18h18",
};

const SvgIcon = ({ name, size=16, color="currentColor" }) => {
  const d = ICONS[name] || ICONS.surveys;
  return <Icon d={d} size={size} color={color}/>;
};

// ── Nav Sections ────────────────────────────────────────
export const NAV_SECTIONS = [
  {
    id: "main",
    items: [
      { id:"dashboard", label:"الاستبيانات",  icon:"surveys",  tabId:"dashboard" },
      { id:"overview",  label:"لوحة التحكم", icon:"overview", tabId:"overview"  },
    ],
  },
  {
    id: "surveys",
    label: "الاستبيانات",
    items: [
      { id:"surveys-new",  label:"استبيان جديد", icon:"plus",     tabId:"dashboard", action:"new" },
      { id:"templates",    label:"القوالب",       icon:"template", tabId:"templates"  },
      { id:"analytics",    label:"الإحصائيات",   icon:"chart",    tabId:"analytics"  },
    ],
  },
  {
    id: "directory",
    label: "الدليل",
    items: [
      { id:"dir-schools", label:"المدارس",   icon:"school", tabId:"directory" },
      { id:"dir-admins",  label:"المديرون",  icon:"users",  tabId:"directory" },
      { id:"dir-super",   label:"المشرفون",  icon:"user",   tabId:"directory" },
    ],
  },
  {
    id: "reports",
    label: "التقارير والأدوات",
    items: [
      { id:"reports",  label:"التقارير",      icon:"report",  tabId:"reports"        },
      { id:"library",  label:"مكتبة المحتوى", icon:"library", tabId:"library"        },
      { id:"review",   label:"مركز المراجعة", icon:"review",  tabId:"review"         },
      { id:"comms",    label:"الاتصالات",     icon:"mail",    tabId:"communication"  },
    ],
  },
  {
    id: "admin",
    label: "الإدارة",
    adminOnly: true,
    items: [
      { id:"admin-users",    label:"المستخدمون",  icon:"users",    tabId:"more", action:"users"       },
      { id:"admin-super",    label:"المشرفون",    icon:"user",     tabId:"more", action:"supervisors" },
      { id:"admin-audit",    label:"سجل العمليات",icon:"audit",    tabId:"more", action:"auditlog"    },
      { id:"admin-settings", label:"الإعدادات",   icon:"settings", tabId:"more", action:"settings"   },
      { id:"admin-identity", label:"هوية النظام", icon:"identity", tabId:"identity"                  },
    ],
  },
];

// ── Styles ──────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("sb-ministry-styles")) {
  const s = document.createElement("style");
  s.id = "sb-ministry-styles";
  s.textContent = `
    .sb-item { transition: background 0.12s, color 0.12s; border-radius: 8px; }
    .sb-item:hover { background: rgba(255,255,255,0.07); }
    .sb-item.active { background: rgba(0,138,106,0.18); }
    .sb-item.active .sb-label { color: #ffffff; font-weight: 600; }
    .sb-scroll { overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
    .sb-scroll::-webkit-scrollbar { width: 3px; }
    .sb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
    @keyframes sb-slide { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
    @keyframes sb-fade  { from { opacity:0; } to { opacity:1; } }
    .sb-drawer { animation: sb-slide 0.24s cubic-bezier(0.22,1,0.36,1) both; }
    .sb-backdrop { animation: sb-fade 0.18s ease both; }
  `;
  document.head.appendChild(s);
}

// ── NavItem ─────────────────────────────────────────────
function NavItem({ item, isActive, collapsed, onClick }) {
  return (
    <button onClick={() => onClick(item)} className={`sb-item${isActive?" active":""}`}
      title={collapsed ? item.label : undefined}
      style={{
        width:"100%", display:"flex", alignItems:"center",
        gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? "center" : "flex-start",
        padding: collapsed ? "10px 0" : "9px 10px",
        border:"none", background:"transparent", cursor:"pointer",
        color: isActive ? "#ffffff" : "rgba(255,255,255,0.55)",
        position:"relative",
      }}>
      <SvgIcon name={item.icon} size={17} color={isActive?"#ffffff":"rgba(255,255,255,0.55)"}/>
      {!collapsed && (
        <span className="sb-label" style={{ fontSize:13, fontWeight:isActive?600:400, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {item.label}
        </span>
      )}
      {isActive && (
        <span style={{ position:"absolute", right:0, top:"16%", bottom:"16%", width:3, borderRadius:4, background:DS.primary500, display: collapsed?"none":"block" }}/>
      )}
    </button>
  );
}

// ── SidebarContent ──────────────────────────────────────
function SidebarContent({ collapsed, isMobile, activeTabId, activeAction, onItemClick,
                          onToggleCollapse, onCloseMobile, isAdmin, user, role, onSignOut, appName }) {
  const W = isMobile ? 260 : (collapsed ? 64 : 240);

  return (
    <div style={{
      width:W, height:"100%",
      background: "linear-gradient(180deg, #004D3B 0%, #003D2F 60%, #002D22 100%)",
      display:"flex", flexDirection:"column", overflow:"hidden",
      transition: isMobile ? "none" : "width 0.22s cubic-bezier(0.22,1,0.36,1)",
      borderLeft: "1px solid rgba(255,255,255,0.06)",
    }}>

      {/* Brand header */}
      <div style={{
        padding: collapsed&&!isMobile ? "16px 0" : "14px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display:"flex", alignItems:"center",
        justifyContent: collapsed&&!isMobile ? "center" : "flex-start",
        gap:10, flexShrink:0,
      }}>
        {/* Ministry logo placeholder */}
        <div style={{
          width:34, height:34, borderRadius:8, flexShrink:0,
          background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <SvgIcon name="identity" size={18} color="rgba(255,255,255,0.8)"/>
        </div>
        {(!collapsed || isMobile) && (
          <div style={{ overflow:"hidden", flex:1 }}>
            <p style={{ margin:0, fontSize:12, fontWeight:700, color:"#fff", lineHeight:1.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {appName || "منظومة الاستبيانات"}
            </p>
            <p style={{ margin:0, fontSize:10, color:"rgba(255,255,255,0.4)" }}>إدارة التعليم — جدة</p>
          </div>
        )}
        {isMobile && (
          <button onClick={onCloseMobile} style={{
            background:"rgba(255,255,255,0.08)", border:"none", borderRadius:7,
            width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", flexShrink:0,
          }}>
            <SvgIcon name="chevronRight" size={14} color="rgba(255,255,255,0.7)"/>
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      {!isMobile && onToggleCollapse && (
        <button onClick={onToggleCollapse} style={{
          alignSelf: collapsed ? "center" : "flex-end",
          margin: "8px 8px 0",
          background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:6, width:24, height:24, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
        }}>
          <SvgIcon name={collapsed?"chevronLeft":"chevronRight"} size={12} color="rgba(255,255,255,0.5)"/>
        </button>
      )}

      {/* Nav */}
      <div className="sb-scroll" style={{ flex:1, padding:"10px 6px 8px", overflowY:"auto" }}>
        {NAV_SECTIONS.map(section => {
          if (section.adminOnly && !isAdmin) return null;
          return (
            <div key={section.id} style={{ marginBottom:14 }}>
              {section.label && !collapsed && (
                <p style={{
                  margin:"0 0 4px", padding:"0 8px",
                  fontSize:9.5, fontWeight:700, letterSpacing:"0.07em",
                  color:"rgba(255,255,255,0.25)", textTransform:"uppercase",
                }}>
                  {section.label}
                </p>
              )}
              {section.label && collapsed && (
                <div style={{ height:1, background:"rgba(255,255,255,0.08)", margin:"4px 10px 8px" }}/>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                {section.items.map(item => {
                  const isActive = activeTabId===item.tabId &&
                    (item.action ? activeAction===item.action : !item.action || item.tabId===activeTabId);
                  return (
                    <NavItem key={item.id} item={item} isActive={isActive}
                      collapsed={collapsed&&!isMobile} onClick={onItemClick}/>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: collapsed&&!isMobile?"10px 6px":"10px 8px", borderTop:"1px solid rgba(255,255,255,0.08)", flexShrink:0 }}>
        {(!collapsed||isMobile) && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"4px 2px" }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(0,138,106,0.25)", border:"1px solid rgba(0,138,106,0.4)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <SvgIcon name="user" size={13} color="rgba(255,255,255,0.7)"/>
            </div>
            <div style={{ overflow:"hidden", flex:1 }}>
              <p style={{ margin:0, fontSize:11, fontWeight:500, color:"rgba(255,255,255,0.85)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {user?.email || "مستخدم"}
              </p>
              <p style={{ margin:0, fontSize:9.5, color:"rgba(255,255,255,0.35)" }}>
                {role==="admin"?"مدير عام":"مشرف"}
              </p>
            </div>
          </div>
        )}
        <button onClick={onSignOut} style={{
          width:"100%", display:"flex", alignItems:"center",
          gap: collapsed&&!isMobile ? 0 : 7,
          justifyContent: collapsed&&!isMobile ? "center" : "flex-start",
          padding: collapsed&&!isMobile ? "8px 0" : "7px 8px",
          background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.15)",
          borderRadius:8, cursor:"pointer",
        }}>
          <SvgIcon name="logout" size={15} color="#F87171"/>
          {(!collapsed||isMobile) && (
            <span style={{ fontSize:12, fontWeight:500, color:"#F87171" }}>تسجيل الخروج</span>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Export ─────────────────────────────────────────
export default function AppSidebar({
  activeTabId, activeAction, onNavigate, isAdmin,
  collapsed, onToggleCollapse,
  mobileOpen, onCloseMobile,
  user, onSignOut, role,
  appName,
}) {
  const touchStartX = useRef(null);

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 60) onCloseMobile?.();
    touchStartX.current = null;
  }

  function handleItemClick(item) {
    onNavigate(item);
    if (mobileOpen) onCloseMobile?.();
  }

  return (
    <>
      {/* Desktop / Tablet */}
      {onToggleCollapse && (
        <div style={{ width:"100%", height:"100%" }}>
          <SidebarContent
            collapsed={collapsed} isMobile={false}
            activeTabId={activeTabId} activeAction={activeAction}
            onItemClick={handleItemClick} onToggleCollapse={onToggleCollapse}
            isAdmin={isAdmin} user={user} role={role} onSignOut={onSignOut} appName={appName}
          />
        </div>
      )}

      {/* Mobile drawer */}
      {mobileOpen !== undefined && (
        <>
          {mobileOpen && (
            <div className="sb-backdrop" onClick={onCloseMobile} style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9998,
            }}/>
          )}
          <div
            onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
            className={mobileOpen ? "sb-drawer" : undefined}
            style={{
              position:"fixed", top:0, bottom:0, right:0, zIndex:9999, height:"100%",
              transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
              transition: mobileOpen ? "none" : "transform 0.2s cubic-bezier(0.55,0,1,0.45)",
              pointerEvents: mobileOpen ? "auto" : "none",
            }}>
            <SidebarContent
              collapsed={false} isMobile={true}
              activeTabId={activeTabId} activeAction={activeAction}
              onItemClick={handleItemClick} onCloseMobile={onCloseMobile}
              isAdmin={isAdmin} user={user} role={role} onSignOut={onSignOut} appName={appName}
            />
          </div>
        </>
      )}
    </>
  );
}
