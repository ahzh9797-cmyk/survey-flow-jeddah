// ═══════════════════════════════════════════════════════
// APP.JSX — التعديلات المطلوبة (4 تعديلات فقط)
// ═══════════════════════════════════════════════════════

// ── 1. أضف imports بعد سطر DirectoryPage ──
// القديم:
import DirectoryPage from "./Directory.jsx";

// الجديد:
import DirectoryPage from "./Directory.jsx";
import TemplatesPage, { SaveAsTemplateSheet } from "./TemplatesPage.jsx";


// ── 2. أضف state بعد deleteSurveyTarget ──
// القديم:
const [deleteSurveyTarget, setDeleteSurveyTarget] = useState(null);

// الجديد:
const [deleteSurveyTarget, setDeleteSurveyTarget] = useState(null);
const [saveAsTemplateTarget, setSaveAsTemplateTarget] = useState(null);


// ── 3. عدّل TABS — أضف القوالب ──
// القديم:
  const TABS = [
    {id:"surveys",   i:"📋", l:"الاستبيانات"},
    {id:"directory", i:"📁", l:"الدليل"},
    {id:"analytics", i:"📊", l:"إحصائيات"},
    ...(isAdmin ? [{id:"more",i:"⚙️",l:"المزيد"}] : []),
  ];

// الجديد:
  const TABS = [
    {id:"surveys",   i:"📋", l:"الاستبيانات"},
    {id:"directory", i:"📁", l:"الدليل"},
    {id:"templates", i:"🗂️", l:"القوالب"},
    {id:"analytics", i:"📊", l:"إحصائيات"},
    ...(isAdmin ? [{id:"more",i:"⚙️",l:"المزيد"}] : []),
  ];


// ── 4. عدّل modal "new" — أضف شاشة الاختيار ──
// القديم:
  if (modal?.type === "new") {
    return (
      <div style={{ paddingBottom:80 }}>
        <NewSurveyPage onSaved={()=>{ refetch(); setModal(null); }} onCancel={()=>setModal(null)} user={user} isAdmin={isAdmin}/>
      </div>
    );
  }

// الجديد:
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


// ── 5. أضف SurveysList prop: onSaveAsTemplate ──
// القديم:
          <SurveysList surveys={surveys} loading={loadingSurveys} schoolCount={schoolCount} isAdmin={isAdmin}
            onNew={()=>setModal({type:"new"})}
            onShare={s=>setModal({type:"share",data:s})}
            onTrack={s=>setModal({type:"tracking",data:s})}
            onEdit={s=>setModal({type:"edit",data:s})}
            onDelete={s=>setDeleteSurveyTarget(s)}
            onApprove={approveSurvey}/>

// الجديد:
          <SurveysList surveys={surveys} loading={loadingSurveys} schoolCount={schoolCount} isAdmin={isAdmin}
            onNew={()=>setModal({type:"new"})}
            onShare={s=>setModal({type:"share",data:s})}
            onTrack={s=>setModal({type:"tracking",data:s})}
            onEdit={s=>setModal({type:"edit",data:s})}
            onDelete={s=>setDeleteSurveyTarget(s)}
            onApprove={approveSurvey}
            onSaveAsTemplate={s=>setSaveAsTemplateTarget(s)}/>


// ── 6. أضف تبويب القوالب في المحتوى — بعد سطر analytics ──
// القديم:
        {tab==="analytics" && <AnalyticsPage surveys={surveys} onNavigate={setTab}/> }

// الجديد:
        {tab==="analytics" && <AnalyticsPage surveys={surveys} onNavigate={setTab}/> }
        {tab==="templates" && (
          <TemplatesPage
            user={user}
            isAdmin={isAdmin}
            onUseTemplate={t => setModal({ type:"new", choiceMade:true, fromTemplate:t })}
          />
        )}


// ── 7. أضف SaveAsTemplateSheet — قبل deleteSurveyTarget modal ──
// القديم:
      {deleteSurveyTarget && (

// الجديد:
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


