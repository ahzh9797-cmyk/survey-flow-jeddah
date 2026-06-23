import { useState, useEffect } from "react";
import { supabase, C, Btn, Card, Spinner, InstallAppBanner, RoleBadge,
  useSurveys, useSchoolCount, useUserRole, useAppSettings, usePendingCount,
  logAction } from "./lib.jsx";
import PublicFill from "./PublicFill.jsx";
import TrackingPage, { OpenSurveyTracking } from "./TrackingPage.jsx";
import { SurveysList, NewSurveyPage, ShareSheet, LoginPage, AnalyticsPage,
  SchoolsManagementPage, UsersManagementPage, SupervisorsManagementPage,
  AppSettingsPage, AuditLogPage } from "./Management.jsx";

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
    return (
      <div style={{ paddingBottom:80 }}>
        <NewSurveyPage onSaved={()=>{ refetch(); setModal(null); }} onCancel={()=>setModal(null)} user={user} isAdmin={isAdmin}/>
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
  if (role === null) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={32}/></div>;

  const TABS = [
    {id:"surveys",i:"📋",l:"الاستبيانات"},
    {id:"schools",i:"🏫",l:"المدارس"},
    {id:"analytics",i:"📊",l:"إحصائيات"},
    ...(isAdmin ? [{id:"more",i:"⚙️",l:"المزيد"}] : []),
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, direction:"rtl", fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif" }}>
      <div style={{ background:C.primary, padding:"14px 16px", color:"#fff", display:"flex", justifyContent:"space-between",
        alignItems:"center", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="logo" style={{ width:36, height:36, borderRadius:8, objectFit:"contain", background:"#fff", padding:2 }}/>
          ) : (
            <div style={{ width:32, height:32, background:C.accent, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>📋</div>
          )}
          <div>
            <div style={{ fontWeight:800, fontSize:15, display:"flex", alignItems:"center", gap:8 }}>
              {settings.app_name || "منظومة الاستبيانات"} <RoleBadge role={role}/>
            </div>
            <div style={{ fontSize:10, opacity:0.7, marginTop:2 }}>{settings.app_subtitle || "إدارة التعليم — جدة"} · {schoolCount} مدرسة</div>
          </div>
        </div>
        <button onClick={()=>supabase.auth.signOut()} style={{ background:"rgba(255,255,255,0.15)", border:"none",
          color:"#fff", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>خروج</button>
      </div>

      <div style={{ paddingBottom:80 }}>
        {tab==="surveys" && <InstallAppBanner/>}
        {tab==="surveys" && (
          <SurveysList surveys={surveys} loading={loadingSurveys} schoolCount={schoolCount} isAdmin={isAdmin}
            onNew={()=>setModal({type:"new"})}
            onShare={s=>setModal({type:"share",data:s})}
            onTrack={s=>setModal({type:"tracking",data:s})}
            onEdit={s=>setModal({type:"edit",data:s})}
            onDelete={s=>setDeleteSurveyTarget(s)}
            onApprove={approveSurvey}/>
        )}
        {tab==="analytics" && <AnalyticsPage surveys={surveys}/>}
        {tab==="schools" && <SchoolsManagementPage isAdmin={isAdmin} user={user}/>}
        {tab==="more" && isAdmin && (
          <div style={{ padding:16, direction:"rtl" }}>
            <h2 style={{ margin:"0 0 16px", fontSize:17, color:C.dark }}>المزيد</h2>
            <Card style={{ marginBottom:10, cursor:"pointer" }} accent={C.primary}>
              <div onClick={()=>setModal({type:"users"})} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:22 }}>👥</span>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark }}>إدارة المستخدمين والصلاحيات</p>
                  <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>تعيين مدير عام أو مشرف عرض فقط</p>
                </div>
                {pendingCount > 0 && (
                  <span style={{ background:C.danger, color:"#fff", borderRadius:12, fontSize:11, fontWeight:700,
                    padding:"3px 9px" }}>{pendingCount} 🔔</span>
                )}
              </div>
            </Card>
            <Card style={{ marginBottom:10, cursor:"pointer" }} accent="#7B2D8B">
              <div onClick={()=>setModal({type:"supervisors"})} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:22 }}>👤</span>
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark }}>إدارة المشرفين</p>
                  <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>إضافة وتعديل وإرسال استبيانات للمشرفين</p>
                </div>
              </div>
            </Card>
            <Card style={{ marginBottom:10, cursor:"pointer" }} accent={C.accent}>
              <div onClick={()=>setModal({type:"auditlog"})} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:22 }}>📜</span>
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark }}>سجل التدقيق</p>
                  <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>كل عمليات الإضافة والتعديل والحذف</p>
                </div>
              </div>
            </Card>
            <Card style={{ marginBottom:10, cursor:"pointer" }} accent={C.primary}>
              <div onClick={()=>setModal({type:"settings"})} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:22 }}>🎨</span>
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.dark }}>إعدادات التطبيق</p>
                  <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>اللوغو والعناوين وتخصيص النظام</p>
                </div>
              </div>
            </Card>
            <Card>
              <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.dark }}>📲 تثبيت التطبيق</p>
              <p style={{ margin:"0 0 6px", fontSize:11, color:C.muted, lineHeight:1.8 }}>
                <strong>على آيفون:</strong> افتح الموقع في Safari ← زر المشاركة ⬆️ ← "إضافة إلى الشاشة الرئيسية"
              </p>
              <p style={{ margin:0, fontSize:11, color:C.muted, lineHeight:1.8 }}>
                <strong>على أندرويد/كمبيوتر:</strong> ستظهر رسالة "تثبيت" تلقائياً في أعلى المتصفح أو من قائمة الاستبيانات
              </p>
            </Card>
          </div>
        )}
      </div>

      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:C.white, borderTop:`1px solid ${C.border}`, display:"flex", zIndex:10 }}>
        {TABS.map(item => (
          <button key={item.id} onClick={()=>setTab(item.id)} style={{
            flex:1, padding:"10px 0", border:"none", background:"none", cursor:"pointer",
            display:"flex", flexDirection:"column", alignItems:"center", gap:2,
            color:tab===item.id?C.primary:C.muted, fontFamily:"inherit" }}>
            <span style={{ fontSize:20, position:"relative" }}>
              {item.i}
              {item.id==="more" && pendingCount > 0 && (
                <span style={{ position:"absolute", top:-4, right:-8, background:C.danger, color:"#fff",
                  borderRadius:10, fontSize:9, fontWeight:700, padding:"1px 5px", minWidth:14, textAlign:"center",
                  border:"1.5px solid #fff", lineHeight:1.4 }}>{pendingCount}</span>
              )}
            </span>
            <span style={{ fontSize:10, fontWeight:tab===item.id?700:400 }}>{item.l}</span>
            {tab===item.id && <div style={{ width:18, height:3, background:C.primary, borderRadius:2, marginTop:1 }}/>}
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
    </div>
  );
}

