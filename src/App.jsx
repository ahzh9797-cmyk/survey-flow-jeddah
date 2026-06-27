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

  // check public survey link: ?survey=uuid
  const params = new URLSearchParams(window.location.search);
  const publicSurveyId = params.get("survey");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setAuthChecked(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // public survey fill mode — works WITHOUT login
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
        <div style={{ minHeight:"100vh", background:C.bg, direction:"rtl", display:"flex",
          flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
          <h2 style={{ margin:"0 0 6px", fontSize:18, color:C.dark, fontWeight:800 }}>استبيان جديد</h2>
          <p style={{ margin:"0 0 28px", fontSize:13, color:C.muted }}>اختر طريقة الإنشاء</p>
          <div style={{ width:"100%", maxWidth:360, display:"flex", flexDirection:"column", gap:12 }}>
            <button
              onClick={()=>setModal({type:"new", choiceMade:true, fromTemplate:null})}
              style={{ background:C.white, border:`2px solid ${C.primary}`, borderRadius:16,
                padding:"18px 20px", cursor:"pointer", fontFamily:"inherit", textAlign:"right",
                boxShadow:"0 2px 12px rgba(0,107,84,0.1)" }}>
              <div style={{ fontSize:28, marginBottom:6 }}>📝</div>
              <div style={{ fontSize:15, fontWeight:800, color:C.dark }}>استبيان فارغ</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>ابدأ من الصفر وأضف أسئلتك</div>
            </button>
            <button
              onClick={()=>{ setModal(null); setTab("templates"); }}
              style={{ background:C.white, border:`2px solid ${C.border}`, borderRadius:16,
                padding:"18px 20px", cursor:"pointer", fontFamily:"inherit", textAlign:"right" }}>
              <div style={{ fontSize:28, marginBottom:6 }}>🗂️</div>
              <div style={{ fontSize:15, fontWeight:800, color:C.dark }}>من قالب</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>اختر قالباً جاهزاً وعدّله</div>
            </button>
            <button onClick={()=>setModal(null)}
              style={{ background:"none", border:"none", color:C.muted, fontSize:13,
                cursor:"pointer", fontFamily:"inherit", padding:"8px 0", textAlign:"center" }}>
              إلغاء
            </button>
          </div>
        </div>
      );
    }
    return (
      <div style={{ paddingBottom:80 }}>
        <NewSurveyPage
          onSaved={()=>{ refetch(); setModal(null); }}
          onCancel={()=>setModal(null)}
          user={user}
          isAdmin={isAdmin}
          initialQuestions={modal.fromTemplate?.questions}
          initialSurveyType={modal.fromTemplate?.survey_type}
        />
      </div>
    );
  }

  if (modal?.type === "edit") {
    return (
      <div style={{ paddingBottom:80 }}>
        <NewSurveyPage
          existingSurvey={modal.data}
          onSaved={()=>{ refetch(); setModal(null); }}
          onCancel={()=>setModal(null)}
          user={user} isAdmin={isAdmin}/>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={setUser}/>;

  // role still loading (null) — brief spinner to avoid flash of wrong permissions
  if (role === null) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={36}/></div>;

  const TABS = [
    {id:"surveys",   i:"📋", l:"الاستبيانات"},
    {id:"directory", i:"📁", l:"الدليل"},
    {id:"templates",      i:"🗂️", l:"القوالب"},
    {id:"analytics",     i:"📊", l:"إحصائيات"},
    {id:"communication", i:"📨", l:"الاتصالات"},
    {id:"reports",       i:"📈", l:"التقارير"},
    ...(isAdmin ? [{id:"more",i:"⚙️",l:"المزيد"}] : []),
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, direction:"rtl", fontFamily:"'Tajawal','Segoe UI',Tahoma,Arial,sans-serif" }}>

      {/* ── الهيدر ── */}
      <div style={{
        background:`linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
        padding:"0 16px", color:"#fff",
        position:"sticky", top:0, zIndex:10,
        boxShadow:"0 2px 16px rgba(0,107,84,0.25)"
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:12, paddingBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="logo"
                style={{ width:40, height:40, borderRadius:10, objectFit:"contain",
                  background:"rgba(255,255,255,0.15)", padding:4, backdropFilter:"blur(4px)" }}/>
            ) : (
              <div style={{ width:40, height:40, background:"rgba(255,255,255,0.15)", borderRadius:10,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:20,
                backdropFilter:"blur(4px)", border:"1px solid rgba(255,255,255,0.2)" }}>📋</div>
            )}
            <div>
              <div style={{ fontWeight:800, fontSize:16, display:"flex", alignItems:"center", gap:8, letterSpacing:"-0.01em" }}>
                {settings.app_name || "منظومة الاستبيانات"}
                <RoleBadge role={role}/>
              </div>
              <div style={{ fontSize:11, opacity:0.75, marginTop:2, fontWeight:500 }}>
                {settings.app_subtitle || "إدارة التعليم — جدة"} · {schoolCount} مدرسة
              </div>
            </div>
          </div>
          <button onClick={()=>supabase.auth.signOut()} style={{
            background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.25)",
            color:"#fff", borderRadius:10, padding:"8px 16px", fontSize:13, cursor:"pointer",
            fontFamily:"inherit", fontWeight:600, backdropFilter:"blur(4px)",
            transition:"background 0.15s"
          }}>خروج</button>
        </div>
        <svg viewBox="0 0 375 12" style={{ display:"block", marginBottom:-1 }} preserveAspectRatio="none">
          <path d="M0,0 C100,12 275,12 375,0 L375,12 L0,12 Z" fill={C.bg}/>
        </svg>
      </div>

      <div style={{ paddingBottom:88 }}>
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
        {tab==="directory" && <DirectoryPage user={user} isAdmin={isAdmin}/>}
        {tab==="templates" && (
          <TemplatesPage
            user={user}
            isAdmin={isAdmin}
            onUseTemplate={t => setModal({ type:"new", choiceMade:true, fromTemplate:t })}
          />
        )}
        {tab==="analytics" && <AnalyticsPage surveys={surveys} onNavigate={setTab}/> }
        {tab==="communication" && (
          <CommunicationCenter surveys={surveys} user={user} isAdmin={isAdmin}/>
        )}
        {tab==="reports" && (
          <ReportingCenter surveys={surveys} user={user} schoolCount={schoolCount}/>
        )}
        {tab==="more" && isAdmin && (
          <div style={{ padding:16 }}>
            <h2 style={{ margin:"0 0 16px", fontSize:18, color:C.dark, fontWeight:800 }}>الإعدادات</h2>
            {[
              { icon:"👥", title:"إدارة المستخدمين", sub:"الصلاحيات والحسابات", type:"users", accent:C.primary,
                badge: pendingCount > 0 ? pendingCount : null },
              { icon:"👤", title:"إدارة المشرفين", sub:"إضافة وإرسال الاستبيانات", type:"supervisors", accent:"#7B2D8B" },
              { icon:"📜", title:"سجل التدقيق", sub:"كل عمليات النظام", type:"auditlog", accent:C.accent },
              { icon:"🎨", title:"إعدادات التطبيق", sub:"اللوغو والعناوين", type:"settings", accent:C.primaryLight },
            ].map(item => (
              <div key={item.type} onClick={()=>setModal({type:item.type})}
                className="card-hover"
                style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`,
                  padding:"14px 16px", marginBottom:10, cursor:"pointer",
                  display:"flex", alignItems:"center", gap:14,
                  boxShadow:"0 2px 8px rgba(0,0,0,0.06)",
                  borderRight:`4px solid ${item.accent}` }}>
                <div style={{ width:44, height:44, background:`${item.accent}15`, borderRadius:12,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                  {item.icon}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark }}>{item.title}</p>
                  <p style={{ margin:"2px 0 0", fontSize:12, color:C.muted }}>{item.sub}</p>
                </div>
                {item.badge && (
                  <span style={{ background:C.danger, color:"#fff", borderRadius:20, fontSize:12,
                    fontWeight:700, padding:"3px 10px", boxShadow:"0 2px 6px rgba(197,48,48,0.4)" }}>
                    {item.badge} 🔔
                  </span>
                )}
                <span style={{ color:C.subtle, fontSize:18, flexShrink:0 }}>‹</span>
              </div>
            ))}
            <div style={{ background:C.primaryBg, borderRadius:16, padding:16, marginTop:6,
              border:`1px solid ${C.primary}20` }}>
              <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.primary }}>📲 تثبيت التطبيق</p>
              <p style={{ margin:"0 0 6px", fontSize:12, color:C.muted, lineHeight:1.8 }}>
                <strong>آيفون:</strong> Safari ← زر المشاركة ← "إضافة إلى الشاشة الرئيسية"
              </p>
              <p style={{ margin:0, fontSize:12, color:C.muted, lineHeight:1.8 }}>
                <strong>أندرويد:</strong> ستظهر رسالة تثبيت تلقائياً
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── شريط التنقل السفلي ── */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:C.white,
        borderTop:`1px solid ${C.border}`,
        display:"flex", zIndex:10,
        boxShadow:"0 -4px 20px rgba(0,0,0,0.08)",
        paddingBottom:"env(safe-area-inset-bottom)"
      }}>
        {TABS.map(item => (
          <button key={item.id} onClick={()=>setTab(item.id)} style={{
            flex:1, padding:"10px 0 8px", border:"none", background:"none", cursor:"pointer",
            display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            color: tab===item.id ? C.primary : C.subtle,
            fontFamily:"inherit", position:"relative",
            transition:"color 0.15s"
          }}>
            {tab===item.id && (
              <span style={{
                position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
                width:32, height:3, background:C.primary, borderRadius:"0 0 4px 4px"
              }}/>
            )}
            <span style={{
              fontSize:22,
              position:"relative",
              filter: tab===item.id ? "none" : "grayscale(40%)",
              transform: tab===item.id ? "scale(1.1)" : "scale(1)",
              transition:"transform 0.15s"
            }}>
              {item.i}
              {item.id==="more" && pendingCount > 0 && (
                <span style={{
                  position:"absolute", top:-4, right:-10,
                  background:C.danger, color:"#fff",
                  borderRadius:10, fontSize:9, fontWeight:700,
                  padding:"1px 5px", minWidth:16, textAlign:"center",
                  border:"2px solid #fff", lineHeight:1.4,
                  boxShadow:"0 1px 4px rgba(197,48,48,0.5)"
                }}>{pendingCount}</span>
              )}
            </span>
            <span style={{ fontSize:10, fontWeight:tab===item.id?700:500, letterSpacing:"0.01em" }}>{item.l}</span>
          </button>
        ))}
      </div>

      {modal?.type==="share" && <ShareSheet survey={modal.data} onClose={()=>setModal(null)}/>}

      {modal?.type==="users" && isAdmin && (
        <div style={{ position:"fixed", inset:0, background:C.bg, zIndex:50, overflowY:"auto" }}>
          <div style={{ background:C.primary, padding:"14px 16px", color:"#fff", display:"flex", alignItems:"center", gap:10, position:"sticky", top:0 }}>
            <button onClick={()=>setModal(null)} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer" }}>←</button>
            <span style={{ fontWeight:800, fontSize:15 }}>إدارة المستخدمين</span>
          </div>
          <UsersManagementPage currentUser={user}/>
        </div>
      )}

      {modal?.type==="auditlog" && isAdmin && (
        <div style={{ position:"fixed", inset:0, background:C.bg, zIndex:50, overflowY:"auto" }}>
          <div style={{ background:C.primary, padding:"14px 16px", color:"#fff", display:"flex", alignItems:"center", gap:10, position:"sticky", top:0 }}>
            <button onClick={()=>setModal(null)} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer" }}>←</button>
            <span style={{ fontWeight:800, fontSize:15 }}>سجل التدقيق</span>
          </div>
          <AuditLogPage/>
        </div>
      )}

      {modal?.type==="supervisors" && isAdmin && (
        <div style={{ position:"fixed", inset:0, background:C.bg, zIndex:50, overflowY:"auto" }}>
          <div style={{ background:C.primary, padding:"14px 16px", color:"#fff", display:"flex", alignItems:"center", gap:10, position:"sticky", top:0 }}>
            <button onClick={()=>setModal(null)} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer" }}>←</button>
            <span style={{ fontWeight:800, fontSize:15 }}>إدارة المشرفين</span>
          </div>
          <SupervisorsManagementPage user={user}/>
        </div>
      )}

      {modal?.type==="settings" && isAdmin && (
        <div style={{ position:"fixed", inset:0, background:C.bg, zIndex:50, overflowY:"auto" }}>
          <div style={{ background:C.primary, padding:"14px 16px", color:"#fff", display:"flex", alignItems:"center", gap:10, position:"sticky", top:0 }}>
            <button onClick={()=>setModal(null)} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer" }}>←</button>
            <span style={{ fontWeight:800, fontSize:15 }}>إعدادات التطبيق</span>
          </div>
          <AppSettingsPage onSaved={()=>setModal(null)}/>
        </div>
      )}

      {saveAsTemplateTarget && (
        <SaveAsTemplateSheet
          survey={saveAsTemplateTarget}
          user={user}
          isAdmin={isAdmin}
          onSaved={()=>setSaveAsTemplateTarget(null)}
          onClose={()=>setSaveAsTemplateTarget(null)}
        />
      )}

      {deleteSurveyTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex",
          alignItems:"center", justifyContent:"center", padding:20, direction:"rtl" }}>
          <div style={{ background:C.white, borderRadius:16, padding:22, width:"100%", maxWidth:360 }}>
            <p style={{ textAlign:"center", fontSize:16, fontWeight:700, color:C.dark, margin:"0 0 6px" }}>
              حذف الاستبيان؟
            </p>
            <p style={{ textAlign:"center", color:C.danger, fontSize:13, fontWeight:700, margin:"0 0 6px" }}>
              {deleteSurveyTarget.title}
            </p>
            <p style={{ textAlign:"center", color:C.muted, fontSize:12, margin:"0 0 16px" }}>
              سيُحذف الاستبيان وجميع إجاباته بشكل نهائي ولا يمكن التراجع.
            </p>
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

