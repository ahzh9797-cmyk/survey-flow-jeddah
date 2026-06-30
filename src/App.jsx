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
import PWAInstallBanner from "./PWAInstallBanner.jsx";
import PWAUpdateBanner from "./PWAUpdateBanner.jsx";
import ContentLibrary from "./ContentLibrary.jsx";
import ReviewCenter, { ReviewPreviewPage } from "./ReviewCenter.jsx";
import AppShell from "./AppShell.jsx";

// ── Premium styles injection ──────────────────────────
if (typeof document !== "undefined" && !document.getElementById("app-premium-styles")) {
  const s = document.createElement("style");
  s.id = "app-premium-styles";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { font-family: 'Tajawal','Segoe UI',Tahoma,Arial,sans-serif !important; background:#F0F4F8; margin:0; }
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

// ── Settings Menu Item — unchanged, used inside the "more" page ──
function SettingsItem({ icon, title, sub, accent, badge, onClick }) {
  return (
    <div onClick={onClick} className="modal-action-card"
      style={{
        background:T.white, borderRadius:16, border:`1px solid ${T.slate200}`,
        padding:"14px 16px", marginBottom:10, cursor:"pointer",
        display:"flex", alignItems:"center", gap:14,
        boxShadow:"0 2px 8px rgba(0,0,0,0.05)", borderRight:`4px solid ${accent}`,
      }}>
      <div style={{
        width:46, height:46, background:`${accent}15`, borderRadius:13,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0,
      }}>{icon}</div>
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

// ── Modal overlay wrapper — unchanged ──────────────────
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
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const { surveys, loading: loadingSurveys, refetch } = useSurveys();
  const schoolCount = useSchoolCount();
  const { role, isAdmin, roleError } = useUserRole(user);
  const pendingCount = usePendingCount(isAdmin);
  const { settings } = useAppSettings();
  const [deleteSurveyTarget, setDeleteSurveyTarget] = useState(null);
  const [saveAsTemplateTarget, setSaveAsTemplateTarget] = useState(null);

  // ── All handlers preserved exactly — zero logic changes ──
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
  const reviewToken = params.get("review");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setAuthChecked(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  // ────────────────────────────────────────────────────

  // ── Standalone routes (unchanged — no shell, no nav) ──
  if (reviewToken) {
    return <ReviewPreviewPage token={reviewToken} surveys={surveys}/>;
  }

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

  // ── Full-screen takeover modals (unchanged — these intentionally
  //    render outside the shell, exactly as before, since they are
  //    focused single-task flows, not browsing screens) ──
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
      <div style={{ paddingBottom:24 }}>
        <NewSurveyPage onSaved={()=>{ refetch(); setModal(null); }} onCancel={()=>setModal(null)}
          user={user} isAdmin={isAdmin}
          initialQuestions={modal.fromTemplate?.questions}
          initialSurveyType={modal.fromTemplate?.survey_type}/>
      </div>
    );
  }

  if (modal?.type === "edit") {
    return (
      <div style={{ paddingBottom:24 }}>
        <NewSurveyPage existingSurvey={modal.data}
          onSaved={()=>{ refetch(); setModal(null); }} onCancel={()=>setModal(null)}
          user={user} isAdmin={isAdmin}/>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={setUser}/>;

  if (role === null) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={36}/></div>;

  // ══════════════════════════════════════════════════════
  // PHASE 2: Sidebar navigation wiring
  //
  // AppSidebar items carry { tabId, action } pairs (see
  // AppSidebar.jsx → NAV_SECTIONS). This handler is the single
  // place that translates a sidebar click into the exact same
  // tab/modal state changes the old bottom-nav + "more" menu used
  // to perform — no new routing concepts, no logic changes.
  // ══════════════════════════════════════════════════════
  function handleSidebarNavigate(item) {
    if (item.action === "new") {
      setTab("surveys");
      setModal({ type:"new" });
      return;
    }
    if (item.tabId === "more" && item.action) {
      setModal({ type:item.action });
      return;
    }
    setModal(null);
    setTab(item.tabId);
  }

  return (
    <AppShell
      activeTabId={tab}
      activeAction={modal?.type}
      onNavigate={handleSidebarNavigate}
      isAdmin={isAdmin}
      user={user}
      role={role}
      onSignOut={()=>supabase.auth.signOut()}
      schoolCount={schoolCount}
      pendingCount={pendingCount}
      appName={settings.app_name}
      appSubtitle={settings.app_subtitle}
      logoUrl={settings.logo_url}
    >
      <div className="page-enter">
        <PWAInstallBanner />
        <PWAUpdateBanner />

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
        {tab==="library"       && <ContentLibrary user={user}/>}
        {tab==="review"        && <ReviewCenter surveys={surveys} user={user}/>}

        {/* "more" landing page — kept for direct tab access (e.g. if
            a future deep-link sets tab="more"); the sidebar's admin
            section now routes straight to each sub-page via modal,
            but this view still works exactly as it did before. */}
        {tab==="more" && isAdmin && (
          <div style={{ padding: 0 }}>
            <div style={{ marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, color:T.slate900, fontWeight:800 }}>الإعدادات</h2>
              <p style={{ margin:"4px 0 0", fontSize:12, color:T.slate500 }}>إدارة النظام والصلاحيات</p>
            </div>
            {[
              { icon:"👥", title:"إدارة المستخدمين", sub:"الصلاحيات والحسابات",        type:"users",       accent:T.emerald700, badge: pendingCount > 0 ? pendingCount : null },
              { icon:"👤", title:"إدارة المشرفين",   sub:"إضافة وإرسال الاستبيانات",   type:"supervisors", accent:"#7B2D8B" },
              { icon:"📜", title:"سجل التدقيق",      sub:"كل عمليات النظام",            type:"auditlog",    accent:T.gold },
              { icon:"🎨", title:"إعدادات التطبيق",  sub:"اللوغو والعناوين والإعدادات", type:"settings",    accent:"#0284C7" },
            ].map(item => (
              <SettingsItem key={item.type} {...item} onClick={()=>setModal({type:item.type})}/>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals — unchanged, render above the shell exactly as before ── */}
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
    </AppShell>
  );
}

