import { useState, useEffect } from "react";
import { supabase, C, Btn, Card, Spinner, InstallAppBanner, RoleBadge,
  useSurveys, useSchoolCount, useUserRole, useAppSettings, usePendingCount,
  logAction } from "./lib.jsx";
import PublicFill from "./PublicFill.jsx";
import TrackingPage, { OpenSurveyTracking } from "./TrackingPage.jsx";
import { SurveysList, NewSurveyPage, ShareSheet, LoginPage, AnalyticsPage,
  SchoolsManagementPage, UsersManagementPage, SupervisorsManagementPage,
  AppSettingsPage, AuditLogPage } from "./Management.jsx";
import DirectoryPage from "./Directory.jsx";
import TemplatesPage, { SaveAsTemplateSheet } from "./TemplatesPage.jsx";
import { checkSurveyAccess } from "./SurveyService.jsx";
import ToastProvider from "./ToastProvider.jsx";
import CommunicationCenter from "./CommunicationCenter.jsx";
import ReportingCenter from "./ReportingCenter.jsx";
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";

// ── Premium styles injection ──────────────────────────
if (typeof document !== "undefined" && !document.getElementById("app-premium-styles")) {
  const s = document.createElement("style");
  s.id = "app-premium-styles";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { font-family: 'Tajawal','Segoe UI',Tahoma,Arial,sans-serif !important; background:#F0F4F8; margin:0; }
    .nav-btn { transition: color 0.2s ease, transform 0.15s ease; }
    .nav-btn:active { transform: scale(0.92); }
    .nav-icon { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), filter 0.2s ease; }
    .nav-btn.active .nav-icon { transform: scale(1.15) translateY(-2px); }
    .card-hover { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .card-hover:active { transform: scale(0.98); }
    .modal-action-card { transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
    .modal-action-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,107,84,0.15) !important; }
    .modal-action-card:active { transform: scale(0.97); }
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    .page-enter { animation: fadeSlideUp 0.3s cubic-bezier(0.22,1,0.36,1) both; }
    @keyframes spin { to { transform: rotate(360deg) } }
  `;
  document.head.appendChild(s);
}

// ── Design tokens ──────────────────────────────────────
const T = {
  emerald900: "#064E3B", emerald800: "#065F46", emerald700: "#047857",
  emerald600: "#059669", emerald500: "#10B981", emerald100: "#D1FAE5",
  gold: "#C9A84C", goldLight: "#FEF3C7",
  slate900: "#0F172A", slate700: "#334155", slate500: "#64748B",
  slate400: "#94A3B8", slate200: "#E2E8F0", slate100: "#F1F5F9",
  white: "#FFFFFF", bg: "#F0F4F8",
  danger: "#DC2626", warn: "#D97706", success: "#059669",
};

// ── Premium Header ─────────────────────────────────────
function PremiumHeader({ settings, role, schoolCount, user, onSignOut }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء النور";
  const dateStr = now.toLocaleDateString("ar-SA", { weekday:"long", day:"numeric", month:"long" });

  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.emerald900} 0%, ${T.emerald800} 60%, #083d2e 100%)`,
      position: "sticky", top: 0, zIndex: 20,
      boxShadow: "0 4px 24px rgba(6,78,59,0.35)",
    }}>
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 12 }}>

          {/* Logo + name */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="logo" style={{
                width:42, height:42, borderRadius:12, objectFit:"contain",
                background:"rgba(255,255,255,0.12)", padding:4,
                border:"1px solid rgba(255,255,255,0.15)",
              }}/>
            ) : (
              <div style={{
                width:42, height:42, borderRadius:12, fontSize:20,
                background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.15)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>📋</div>
            )}
            <div>
              <div style={{ color:"#fff", fontWeight:800, fontSize:15, lineHeight:1.2, letterSpacing:"-0.01em" }}>
                {settings.app_name || "منظومة الاستبيانات"}
              </div>
              <div style={{ color:"rgba(255,255,255,0.55)", fontSize:11, marginTop:2 }}>
                {settings.app_subtitle || "إدارة التعليم — جدة"} · {schoolCount} مدرسة
              </div>
            </div>
          </div>

          {/* User + logout */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{
              background:"rgba(255,255,255,0.1)", borderRadius:10,
              padding:"6px 10px", border:"1px solid rgba(255,255,255,0.15)",
              display:"flex", alignItems:"center", gap:6,
            }}>
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.8)", fontWeight:600 }}>
                {role === "admin" ? "👑" : "👁️"}
              </span>
              <RoleBadge role={role}/>
            </div>
            <button onClick={onSignOut} style={{
              background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)",
              color:"#fff", borderRadius:10, padding:"8px 14px",
              fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:5,
            }}>
              <span>خروج</span>
              <span style={{ fontSize:14, opacity:0.8 }}>→</span>
            </button>
          </div>
        </div>

        {/* Greeting bar */}
        <div style={{
          background:"rgba(255,255,255,0.07)", borderRadius:"12px 12px 0 0",
          padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center",
          border:"1px solid rgba(255,255,255,0.1)", borderBottom:"none",
        }}>
          <div>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#fff" }}>
              {greeting} 👋
            </p>
            <p style={{ margin:"1px 0 0", fontSize:11, color:"rgba(255,255,255,0.5)" }}>
              {dateStr}
            </p>
          </div>
          <div style={{
            background: `linear-gradient(135deg, ${T.gold}, #a8883a)`,
            borderRadius:8, padding:"5px 10px",
          }}>
            <p style={{ margin:0, fontSize:10, color:"#fff", fontWeight:700 }}>🏫 {schoolCount} مدرسة</p>
          </div>
        </div>
      </div>

      {/* Wave separator */}
      <svg viewBox="0 0 375 10" style={{ display:"block", marginBottom:-1 }} preserveAspectRatio="none">
        <path d="M0,0 C120,10 255,10 375,0 L375,10 L0,10 Z" fill={T.bg}/>
      </svg>
    </div>
  );
}

// ── Premium Bottom Nav ─────────────────────────────────
function PremiumNav({ tabs, activeTab, setTab, pendingCount }) {
  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:20,
      paddingBottom:"env(safe-area-inset-bottom)",
    }}>
      {/* floating container */}
      <div style={{
        margin:"0 10px 10px",
        background:"rgba(255,255,255,0.95)",
        backdropFilter:"blur(20px)",
        WebkitBackdropFilter:"blur(20px)",
        borderRadius:20,
        boxShadow:"0 -2px 0 rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.12)",
        border:"1px solid rgba(255,255,255,0.8)",
        display:"flex", overflow:"hidden",
      }}>
        {tabs.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`nav-btn${isActive ? " active" : ""}`}
              style={{
                flex:1, padding:"10px 0 8px", border:"none",
                background: isActive
                  ? `linear-gradient(180deg, ${T.emerald600}10 0%, transparent 100%)`
                  : "transparent",
                cursor:"pointer", display:"flex", flexDirection:"column",
                alignItems:"center", gap:2, position:"relative",
                fontFamily:"inherit",
              }}>
              {/* active indicator */}
              {isActive && (
                <span style={{
                  position:"absolute", top:0, left:"50%",
                  transform:"translateX(-50%)",
                  width:28, height:3,
                  background:`linear-gradient(90deg, ${T.emerald600}, ${T.emerald500})`,
                  borderRadius:"0 0 6px 6px",
                  boxShadow:`0 2px 8px ${T.emerald600}50`,
                }}/>
              )}

              <span
                className="nav-icon"
                style={{
                  fontSize:21, position:"relative", lineHeight:1,
                  filter: isActive ? "none" : "grayscale(30%) opacity(0.7)",
                }}>
                {item.i}
                {item.id === "more" && pendingCount > 0 && (
                  <span style={{
                    position:"absolute", top:-5, right:-8,
                    background:T.danger, color:"#fff",
                    borderRadius:10, fontSize:8, fontWeight:800,
                    padding:"1px 4px", minWidth:14, textAlign:"center",
                    border:"1.5px solid #fff", lineHeight:1.4,
                  }}>{pendingCount}</span>
                )}
              </span>
              <span style={{
                fontSize:9, fontWeight: isActive ? 800 : 500,
                color: isActive ? T.emerald700 : T.slate400,
                letterSpacing:"0.01em", lineHeight:1,
              }}>{item.l}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Settings Menu Item ─────────────────────────────────
function SettingsItem({ icon, title, sub, accent, badge, onClick }) {
  return (
    <div onClick={onClick} className="modal-action-card"
      style={{
        background:T.white, borderRadius:16, border:`1px solid ${T.slate200}`,
        padding:"14px 16px", marginBottom:10, cursor:"pointer",
        display:"flex", alignItems:"center", gap:14,
        boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
        borderRight:`4px solid ${accent}`,
      }}>
      <div style={{
        width:46, height:46, background:`${accent}15`, borderRadius:13,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:22, flexShrink:0,
      }}>
        {icon}
      </div>
      <div style={{ flex:1 }}>
        <p style={{ margin:0, fontSize:14, fontWeight:700, color:T.slate900 }}>{title}</p>
        <p style={{ margin:"2px 0 0", fontSize:12, color:T.slate500 }}>{sub}</p>
      </div>
      {badge && (
        <span style={{
          background:T.danger, color:"#fff", borderRadius:20,
          fontSize:11, fontWeight:800, padding:"3px 10px",
          boxShadow:"0 2px 8px rgba(220,38,38,0.35)",
        }}>{badge} 🔔</span>
      )}
      <span style={{ color:T.slate400, fontSize:16, flexShrink:0 }}>‹</span>
    </div>
  );
}

// ── Modal overlay wrapper ──────────────────────────────
function ModalPage({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:T.bg, zIndex:50, overflowY:"auto" }}>
      <div style={{
        background:`linear-gradient(135deg, ${T.emerald800}, ${T.emerald900})`,
        padding:"14px 16px", display:"flex", alignItems:"center", gap:12,
        position:"sticky", top:0, zIndex:5,
        boxShadow:"0 2px 12px rgba(6,78,59,0.3)",
      }}>
        <button onClick={onClose} style={{
          background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.2)",
          color:"#fff", borderRadius:10, width:36, height:36,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, cursor:"pointer",
        }}>←</button>
        <span style={{ color:"#fff", fontWeight:800, fontSize:15 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("surveys");
  const [modal, setModal] = useState(null);
  const { surveys, loading: loadingSurveys, refetch } = useSurveys();
  const schoolCount = useSchoolCount();
  const { role, isAdmin, roleError } = useUserRole(user);
  const pendingCount = usePendingCount(isAdmin);
  const { settings } = useAppSettings();
  const [deleteSurveyTarget, setDeleteSurveyTarget] = useState(null);
  const [saveAsTemplateTarget, setSaveAsTemplateTarget] = useState(null);

  // ── All handlers preserved exactly ──────────────────
  async function deleteSurvey(s) {
    await supabase.from("survey_questions").delete().eq("survey_id", s.id);
    await supabase.from("survey_responses").delete().eq("survey_id", s.id);
    await supabase.from("surveys").delete().eq("id", s.id);
    logAction({ user, action:"delete", table:"surveys", recordId:s.id, recordLabel:s.title });
    refetch();
    setDeleteSurveyTarget(null);
  }

  async function approveSurvey(s) {
    await supabase.from("surveys").update({ approval_status:"approved" }).eq("id", s.id);
    logAction({ user, action:"update", table:"surveys", recordId:s.id, recordLabel:`اعتماد: ${s.title}` });
    refetch();
  }

  const params = new URLSearchParams(window.location.search);
  const publicSurveyId = params.get("survey");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setAuthChecked(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  // ────────────────────────────────────────────────────

  if (publicSurveyId) {
    const survey = surveys.find(s => s.id === publicSurveyId);
    if (loadingSurveys) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={32}/></div>;
    if (!survey) return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", direction:"rtl", padding:24, textAlign:"center" }}>
        <p style={{ color:C.muted }}>الاستبيان غير موجود أو غير نشط</p>
      </div>
    );
    return <PublicFill survey={survey} onBack={()=>{}}/>;
  }

  if (!authChecked) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={32}/></div>;

  if (modal?.type === "tracking") return <TrackingPage survey={modal.data} onBack={()=>setModal(null)}/>;

  if (modal?.type === "new") {
    if (!modal.choiceMade) {
      return (
        <div style={{ minHeight:"100vh", background:T.bg, direction:"rtl", display:"flex",
          flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ fontSize:44, marginBottom:14 }}>📋</div>
          <h2 style={{ margin:"0 0 6px", fontSize:19, color:T.slate900, fontWeight:800 }}>استبيان جديد</h2>
          <p style={{ margin:"0 0 28px", fontSize:13, color:T.slate500 }}>اختر طريقة الإنشاء</p>
          <div style={{ width:"100%", maxWidth:360, display:"flex", flexDirection:"column", gap:12 }}>
            <button onClick={()=>setModal({type:"new", choiceMade:true, fromTemplate:null})}
              className="modal-action-card"
              style={{ background:T.white, border:`2px solid ${T.emerald600}`, borderRadius:18,
                padding:"20px", cursor:"pointer", fontFamily:"inherit", textAlign:"right",
                boxShadow:"0 4px 20px rgba(5,150,105,0.15)" }}>
              <div style={{ fontSize:30, marginBottom:8 }}>📝</div>
              <div style={{ fontSize:15, fontWeight:800, color:T.slate900 }}>استبيان فارغ</div>
              <div style={{ fontSize:12, color:T.slate500, marginTop:4 }}>ابدأ من الصفر وأضف أسئلتك</div>
            </button>
            <button onClick={()=>{ setModal(null); setTab("templates"); }}
              className="modal-action-card"
              style={{ background:T.white, border:`2px solid ${T.slate200}`, borderRadius:18,
                padding:"20px", cursor:"pointer", fontFamily:"inherit", textAlign:"right",
                boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize:30, marginBottom:8 }}>🗂️</div>
              <div style={{ fontSize:15, fontWeight:800, color:T.slate900 }}>من قالب</div>
              <div style={{ fontSize:12, color:T.slate500, marginTop:4 }}>اختر قالباً جاهزاً وعدّله</div>
            </button>
            <button onClick={()=>setModal(null)}
              style={{ background:"none", border:"none", color:T.slate400, fontSize:13,
                cursor:"pointer", fontFamily:"inherit", padding:"10px 0", textAlign:"center" }}>
              إلغاء
            </button>
          </div>
        </div>
      );
    }
    return (
      <div style={{ paddingBottom:100 }}>
        <NewSurveyPage onSaved={()=>{ refetch(); setModal(null); }} onCancel={()=>setModal(null)}
          user={user} isAdmin={isAdmin}
          initialQuestions={modal.fromTemplate?.questions}
          initialSurveyType={modal.fromTemplate?.survey_type}/>
      </div>
    );
  }

  if (modal?.type === "edit") {
    return (
      <div style={{ paddingBottom:100 }}>
        <NewSurveyPage existingSurvey={modal.data}
          onSaved={()=>{ refetch(); setModal(null); }} onCancel={()=>setModal(null)}
          user={user} isAdmin={isAdmin}/>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={setUser}/>;

  if (role === null) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={36}/></div>;

  const TABS = [
    {id:"dashboard",     i:"🏠", l:"الرئيسية"},
    {id:"surveys",       i:"📋", l:"الاستبيانات"},
    {id:"directory",     i:"📁", l:"الدليل"},
    {id:"templates",     i:"🗂️", l:"القوالب"},
    {id:"analytics",     i:"📊", l:"إحصائيات"},
    {id:"communication", i:"📨", l:"الاتصالات"},
    {id:"reports",       i:"📈", l:"التقارير"},
    ...(isAdmin ? [{id:"more", i:"⚙️", l:"المزيد"}] : []),
  ];

  return (
    <div style={{ minHeight:"100vh", background:T.bg, direction:"rtl",
      fontFamily:"'Tajawal','Segoe UI',Tahoma,Arial,sans-serif" }}>

      <PremiumHeader
        settings={settings} role={role} schoolCount={schoolCount}
        user={user} onSignOut={()=>supabase.auth.signOut()}/>

      <div style={{ paddingBottom:100 }} className="page-enter">
        {tab==="dashboard" && (
          <ExecutiveDashboard surveys={surveys} schoolCount={schoolCount} onNavigate={setTab} user={user}/>
        )}
        {tab==="surveys" && <InstallAppBanner/>}
        {tab==="surveys" && (
          <SurveysList surveys={surveys} loading={loadingSurveys} schoolCount={schoolCount} isAdmin={isAdmin}
            onNew={()=>setModal({type:"new"})}
            onShare={s=>setModal({type:"share",data:s})}
            onTrack={s=>setModal({type:"tracking",data:s})}
            onEdit={s=>setModal({type:"edit",data:s})}
            onDelete={s=>setDeleteSurveyTarget(s)}
            onApprove={approveSurvey}
            onSaveAsTemplate={s=>setSaveAsTemplateTarget(s)}
            onLifecycleChange={refetch}
            user={user}/>
        )}
        {tab==="directory"     && <DirectoryPage user={user} isAdmin={isAdmin}/>}
        {tab==="templates"     && (
          <TemplatesPage user={user} isAdmin={isAdmin}
            onUseTemplate={t=>setModal({type:"new", choiceMade:true, fromTemplate:t})}/>
        )}
        {tab==="analytics"     && <AnalyticsPage surveys={surveys} onNavigate={setTab}/>}
        {tab==="communication" && <CommunicationCenter surveys={surveys} user={user} isAdmin={isAdmin}/>}
        {tab==="reports"       && <ReportingCenter surveys={surveys} user={user} schoolCount={schoolCount}/>}

        {tab==="more" && isAdmin && (
          <div style={{ padding:16 }}>
            {/* Settings header */}
            <div style={{ marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, color:T.slate900, fontWeight:800 }}>الإعدادات</h2>
              <p style={{ margin:"4px 0 0", fontSize:12, color:T.slate500 }}>إدارة النظام والصلاحيات</p>
            </div>

            {[
              { icon:"👥", title:"إدارة المستخدمين", sub:"الصلاحيات والحسابات",        type:"users",    accent:T.emerald700, badge: pendingCount > 0 ? pendingCount : null },
              { icon:"👤", title:"إدارة المشرفين",   sub:"إضافة وإرسال الاستبيانات",   type:"supervisors", accent:"#7B2D8B" },
              { icon:"📜", title:"سجل التدقيق",      sub:"كل عمليات النظام",            type:"auditlog", accent:T.gold },
              { icon:"🎨", title:"إعدادات التطبيق",  sub:"اللوغو والعناوين والإعدادات", type:"settings", accent:"#0284C7" },
            ].map(item => (
              <SettingsItem key={item.type} {...item} onClick={()=>setModal({type:item.type})}/>
            ))}

            {/* Install card */}
            <div style={{
              background:`linear-gradient(135deg, ${T.emerald800}, ${T.emerald900})`,
              borderRadius:18, padding:18, marginTop:6,
              border:`1px solid ${T.emerald700}40`,
            }}>
              <p style={{ margin:"0 0 10px", fontSize:14, fontWeight:800, color:"#fff" }}>📲 تثبيت التطبيق</p>
              <p style={{ margin:"0 0 6px", fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:1.8 }}>
                <strong style={{color:"#fff"}}>آيفون:</strong> Safari ← زر المشاركة ← "إضافة إلى الشاشة الرئيسية"
              </p>
              <p style={{ margin:0, fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:1.8 }}>
                <strong style={{color:"#fff"}}>أندرويد:</strong> ستظهر رسالة تثبيت تلقائياً
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Premium bottom nav */}
      <PremiumNav tabs={TABS} activeTab={tab} setTab={setTab} pendingCount={pendingCount}/>

      {/* ── Modals (logic unchanged) ── */}
      {modal?.type==="share" && <ShareSheet survey={modal.data} onClose={()=>setModal(null)}/>}

      {modal?.type==="users" && isAdmin && (
        <ModalPage title="إدارة المستخدمين" onClose={()=>setModal(null)}>
          <UsersManagementPage currentUser={user}/>
        </ModalPage>
      )}
      {modal?.type==="auditlog" && isAdmin && (
        <ModalPage title="سجل التدقيق" onClose={()=>setModal(null)}>
          <AuditLogPage/>
        </ModalPage>
      )}
      {modal?.type==="supervisors" && isAdmin && (
        <ModalPage title="إدارة المشرفين" onClose={()=>setModal(null)}>
          <SupervisorsManagementPage user={user}/>
        </ModalPage>
      )}
      {modal?.type==="settings" && isAdmin && (
        <ModalPage title="إعدادات التطبيق" onClose={()=>setModal(null)}>
          <AppSettingsPage onSaved={()=>setModal(null)}/>
        </ModalPage>
      )}

      {saveAsTemplateTarget && (
        <SaveAsTemplateSheet survey={saveAsTemplateTarget} user={user} isAdmin={isAdmin}
          onSaved={()=>setSaveAsTemplateTarget(null)} onClose={()=>setSaveAsTemplateTarget(null)}/>
      )}

      {deleteSurveyTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:100,
          display:"flex", alignItems:"center", justifyContent:"center", padding:20, direction:"rtl" }}>
          <div style={{ background:T.white, borderRadius:20, padding:24, width:"100%", maxWidth:360,
            boxShadow:"0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>🗑️</div>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:T.slate900 }}>حذف الاستبيان؟</p>
              <p style={{ margin:"6px 0 0", fontSize:13, fontWeight:700, color:T.danger }}>
                {deleteSurveyTarget.title}
              </p>
              <p style={{ margin:"8px 0 0", fontSize:12, color:T.slate500, lineHeight:1.6 }}>
                سيُحذف الاستبيان وجميع إجاباته بشكل نهائي ولا يمكن التراجع.
              </p>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <Btn full variant="secondary" onClick={()=>setDeleteSurveyTarget(null)}>إلغاء</Btn>
              <Btn full variant="danger" onClick={()=>deleteSurvey(deleteSurveyTarget)}>🗑️ حذف نهائياً</Btn>
            </div>
          </div>
        </div>
      )}

      <ToastProvider/>
    </div>
  );
}

