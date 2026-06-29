/**
 * ReviewCenter.jsx
 * Complete Review Center — Preview Links, Comments, Approvals
 * Independent component — zero modification to existing files
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Spinner } from "./lib.jsx";
import {
  PERMISSIONS, EXPIRY_OPTIONS,
  createPreview, fetchPreviews, deactivatePreview,
  fetchComments, addComment, resolveComment, reopenComment,
  submitApproval, fetchApprovals,
  fetchReviewers, addReviewer, updateReviewerStatus,
  fetchReviewAudit, logReviewAction,
  buildPreviewUrl, buildWhatsAppMessage,
  isPreviewExpired, computeReviewStats,
} from "./ReviewService.js";

// ── Design tokens ────────────────────────────────────
const R = {
  e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
  e100:"#D1FAE5",e50:"#ECFDF5",
  gold:"#C9A84C",goldL:"#FEF3C7",
  s900:"#0F172A",s700:"#334155",s500:"#64748B",s400:"#94A3B8",
  s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
  white:"#FFFFFF",bg:"#F0F4F8",
  danger:"#DC2626",dangerBg:"#FEF2F2",warn:"#D97706",warnBg:"#FFFBEB",
  success:"#059669",successBg:"#ECFDF5",purple:"#7B2D8B",purpleBg:"#F5EEFA",
};

if (typeof document !== "undefined" && !document.getElementById("review-styles")) {
  const _s = document.createElement("style");
  _s.id = "review-styles";
  _s.textContent = `
    .rv-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .rv-card:hover { transform:translateY(-1px); box-shadow:0 8px 24px rgba(0,0,0,0.09)!important; }
    .rv-btn { transition: all 0.12s ease; }
    .rv-btn:active { transform: scale(0.95); }
    @keyframes rv-in { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
    .rv-in { animation: rv-in 0.2s ease both; }
    @keyframes spin { to{transform:rotate(360deg)} }
  `;
  document.head.appendChild(_s);
}

// ── Shared UI ────────────────────────────────────────
const iSt = (extra={}) => ({
  width:"100%", padding:"10px 12px", border:`1.5px solid ${R.s200}`,
  borderRadius:10, fontSize:13, fontFamily:"inherit", direction:"rtl",
  boxSizing:"border-box", outline:"none", background:R.white, color:R.s900,
  ...extra,
});

function RBtn({ children, onClick, variant="primary", sm, disabled, loading, style={} }) {
  const bases = {
    primary:   { background:`linear-gradient(135deg,${R.e600},${R.e800})`, color:"#fff", boxShadow:`0 3px 10px ${R.e600}35` },
    secondary: { background:R.s100, color:R.s700 },
    danger:    { background:R.dangerBg, color:R.danger },
    gold:      { background:`linear-gradient(135deg,${R.gold},#b8902a)`, color:"#fff" },
    green:     { background:`linear-gradient(135deg,#25D366,#128C7E)`, color:"#fff" },
    ghost:     { background:"none", color:R.s500 },
  };
  return (
    <button onClick={onClick} disabled={disabled||loading} className="rv-btn"
      style={{ border:"none", borderRadius:10, cursor:disabled||loading?"not-allowed":"pointer",
        fontFamily:"inherit", fontWeight:700, display:"inline-flex", alignItems:"center",
        justifyContent:"center", gap:6, opacity:disabled||loading?0.6:1,
        padding:sm?"6px 12px":"10px 16px", fontSize:sm?11:13,
        ...bases[variant], ...style }}>
      {loading ? <span style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.7s linear infinite"}}/> : children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"flex-end",direction:"rtl"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:"100%",background:R.bg,borderRadius:"24px 24px 0 0",maxHeight:"92vh",overflowY:"auto",paddingBottom:24}}>
        <div style={{display:"flex",justifyContent:"center",padding:"14px 0 4px"}}>
          <div style={{width:44,height:4,background:R.s200,borderRadius:4}}/>
        </div>
        <div style={{padding:"4px 18px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3 style={{margin:0,fontSize:16,color:R.s900,fontWeight:800}}>{title}</h3>
            <button onClick={onClose} style={{background:R.s100,border:"none",borderRadius:10,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,cursor:"pointer",color:R.s500}}>✕</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color=R.e700, bg=R.e50 }) {
  return (
    <div style={{background:R.white,borderRadius:14,border:`1px solid ${R.s200}`,padding:"12px 10px",textAlign:"center",borderTop:`3px solid ${color}`}}>
      <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
      <div style={{fontSize:20,fontWeight:800,color}}>{value}</div>
      <div style={{fontSize:10,color:R.s400,marginTop:2}}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    pending:            {label:"⏳ بانتظار",        color:R.warn,    bg:R.warnBg},
    in_progress:        {label:"🔍 قيد المراجعة",   color:R.e700,    bg:R.e50},
    approved:           {label:"✅ معتمد",           color:R.success, bg:R.successBg},
    changes_requested:  {label:"📝 يحتاج تعديل",    color:R.danger,  bg:R.dangerBg},
    completed:          {label:"🏁 مكتمل",           color:R.s500,    bg:R.s100},
    open:               {label:"💬 مفتوح",           color:R.e700,    bg:R.e50},
    resolved:           {label:"✅ محلول",           color:R.success, bg:R.successBg},
    reopened:           {label:"🔄 معاد فتحه",       color:R.warn,    bg:R.warnBg},
  }[status] || {label:status, color:R.s500, bg:R.s100};
  return (
    <span style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}30`,borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>{cfg.label}</span>
  );
}

// ══════════════════════════════════════════════════════
// CREATE PREVIEW MODAL
// ══════════════════════════════════════════════════════
function CreatePreviewModal({ survey, user, onCreated, onClose }) {
  const [permission,      setPermission]      = useState("simulation_comment");
  const [expiryIdx,       setExpiryIdx]       = useState(2); // 7 days default
  const [allowAnonymous,  setAllowAnonymous]  = useState(true);
  const [notes,           setNotes]           = useState("");
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState("");

  async function create() {
    setSaving(true); setError("");
    const { data, error:err } = await createPreview({
      surveyId: survey.id,
      title: survey.title,
      permission,
      expiryHours: EXPIRY_OPTIONS[expiryIdx].hours,
      allowAnonymous,
      notes,
      userId: user?.id,
      userEmail: user?.email,
    });
    setSaving(false);
    if (err) { setError("فشل إنشاء الرابط: " + err.message); return; }
    onCreated(data);
  }

  return (
    <Modal title="إنشاء رابط مراجعة" onClose={onClose}>
      <div style={{background:R.e50,border:`1px solid ${R.e100}`,borderRadius:12,padding:14,marginBottom:14}}>
        <p style={{margin:"0 0 4px",fontSize:13,fontWeight:700,color:R.e700}}>📋 {survey.title}</p>
        <p style={{margin:0,fontSize:11,color:R.s500}}>سيتم إنشاء رابط آمن للمراجعة — لا تُحفظ أي بيانات</p>
      </div>

      <div style={{marginBottom:12}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:R.s700,marginBottom:6}}>صلاحيات المراجع</label>
        {Object.entries(PERMISSIONS).map(([k,v])=>(
          <label key={k} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,cursor:"pointer",marginBottom:4,background:permission===k?R.e50:"transparent",border:`1px solid ${permission===k?R.e200:R.s200}`}}>
            <input type="radio" checked={permission===k} onChange={()=>setPermission(k)} style={{width:15,height:15}}/>
            <span style={{fontSize:16}}>{v.icon}</span>
            <span style={{fontSize:13,color:permission===k?R.e700:R.s700,fontWeight:permission===k?700:400}}>{v.label}</span>
          </label>
        ))}
      </div>

      <div style={{marginBottom:12}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:R.s700,marginBottom:6}}>مدة الصلاحية</label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {EXPIRY_OPTIONS.map((o,i)=>(
            <button key={i} onClick={()=>setExpiryIdx(i)} style={{padding:"6px 12px",borderRadius:20,fontSize:11,fontFamily:"inherit",cursor:"pointer",border:`1.5px solid ${expiryIdx===i?R.e600:R.s200}`,background:expiryIdx===i?R.e50:R.white,color:expiryIdx===i?R.e700:R.s500,fontWeight:expiryIdx===i?700:400}}>{o.label}</button>
          ))}
        </div>
      </div>

      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",marginBottom:12,padding:"10px",background:R.s50,borderRadius:10}}>
        <input type="checkbox" checked={allowAnonymous} onChange={e=>setAllowAnonymous(e.target.checked)} style={{width:15,height:15}}/>
        <span style={{color:R.s700}}>السماح بالمراجعة المجهولة</span>
      </label>

      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:R.s700,marginBottom:6}}>ملاحظات للمراجع</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
          placeholder="مثال: يرجى التركيز على الأسئلة المتعلقة بالمباني..."
          style={{...iSt(),resize:"vertical"}}/>
      </div>

      {error && <div style={{background:R.dangerBg,borderRadius:10,padding:"10px 14px",fontSize:12,color:R.danger,marginBottom:12}}>{error}</div>}
      <div style={{display:"flex",gap:8}}>
        <RBtn variant="secondary" onClick={onClose} style={{flex:1}}>إلغاء</RBtn>
        <RBtn onClick={create} loading={saving} style={{flex:2}}>🔗 إنشاء رابط المراجعة</RBtn>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════
// SHARE PREVIEW MODAL
// ══════════════════════════════════════════════════════
function SharePreviewModal({ preview, survey, onClose }) {
  const [tab,     setTab]     = useState("link");
  const [copied,  setCopied]  = useState(false);
  const url = buildPreviewUrl(preview.token);
  const qr  = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  const wa  = buildWhatsAppMessage({
    surveyTitle: survey?.title || preview.title,
    creatorEmail: preview.created_by_email,
    previewUrl: url,
    expiresAt: preview.expires_at,
    notes: preview.notes,
  });

  function copy() {
    navigator.clipboard.writeText(url).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  const TABS = [["link","🔗 رابط"],["whatsapp","📱 واتساب"],["qr","📷 QR"],["email","📧 بريد"]];

  return (
    <Modal title="مشاركة رابط المراجعة" onClose={onClose}>
      {isPreviewExpired(preview) && (
        <div style={{background:R.dangerBg,border:`1px solid ${R.danger}30`,borderRadius:10,padding:"10px 14px",fontSize:12,color:R.danger,marginBottom:14}}>⚠️ هذا الرابط منتهي الصلاحية</div>
      )}
      <div style={{background:R.s50,borderRadius:12,padding:12,marginBottom:14}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
          <span style={{fontSize:11,color:R.s500}}>{PERMISSIONS[preview.permission]?.icon} {PERMISSIONS[preview.permission]?.label}</span>
          {preview.expires_at && <span style={{fontSize:11,color:R.s400}}>· ينتهي {new Date(preview.expires_at).toLocaleDateString("ar-SA")}</span>}
          <span style={{fontSize:11,color:R.s400}}>· 👁️ {preview.view_count||0} مشاهدة</span>
        </div>
      </div>

      <div style={{display:"flex",borderBottom:`1px solid ${R.s200}`,marginBottom:16}}>
        {TABS.map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"9px 4px",border:"none",background:"none",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:tab===k?700:400,color:tab===k?R.e700:R.s400,borderBottom:`2px solid ${tab===k?R.e600:"transparent"}`,marginBottom:-1}}>{l}</button>
        ))}
      </div>

      {tab==="link" && (
        <div>
          <div style={{background:R.s50,borderRadius:10,padding:12,marginBottom:12,wordBreak:"break-all",fontSize:12,color:R.s500,border:`1px solid ${R.s200}`}}>{url}</div>
          <RBtn onClick={copy} style={{width:"100%"}}>{copied?"✓ تم النسخ!":"📋 نسخ الرابط"}</RBtn>
        </div>
      )}
      {tab==="whatsapp" && (
        <div>
          <div style={{background:"#e7fce7",borderRadius:12,padding:14,marginBottom:12,fontSize:12,color:"#128C7E",lineHeight:1.8,direction:"rtl"}}>
            <p style={{margin:"0 0 6px",fontWeight:700}}>نص الرسالة:</p>
            <p style={{margin:0}}>مراجعة: {survey?.title} — {url}</p>
          </div>
          <a href={`https://wa.me/?text=${wa}`} target="_blank" rel="noopener noreferrer" style={{display:"block",textDecoration:"none"}}>
            <RBtn variant="green" style={{width:"100%"}}>📱 إرسال عبر واتساب</RBtn>
          </a>
        </div>
      )}
      {tab==="qr" && (
        <div style={{textAlign:"center",padding:"8px 0"}}>
          <img src={qr} alt="QR" style={{width:180,height:180,borderRadius:12,border:`1px solid ${R.s200}`}}/>
          <p style={{margin:"10px 0 0",fontSize:12,color:R.s500}}>امسح للوصول لرابط المراجعة</p>
        </div>
      )}
      {tab==="email" && (
        <div>
          <a href={`mailto:?subject=مراجعة استبيان: ${survey?.title}&body=${encodeURIComponent(`يرجى مراجعة الاستبيان عبر الرابط:\n${url}`)}`}
            style={{display:"block",textDecoration:"none"}}>
            <RBtn style={{width:"100%"}}>📧 فتح البريد الإلكتروني</RBtn>
          </a>
        </div>
      )}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════
// REVIEW DETAIL MODAL — Comments + Approvals + Audit
// ══════════════════════════════════════════════════════
function ReviewDetailModal({ preview, survey, user, onClose }) {
  const [tab,        setTab]        = useState("comments");
  const [comments,   setComments]   = useState([]);
  const [approvals,  setApprovals]  = useState([]);
  const [audit,      setAudit]      = useState([]);
  const [reviewers,  setReviewers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [newComment, setNewComment] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [decision,   setDecision]   = useState("");
  const [decisionNote, setDecisionNote] = useState("");

  const load = useCallback(async()=>{
    setLoading(true);
    const [c,a,au,rv] = await Promise.all([
      fetchComments(preview.id),
      fetchApprovals(preview.id),
      fetchReviewAudit(preview.id),
      fetchReviewers(preview.id),
    ]);
    setComments(c.data||[]); setApprovals(a.data||[]);
    setAudit(au); setReviewers(rv.data||[]);
    setLoading(false);
  },[preview.id]);

  useEffect(()=>{load();},[load]);

  const stats = useMemo(()=>computeReviewStats(comments,approvals),[comments,approvals]);

  async function sendComment() {
    if (!newComment.trim()) return;
    setSaving(true);
    await addComment({ previewId:preview.id, reviewerName:user?.email||"المسؤول", reviewerEmail:user?.email, content:newComment });
    setNewComment(""); load(); setSaving(false);
  }

  async function handleResolve(id) {
    await resolveComment(id, user?.email||"المسؤول");
    load();
  }

  async function handleApproval() {
    if (!decision) return;
    setSaving(true);
    await submitApproval({ previewId:preview.id, surveyId:preview.survey_id, decision, note:decisionNote, reviewerName:user?.email });
    setDecision(""); setDecisionNote(""); load(); setSaving(false);
  }

  const TABS = [["comments","💬 التعليقات"],["approvals","✅ الاعتمادات"],["reviewers","👥 المراجعون"],["audit","📜 السجل"]];

  // group comments by thread
  const rootComments = comments.filter(c=>!c.parent_id);
  const getReplies   = (id) => comments.filter(c=>c.parent_id===id);

  return (
    <Modal title={`مراجعة: ${survey?.title||preview.title}`} onClose={onClose}>
      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:14}}>
        <StatCard icon="💬" label="تعليقات" value={stats.total} color={R.e700}/>
        <StatCard icon="✅" label="محلولة" value={stats.resolved} color={R.success}/>
        <StatCard icon="🔓" label="مفتوحة" value={stats.open} color={R.warn}/>
        <StatCard icon="👍" label="اعتماد" value={stats.approved} color={R.purple}/>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:R.s100,borderRadius:12,padding:4,marginBottom:14,gap:2}}>
        {TABS.map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"7px 4px",border:"none",background:tab===k?R.white:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:10,fontWeight:tab===k?700:500,color:tab===k?R.e700:R.s500,borderRadius:9,boxShadow:tab===k?"0 1px 4px rgba(0,0,0,0.08)":"none",transition:"all 0.15s",whiteSpace:"nowrap"}}>{l}</button>
        ))}
      </div>

      {loading ? <div style={{textAlign:"center",padding:30}}><div style={{width:28,height:28,borderRadius:"50%",border:`3px solid ${R.e100}`,borderTopColor:R.e600,animation:"spin 0.7s linear infinite",margin:"0 auto"}}/></div>
      : tab==="comments" ? (
        <div>
          {rootComments.length===0 ? (
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:32,marginBottom:8}}>💬</div>
              <p style={{margin:0,color:R.s500,fontSize:13}}>لا توجد تعليقات بعد</p>
            </div>
          ) : rootComments.map(c=>(
            <div key={c.id} style={{background:R.white,borderRadius:14,border:`1px solid ${R.s200}`,padding:12,marginBottom:10,borderRight:`3px solid ${c.status==="resolved"?R.success:R.e500}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{width:28,height:28,borderRadius:"50%",background:R.e50,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>👤</span>
                  <div>
                    <p style={{margin:0,fontSize:12,fontWeight:700,color:R.s900}}>{c.reviewer_name||"مجهول"}</p>
                    <p style={{margin:0,fontSize:10,color:R.s400}}>{new Date(c.created_at).toLocaleString("ar-SA")}</p>
                  </div>
                </div>
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  <StatusBadge status={c.status}/>
                  {c.status!=="resolved" && (
                    <button onClick={()=>handleResolve(c.id)} style={{background:R.successBg,border:"none",borderRadius:8,padding:"4px 8px",fontSize:10,color:R.success,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>حل ✓</button>
                  )}
                  {c.status==="resolved" && (
                    <button onClick={()=>{reopenComment(c.id);load();}} style={{background:R.warnBg,border:"none",borderRadius:8,padding:"4px 8px",fontSize:10,color:R.warn,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>إعادة فتح</button>
                  )}
                </div>
              </div>
              <p style={{margin:"0 0 6px",fontSize:13,color:R.s900,lineHeight:1.6}}>{c.content}</p>
              {c.question_id && <p style={{margin:"0 0 6px",fontSize:10,color:R.s400}}>📍 السؤال: {c.question_id}</p>}
              {/* Replies */}
              {getReplies(c.id).map(r=>(
                <div key={r.id} style={{background:R.s50,borderRadius:10,padding:"8px 10px",marginBottom:6,marginRight:20,border:`1px solid ${R.s100}`}}>
                  <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:R.s700}}>{r.reviewer_name} ↩️</p>
                  <p style={{margin:0,fontSize:12,color:R.s900}}>{r.content}</p>
                </div>
              ))}
            </div>
          ))}

          {/* New comment */}
          <div style={{background:R.white,borderRadius:14,border:`1px solid ${R.s200}`,padding:12,marginTop:8}}>
            <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:R.s700}}>➕ إضافة تعليق</p>
            <textarea value={newComment} onChange={e=>setNewComment(e.target.value)} rows={3}
              placeholder="اكتب تعليقك أو ملاحظاتك..."
              style={{...iSt(),resize:"vertical",marginBottom:8}}/>
            <RBtn sm onClick={sendComment} loading={saving} disabled={!newComment.trim()}>💬 إرسال التعليق</RBtn>
          </div>
        </div>
      ) : tab==="approvals" ? (
        <div>
          {approvals.length===0 ? (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:32,marginBottom:8}}>✅</div>
              <p style={{margin:0,color:R.s500,fontSize:13}}>لا توجد اعتمادات بعد</p>
            </div>
          ) : approvals.map(a=>(
            <div key={a.id} style={{background:R.white,borderRadius:12,border:`1px solid ${R.s200}`,padding:12,marginBottom:10,borderRight:`3px solid ${a.decision==="approved"?R.success:R.danger}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:R.s900}}>{a.review_reviewers?.name||"مراجع"}</p>
                <StatusBadge status={a.decision==="approved"?"approved":"changes_requested"}/>
              </div>
              {a.note && <p style={{margin:"0 0 4px",fontSize:12,color:R.s700,lineHeight:1.5}}>{a.note}</p>}
              <p style={{margin:0,fontSize:10,color:R.s400}}>{new Date(a.created_at).toLocaleString("ar-SA")}</p>
            </div>
          ))}

          {/* Submit approval */}
          <div style={{background:R.white,borderRadius:14,border:`1px solid ${R.s200}`,padding:14,marginTop:8}}>
            <p style={{margin:"0 0 10px",fontSize:13,fontWeight:800,color:R.s900}}>قرار الاعتماد</p>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <button onClick={()=>setDecision("approved")} style={{flex:1,padding:"10px",border:`2px solid ${decision==="approved"?R.success:R.s200}`,borderRadius:10,background:decision==="approved"?R.successBg:R.white,color:decision==="approved"?R.success:R.s500,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:12}}>✅ اعتماد</button>
              <button onClick={()=>setDecision("changes_requested")} style={{flex:1,padding:"10px",border:`2px solid ${decision==="changes_requested"?R.danger:R.s200}`,borderRadius:10,background:decision==="changes_requested"?R.dangerBg:R.white,color:decision==="changes_requested"?R.danger:R.s500,fontFamily:"inherit",fontWeight:700,cursor:"pointer",fontSize:12}}>📝 يحتاج تعديل</button>
            </div>
            <textarea value={decisionNote} onChange={e=>setDecisionNote(e.target.value)} rows={2}
              placeholder="ملاحظات الاعتماد (اختياري)..."
              style={{...iSt(),resize:"none",marginBottom:8}}/>
            <RBtn onClick={handleApproval} loading={saving} disabled={!decision} style={{width:"100%"}}>
              {decision==="approved"?"✅ تأكيد الاعتماد":"📝 طلب التعديلات"}
            </RBtn>
          </div>
        </div>
      ) : tab==="reviewers" ? (
        <div>
          {reviewers.length===0 ? (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:32,marginBottom:8}}>👥</div>
              <p style={{margin:0,color:R.s500,fontSize:13}}>لم يُضف مراجعون بعد</p>
            </div>
          ) : reviewers.map(rv=>(
            <div key={rv.id} style={{background:R.white,borderRadius:12,border:`1px solid ${R.s200}`,padding:12,marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:R.e50,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>👤</div>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:R.s900}}>{rv.name||rv.email||"مجهول"}</p>
                <p style={{margin:"2px 0 0",fontSize:11,color:R.s400}}>{rv.role==="approver"?"مُعتمِد":"مراجع"} · {new Date(rv.invited_at).toLocaleDateString("ar-SA")}</p>
              </div>
              <StatusBadge status={rv.status}/>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {audit.length===0 ? (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:32,marginBottom:8}}>📜</div>
              <p style={{margin:0,color:R.s500,fontSize:13}}>لا يوجد سجل بعد</p>
            </div>
          ) : (
            <div style={{background:R.white,borderRadius:14,border:`1px solid ${R.s200}`,overflow:"hidden"}}>
              {audit.map((a,i)=>{
                const icons = { preview_created:"🔗", preview_opened:"👁️", comment_added:"💬", comment_resolved:"✅", approval_granted:"👍", approval_rejected:"❌", review_completed:"🏁" };
                return (
                  <div key={a.id} style={{padding:"10px 14px",borderBottom:i<audit.length-1?`1px solid ${R.s100}`:"none",display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{icons[a.action]||"•"}</span>
                    <div style={{flex:1}}>
                      <p style={{margin:0,fontSize:12,color:R.s900,fontWeight:600}}>{a.action.replace(/_/g," ")}</p>
                      {a.actor_name && <p style={{margin:"2px 0 0",fontSize:10,color:R.s400}}>{a.actor_name}</p>}
                    </div>
                    <span style={{fontSize:10,color:R.s300,flexShrink:0}}>{new Date(a.created_at).toLocaleString("ar-SA")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════
// REVIEW CENTER — Main component
// ══════════════════════════════════════════════════════
export default function ReviewCenter({ surveys, user }) {
  const [selectedSurvey, setSelectedSurvey]   = useState(null);
  const [previews,       setPreviews]          = useState([]);
  const [loading,        setLoading]           = useState(false);
  const [createOpen,     setCreateOpen]        = useState(false);
  const [shareTarget,    setShareTarget]       = useState(null);
  const [detailTarget,   setDetailTarget]      = useState(null);
  const [search,         setSearch]            = useState("");

  const load = useCallback(async()=>{
    if (!selectedSurvey) return;
    setLoading(true);
    const { data } = await fetchPreviews(selectedSurvey.id);
    setPreviews(data); setLoading(false);
  },[selectedSurvey]);

  useEffect(()=>{ load(); },[load]);

  const filtered = useMemo(()=>{
    if (!search.trim()) return previews;
    const q = search.toLowerCase();
    return previews.filter(p=>(p.title||"").toLowerCase().includes(q) || (p.created_by_email||"").toLowerCase().includes(q));
  },[previews,search]);

  async function handleDeactivate(id) {
    if (!confirm("إلغاء تفعيل هذا الرابط؟")) return;
    await deactivatePreview(id); load();
  }

  return (
    <div style={{padding:16,direction:"rtl"}}>
      {/* Header */}
      <div style={{marginBottom:16}}>
        <h2 style={{margin:0,fontSize:18,color:R.s900,fontWeight:800}}>مركز المراجعة</h2>
        <p style={{margin:"2px 0 0",fontSize:12,color:R.s500}}>روابط المراجعة الآمنة · التعليقات · الاعتمادات</p>
      </div>

      {/* Survey selector */}
      <div style={{background:R.white,borderRadius:16,border:`1px solid ${R.s200}`,padding:14,marginBottom:14}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:R.s700,marginBottom:8}}>اختر الاستبيان للمراجعة</label>
        <select value={selectedSurvey?.id||""} onChange={e=>{
          const s=surveys.find(sv=>sv.id===e.target.value)||null;
          setSelectedSurvey(s); setPreviews([]);
        }} style={{...iSt({marginBottom:0}),background:R.white}}>
          <option value="">— اختر استبياناً —</option>
          {surveys.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </div>

      {/* Actions */}
      {selectedSurvey && (
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <RBtn onClick={()=>setCreateOpen(true)} style={{flex:1}}>
            🔗 إنشاء رابط مراجعة
          </RBtn>
        </div>
      )}

      {/* Preview links list */}
      {selectedSurvey && (
        <>
          {previews.length>0 && (
            <div style={{position:"relative",marginBottom:10}}>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:14,pointerEvents:"none"}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في روابط المراجعة..."
                style={{...iSt({padding:"10px 36px 10px 12px"}),marginBottom:0}}/>
            </div>
          )}

          {loading ? (
            <div style={{textAlign:"center",padding:40}}>
              <div style={{width:32,height:32,borderRadius:"50%",border:`3px solid ${R.e100}`,borderTopColor:R.e600,animation:"spin 0.7s linear infinite",margin:"0 auto"}}/>
            </div>
          ) : filtered.length===0 ? (
            <div style={{textAlign:"center",padding:"32px 20px",background:R.white,borderRadius:18,border:`1px solid ${R.s200}`}}>
              <div style={{fontSize:44,marginBottom:10}}>🔗</div>
              <p style={{margin:"0 0 4px",fontSize:14,fontWeight:700,color:R.s900}}>لا توجد روابط مراجعة</p>
              <p style={{margin:"0 0 16px",fontSize:12,color:R.s500}}>أنشئ رابطاً آمناً لمشاركة الاستبيان للمراجعة</p>
              <RBtn sm onClick={()=>setCreateOpen(true)}>🔗 إنشاء أول رابط</RBtn>
            </div>
          ) : filtered.map((preview,idx)=>{
            const expired = isPreviewExpired(preview);
            return (
              <div key={preview.id} className="rv-card rv-in"
                style={{background:R.white,borderRadius:16,border:`1px solid ${expired?R.s200:R.s200}`,marginBottom:10,boxShadow:"0 2px 6px rgba(0,0,0,0.05)",borderRight:`3px solid ${!preview.is_active?"#ccc":expired?R.danger:R.e500}`,opacity:!preview.is_active||expired?0.7:1,animationDelay:`${idx*0.04}s`}}>
                <div style={{padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontSize:12,fontWeight:700,color:R.s900}}>
                          {PERMISSIONS[preview.permission]?.icon} {PERMISSIONS[preview.permission]?.label}
                        </span>
                        {!preview.is_active && <span style={{fontSize:10,background:R.s100,color:R.s400,borderRadius:20,padding:"2px 8px",fontWeight:700}}>معطّل</span>}
                        {expired && <span style={{fontSize:10,background:R.dangerBg,color:R.danger,borderRadius:20,padding:"2px 8px",fontWeight:700}}>منتهي</span>}
                        {!expired && preview.is_active && <span style={{fontSize:10,background:R.successBg,color:R.success,borderRadius:20,padding:"2px 8px",fontWeight:700}}>✅ نشط</span>}
                      </div>
                      <p style={{margin:0,fontSize:11,color:R.s400}}>
                        👁️ {preview.view_count||0} مشاهدة
                        {preview.expires_at && ` · ينتهي ${new Date(preview.expires_at).toLocaleDateString("ar-SA")}`}
                        {!preview.expires_at && " · لا ينتهي"}
                      </p>
                      {preview.notes && <p style={{margin:"4px 0 0",fontSize:11,color:R.s500,fontStyle:"italic"}}>{preview.notes}</p>}
                    </div>
                  </div>

                  <div style={{display:"flex",gap:6,flexWrap:"wrap",borderTop:`1px solid ${R.s100}`,paddingTop:8}}>
                    <RBtn sm onClick={()=>setShareTarget(preview)} disabled={!preview.is_active||expired}>🔗 مشاركة</RBtn>
                    <RBtn sm variant="secondary" onClick={()=>setDetailTarget(preview)}>📊 التفاصيل</RBtn>
                    {preview.is_active && <RBtn sm variant="danger" onClick={()=>handleDeactivate(preview.id)}>🚫 إلغاء</RBtn>}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {!selectedSurvey && (
        <div style={{textAlign:"center",padding:"40px 20px",background:R.white,borderRadius:18,border:`1px solid ${R.s200}`}}>
          <div style={{fontSize:48,marginBottom:12}}>🔍</div>
          <p style={{margin:"0 0 6px",fontSize:15,fontWeight:700,color:R.s900}}>مركز المراجعة</p>
          <p style={{margin:0,fontSize:13,color:R.s500}}>اختر استبياناً لإنشاء روابط مراجعة آمنة</p>
        </div>
      )}

      {/* Safe preview notice */}
      <div style={{background:R.e50,border:`1px solid ${R.e100}`,borderRadius:14,padding:14,marginTop:14}}>
        <p style={{margin:"0 0 4px",fontSize:12,fontWeight:700,color:R.e700}}>🛡️ وضع المراجعة الآمن</p>
        <p style={{margin:0,fontSize:11,color:R.s500,lineHeight:1.7}}>
          روابط المراجعة لا تُخزّن أي إجابات · لا تُحدّث الإحصائيات · لا تظهر في التقارير · معزولة تماماً عن البيانات الإنتاجية
        </p>
      </div>

      {/* Modals */}
      {createOpen && (
        <CreatePreviewModal survey={selectedSurvey} user={user}
          onCreated={()=>{ setCreateOpen(false); load(); }}
          onClose={()=>setCreateOpen(false)}/>
      )}
      {shareTarget && (
        <SharePreviewModal preview={shareTarget} survey={selectedSurvey} user={user}
          onClose={()=>setShareTarget(null)}/>
      )}
      {detailTarget && (
        <ReviewDetailModal preview={detailTarget} survey={selectedSurvey} user={user}
          onClose={()=>{ setDetailTarget(null); load(); }}/>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SAFE PREVIEW PAGE — rendered when ?review=TOKEN
// Zero production impact
// ══════════════════════════════════════════════════════
export function ReviewPreviewPage({ token, surveys }) {
  const [preview,  setPreview]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [name,     setName]     = useState("");
  const [nameSet,  setNameSet]  = useState(false);
  const [comments, setComments] = useState([]);
  const [newCmt,   setNewCmt]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [tab,      setTab]      = useState("survey");

  useEffect(()=>{
    async function load() {
      const { data, error:err } = await import("./ReviewService.js").then(m=>m.fetchPreviewByToken(token));
      if (err || !data) { setError("رابط المراجعة غير موجود أو غير صالح"); setLoading(false); return; }
      if (!data.is_active) { setError("هذا الرابط غير مفعّل"); setLoading(false); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setError("انتهت صلاحية هذا الرابط"); setLoading(false); return; }
      setPreview(data);
      // Increment views
      import("./ReviewService.js").then(m=>m.incrementViewCount(data.id));
      import("./ReviewService.js").then(m=>m.logReviewAction({previewId:data.id,action:"preview_opened",details:{token}}));
      // Load comments
      const c = await import("./ReviewService.js").then(m=>m.fetchComments(data.id));
      setComments(c.data||[]);
      setLoading(false);
    }
    load();
  },[token]);

  const survey = preview ? surveys.find(s=>s.id===preview.survey_id) : null;
  const canComment = preview && ["comment_only","simulation_comment","approve","admin"].includes(preview.permission);
  const canApprove = preview && ["approve","admin"].includes(preview.permission);

  async function sendComment() {
    if (!newCmt.trim()) return;
    setSaving(true);
    await addComment({ previewId:preview.id, reviewerName:name||"مجهول", content:newCmt });
    setNewCmt("");
    const c = await import("./ReviewService.js").then(m=>m.fetchComments(preview.id));
    setComments(c.data||[]);
    setSaving(false);
  }

  async function sendApproval(decision) {
    await submitApproval({ previewId:preview.id, surveyId:preview.survey_id, decision, reviewerName:name||"مجهول" });
    alert(decision==="approved" ? "✅ تم إرسال الاعتماد بنجاح" : "📝 تم إرسال طلب التعديل");
  }

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:R.bg}}>
      <div style={{width:40,height:40,borderRadius:"50%",border:`3px solid ${R.e100}`,borderTopColor:R.e600,animation:"spin 0.7s linear infinite"}}/>
    </div>
  );

  if (error) return (
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${R.e900},${R.e800})`,display:"flex",alignItems:"center",justifyContent:"center",direction:"rtl",padding:24,textAlign:"center"}}>
      <div style={{background:"rgba(255,255,255,0.95)",borderRadius:24,padding:36,maxWidth:360,width:"100%"}}>
        <div style={{fontSize:56,marginBottom:16}}>🔒</div>
        <h2 style={{margin:"0 0 8px",fontSize:18,color:R.s900,fontWeight:800}}>رابط غير صالح</h2>
        <p style={{margin:0,fontSize:13,color:R.s500}}>{error}</p>
      </div>
    </div>
  );

  if (!nameSet && preview?.allow_anonymous===false) {
    return (
      <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${R.e900},${R.e800})`,display:"flex",alignItems:"center",justifyContent:"center",direction:"rtl",padding:24}}>
        <div style={{background:"rgba(255,255,255,0.95)",borderRadius:24,padding:36,maxWidth:360,width:"100%",textAlign:"center"}}>
          <div style={{fontSize:44,marginBottom:12}}>👤</div>
          <h2 style={{margin:"0 0 6px",fontSize:18,color:R.s900,fontWeight:800}}>تعريف المراجع</h2>
          <p style={{margin:"0 0 20px",fontSize:13,color:R.s500}}>يرجى إدخال اسمك قبل البدء</p>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="اسمك أو بريدك" style={{...iSt(),marginBottom:12,textAlign:"center"}}/>
          <RBtn onClick={()=>setNameSet(true)} disabled={!name.trim()} style={{width:"100%"}}>متابعة ←</RBtn>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:R.bg,direction:"rtl"}}>
      {/* Preview header */}
      <div style={{background:`linear-gradient(135deg,${R.e900},${R.e800})`,padding:"14px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{background:"rgba(255,255,255,0.15)",borderRadius:8,padding:"3px 10px",fontSize:10,color:"#fff",fontWeight:700}}>🔍 وضع المراجعة الآمن</span>
          <span style={{background:R.warnBg,borderRadius:8,padding:"3px 10px",fontSize:10,color:R.warn,fontWeight:700}}>لا تُحفظ إجابات</span>
        </div>
        <h1 style={{margin:"4px 0 0",fontSize:16,fontWeight:800,color:"#fff"}}>{survey?.title||preview.title}</h1>
        {preview.notes && <p style={{margin:"4px 0 0",fontSize:11,color:"rgba(255,255,255,0.65)"}}>{preview.notes}</p>}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:R.white,borderBottom:`1px solid ${R.s200}`}}>
        {[["survey","📋 الاستبيان"],canComment&&["comments","💬 تعليقات"],canApprove&&["approve","✅ اعتماد"]].filter(Boolean).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"11px 4px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:tab===k?700:500,color:tab===k?R.e700:R.s500,borderBottom:`2px solid ${tab===k?R.e600:"transparent"}`,marginBottom:-1}}>{l}</button>
        ))}
      </div>

      <div style={{maxWidth:600,margin:"0 auto",padding:16}}>
        {tab==="survey" && survey && (
          <div>
            <div style={{background:R.warnBg,border:`1px solid ${R.warn}30`,borderRadius:12,padding:12,marginBottom:14}}>
              <p style={{margin:0,fontSize:12,color:R.warn,fontWeight:700}}>⚠️ هذا وضع المعاينة — لن تُحفظ أي بيانات</p>
            </div>
            {(survey.questions||[]).map((q,i)=>(
              <div key={q.id} style={{background:R.white,borderRadius:16,border:`1px solid ${R.s200}`,padding:14,marginBottom:10,boxShadow:"0 2px 6px rgba(0,0,0,0.04)"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:10}}>
                  <span style={{background:R.e50,color:R.e700,borderRadius:8,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</span>
                  <p style={{margin:0,fontSize:14,fontWeight:700,color:R.s900,flex:1,lineHeight:1.5}}>
                    {q.label}{q.required&&<span style={{color:R.danger,marginRight:4}}>*</span>}
                  </p>
                </div>
                {q.type==="text"     && <input disabled placeholder="نص قصير..." style={{...iSt({background:R.s50}),cursor:"not-allowed"}}/>}
                {q.type==="textarea" && <textarea disabled rows={2} placeholder="نص طويل..." style={{...iSt({background:R.s50,resize:"none"}),cursor:"not-allowed"}}/>}
                {q.type==="number"   && <input type="number" disabled placeholder="0" style={{...iSt({background:R.s50}),cursor:"not-allowed"}}/>}
                {q.type==="select"   && (q.options||[]).map(opt=>(
                  <div key={opt} style={{padding:"10px 14px",border:`1.5px solid ${R.s200}`,borderRadius:10,marginBottom:6,background:R.s50,fontSize:13,color:R.s500}}>{opt}</div>
                ))}
                {q.type==="rating"   && (
                  <div style={{display:"flex",gap:6}}>
                    {[1,2,3,4,5].map(n=><span key={n} style={{fontSize:24,color:R.s200,cursor:"not-allowed"}}>★</span>)}
                  </div>
                )}
                {q.type==="file"     && <div style={{padding:"16px",border:`2px dashed ${R.s200}`,borderRadius:10,textAlign:"center",color:R.s400,fontSize:12}}>📎 رفع ملف (معطّل في المعاينة)</div>}
                {canComment && (
                  <div style={{marginTop:10,paddingTop:8,borderTop:`1px solid ${R.s100}`}}>
                    <p style={{margin:"0 0 4px",fontSize:10,color:R.s400}}>💬 {comments.filter(c=>c.question_id===q.id).length} تعليق</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab==="comments" && canComment && (
          <div>
            <div style={{background:R.white,borderRadius:14,border:`1px solid ${R.s200}`,padding:14,marginBottom:14}}>
              <p style={{margin:"0 0 8px",fontSize:13,fontWeight:700,color:R.s700}}>➕ تعليق جديد</p>
              <textarea value={newCmt} onChange={e=>setNewCmt(e.target.value)} rows={3}
                placeholder="اكتب ملاحظاتك أو تعليقاتك على الاستبيان..."
                style={{...iSt(),resize:"vertical",marginBottom:8}}/>
              <RBtn sm onClick={sendComment} loading={saving} disabled={!newCmt.trim()}>💬 إرسال</RBtn>
            </div>
            {comments.filter(c=>!c.parent_id).map(c=>(
              <div key={c.id} style={{background:R.white,borderRadius:12,border:`1px solid ${R.s200}`,padding:12,marginBottom:8}}>
                <p style={{margin:"0 0 2px",fontSize:12,fontWeight:700,color:R.s700}}>{c.reviewer_name}</p>
                <p style={{margin:"0 0 4px",fontSize:13,color:R.s900,lineHeight:1.6}}>{c.content}</p>
                <p style={{margin:0,fontSize:10,color:R.s400}}>{new Date(c.created_at).toLocaleString("ar-SA")}</p>
              </div>
            ))}
          </div>
        )}

        {tab==="approve" && canApprove && (
          <div>
            <div style={{background:R.white,borderRadius:16,border:`1px solid ${R.s200}`,padding:20,textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:14}}>✅</div>
              <p style={{margin:"0 0 6px",fontSize:15,fontWeight:800,color:R.s900}}>قرار الاعتماد</p>
              <p style={{margin:"0 0 20px",fontSize:12,color:R.s500}}>راجعت الاستبيان كاملاً وأرغب في:</p>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>sendApproval("approved")} style={{flex:1,padding:"14px",border:`2px solid ${R.success}`,borderRadius:14,background:R.successBg,color:R.success,fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:13}}>✅ اعتماد</button>
                <button onClick={()=>sendApproval("changes_requested")} style={{flex:1,padding:"14px",border:`2px solid ${R.danger}`,borderRadius:14,background:R.dangerBg,color:R.danger,fontFamily:"inherit",fontWeight:800,cursor:"pointer",fontSize:13}}>📝 يحتاج تعديل</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

