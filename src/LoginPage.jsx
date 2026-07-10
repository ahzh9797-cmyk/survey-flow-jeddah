/**
 * LoginPage — Premium Enterprise Redesign
 * وزارة التعليم — منظومة الاستبيانات
 *
 * Visual redesign ONLY — zero logic changes.
 * All handlers, state, and auth preserved exactly.
 */

import { useState } from "react";
import { supabase, C } from "./lib.jsx";

// Design Tokens 
const T = {
 // Emerald scale
 emerald900: "#064E3B",
 emerald800: "#065F46",
 emerald700: "#047857",
 emerald600: "#059669",
 emerald500: "#10B981",
 emerald100: "#D1FAE5",
 emerald50: "#ECFDF5",

 // Gold
 gold: "#C9A84C",
 goldLight: "#F5E6B8",
 goldDark: "#A8883A",

 // Neutrals
 slate900: "#0F172A",
 slate700: "#334155",
 slate500: "#64748B",
 slate400: "#94A3B8",
 slate200: "#E2E8F0",
 slate100: "#F1F5F9",
 slate50: "#F8FAFC",
 white: "#FFFFFF",

 // Status
 danger: "#DC2626",
 dangerBg: "#FEF2F2",
 success: "#059669",
};

// Keyframe injection 
if (typeof document !== "undefined" && !document.getElementById("login-premium-styles")) {
 const s = document.createElement("style");
 s.id = "login-premium-styles";
 s.textContent = `
 @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap');

 .lp-input {
 transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
 }
 .lp-input:focus {
 border-color: #059669 !important;
 box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important;
 background: #ffffff !important;
 outline: none;
 }
 .lp-btn-primary {
 transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
 }
 .lp-btn-primary:hover:not(:disabled) {
 transform: translateY(-1px);
 box-shadow: 0 8px 28px rgba(4,120,87,0.45) !important;
 }
 .lp-btn-primary:active:not(:disabled) {
 transform: translateY(0px) scale(0.99);
 }
 .lp-card {
 animation: lp-rise 0.5s cubic-bezier(0.22,1,0.36,1) both;
 }
 .lp-logo {
 animation: lp-logo-in 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both;
 }
 .lp-tab-active {
 transition: all 0.2s ease;
 }
 .lp-link {
 transition: color 0.15s ease;
 }
 .lp-link:hover { color: #047857 !important; }

 @keyframes lp-rise {
 from { opacity: 0; transform: translateY(20px) scale(0.98); }
 to { opacity: 1; transform: translateY(0) scale(1); }
 }
 @keyframes lp-logo-in {
 from { opacity: 0; transform: scale(0.8) rotate(-4deg); }
 to { opacity: 1; transform: scale(1) rotate(0deg); }
 }
 @keyframes lp-spin {
 to { transform: rotate(360deg); }
 }
 .lp-spinner {
 width: 18px; height: 18px;
 border: 2px solid rgba(255,255,255,0.3);
 border-top-color: #fff;
 border-radius: 50%;
 animation: lp-spin 0.7s linear infinite;
 display: inline-block;
 }
 `;
 document.head.appendChild(s);
}

// Sub-components 

function BgDecor() {
 return (
 <div style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
 {/* main gradient */}
 <div style={{
 position:"absolute", inset:0,
 background:`linear-gradient(150deg, ${T.emerald900} 0%, ${T.emerald800} 40%, #083d2e 100%)`,
 }}/>
 {/* top-right orb */}
 <div style={{
 position:"absolute", top:-120, right:-120,
 width:400, height:400, borderRadius:"50%",
 background:`radial-gradient(circle, ${T.emerald700}50 0%, transparent 70%)`,
 filter:"blur(40px)",
 }}/>
 {/* bottom-left orb */}
 <div style={{
 position:"absolute", bottom:-80, left:-80,
 width:320, height:320, borderRadius:"50%",
 background:`radial-gradient(circle, ${T.emerald600}35 0%, transparent 70%)`,
 filter:"blur(50px)",
 }}/>
 {/* gold accent dot */}
 <div style={{
 position:"absolute", top:"30%", left:"8%",
 width:6, height:6, borderRadius:"50%",
 background:T.gold, opacity:0.5,
 boxShadow:`0 0 20px ${T.gold}`,
 }}/>
 <div style={{
 position:"absolute", top:"60%", right:"10%",
 width:4, height:4, borderRadius:"50%",
 background:T.gold, opacity:0.35,
 }}/>
 {/* subtle grid */}
 <div style={{
 position:"absolute", inset:0, opacity:0.03,
 backgroundImage:`linear-gradient(${T.white} 1px, transparent 1px), linear-gradient(90deg, ${T.white} 1px, transparent 1px)`,
 backgroundSize:"40px 40px",
 }}/>
 </div>
 );
}

function LogoArea({ schoolCount }) {
 return (
 <div className="lp-logo" style={{ textAlign:"center", marginBottom:32 }}>
 {/* Ministry emblem placeholder */}
 <div style={{
 width:80, height:80, margin:"0 auto 16px",
 borderRadius:24,
 background:`linear-gradient(145deg, ${T.emerald600}, ${T.emerald800})`,
 display:"flex", alignItems:"center", justifyContent:"center",
 fontSize:36,
 boxShadow:`0 12px 32px rgba(4,120,87,0.5), 0 0 0 1px rgba(255,255,255,0.1)`,
 position:"relative",
 }}>
 
 {/* gold ring accent */}
 <div style={{
 position:"absolute", inset:-3,
 borderRadius:27,
 border:`1.5px solid ${T.gold}40`,
 }}/>
 </div>

 <h1 style={{
 margin:0, color:T.white, fontSize:22, fontWeight:800,
 letterSpacing:"-0.01em", lineHeight:1.2,
 textShadow:"0 2px 12px rgba(0,0,0,0.3)",
 }}>
 منظومة الاستبيانات
 </h1>
 <p style={{
 margin:"6px 0 0", color:`rgba(255,255,255,0.6)`,
 fontSize:13, fontWeight:400, letterSpacing:"0.01em",
 }}>
 الإدارة التعليمية — جدة
 {schoolCount > 0 && (
 <span style={{
 marginRight:8, paddingRight:8,
 borderRight:`1px solid rgba(255,255,255,0.2)`,
 color:`rgba(255,255,255,0.4)`,
 }}>
 {schoolCount} مدرسة
 </span>
 )}
 </p>
 </div>
 );
}

function TabBar({ mode, setMode, resetMessages }) {
 return (
 <div style={{
 display:"flex", marginBottom:28, gap:4,
 background:`rgba(0,0,0,0.04)`,
 borderRadius:14, padding:4,
 }}>
 {[["login","تسجيل الدخول"],["signup","حساب جديد"]].map(([k,l]) => (
 <button key={k} onClick={()=>{ setMode(k); resetMessages(); }} style={{
 flex:1, padding:"10px 0", border:"none", cursor:"pointer",
 borderRadius:10, fontSize:13, fontFamily:"inherit", fontWeight:700,
 transition:"all 0.2s ease",
 background: mode===k ? T.white : "transparent",
 color: mode===k ? T.emerald800 : T.slate500,
 boxShadow: mode===k ? "0 2px 8px rgba(0,0,0,0.10)" : "none",
 }}>{l}</button>
 ))}
 </div>
 );
}

function InputField({ label, type="text", value, onChange, placeholder, icon, onKeyDown, autoComplete }) {
 const [focused, setFocused] = useState(false);
 return (
 <div style={{ marginBottom:16 }}>
 <label style={{
 display:"block", fontSize:12, fontWeight:700,
 color: focused ? T.emerald700 : T.slate500,
 marginBottom:7, transition:"color 0.2s",
 letterSpacing:"0.02em",
 }}>
 {label}
 </label>
 <div style={{ position:"relative" }}>
 {/* icon */}
 <span style={{
 position:"absolute", top:"50%", right:14,
 transform:"translateY(-50%)", fontSize:16,
 color: focused ? T.emerald600 : T.slate400,
 transition:"color 0.2s", pointerEvents:"none",
 lineHeight:1,
 }}>
 {icon}
 </span>
 <input
 className="lp-input"
 type={type}
 value={value}
 onChange={onChange}
 placeholder={placeholder}
 onKeyDown={onKeyDown}
 onFocus={()=>setFocused(true)}
 onBlur={()=>setFocused(false)}
 autoComplete={autoComplete}
 style={{
 width:"100%", boxSizing:"border-box",
 padding:"13px 44px 13px 16px",
 border:`1.5px solid ${focused ? T.emerald500 : T.slate200}`,
 borderRadius:12, fontSize:15, fontFamily:"inherit",
 direction: type==="email"||type==="password" ? "ltr" : "rtl",
 textAlign: type==="email"||type==="password" ? "left" : "right",
 background: focused ? T.white : T.slate50,
 color:T.slate900,
 boxShadow: focused ? `0 0 0 3px rgba(5,150,105,0.12)` : "none",
 }}
 />
 </div>
 </div>
 );
}

function PrimaryButton({ children, onClick, loading, disabled }) {
 return (
 <button
 className="lp-btn-primary"
 onClick={onClick}
 disabled={disabled || loading}
 style={{
 width:"100%", padding:"15px 24px",
 border:"none", borderRadius:14, cursor: (disabled||loading) ? "not-allowed" : "pointer",
 fontSize:15, fontWeight:800, fontFamily:"inherit",
 color:T.white, letterSpacing:"0.01em",
 background: (disabled||loading)
 ? `linear-gradient(135deg, ${T.emerald700}, ${T.emerald800})`
 : `linear-gradient(135deg, ${T.emerald600} 0%, ${T.emerald800} 100%)`,
 boxShadow: (disabled||loading) ? "none" : `0 4px 20px rgba(4,120,87,0.35)`,
 opacity: (disabled||loading) ? 0.7 : 1,
 display:"flex", alignItems:"center", justifyContent:"center", gap:10,
 }}
 >
 {loading ? <><span className="lp-spinner"/><span>جاري التحقق...</span></> : children}
 </button>
 );
}

function AlertBanner({ message, type="error" }) {
 if (!message) return null;
 const isError = type === "error";
 return (
 <div style={{
 display:"flex", alignItems:"flex-start", gap:10,
 background: isError ? T.dangerBg : "#ECFDF5",
 border:`1px solid ${isError ? "#FECACA" : "#A7F3D0"}`,
 borderRadius:12, padding:"12px 14px", marginBottom:16,
 fontSize:13, color: isError ? T.danger : T.success,
 lineHeight:1.6,
 }}>
 <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>
 {isError ? "" : ""}
 </span>
 <span>{message}</span>
 </div>
 );
}

function Divider() {
 return (
 <div style={{
 display:"flex", alignItems:"center", gap:12, margin:"20px 0",
 }}>
 <div style={{ flex:1, height:1, background:T.slate200 }}/>
 <span style={{ fontSize:11, color:T.slate400, fontWeight:500 }}>أو</span>
 <div style={{ flex:1, height:1, background:T.slate200 }}/>
 </div>
 );
}

// Main Component 
export default function LoginPage({ onLogin }) {
 const [mode, setMode] = useState("login");
 const [email, setEmail] = useState("");
 const [pass, setPass] = useState("");
 const [displayName, setDisplayName] = useState("");
 const [err, setErr] = useState("");
 const [info, setInfo] = useState("");
 const [loading, setLoading] = useState(false);

 // school count for subtitle (non-blocking) 
 const [schoolCount, setSchoolCount] = useState(0);
 useState(() => {
 supabase.from("survey_schools")
 .select("*", { count:"exact", head:true })
 .then(({ count }) => setSchoolCount(count || 0));
 });

 function resetMessages() { setErr(""); setInfo(""); }

 // handlers preserved exactly 
 async function handleLogin() {
 resetMessages(); setLoading(true);
 const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
 if (error) { setLoading(false); setErr("البريد أو كلمة المرور غير صحيحة"); return; }
 const { data: roleRow } = await supabase.from("user_roles").select("status").eq("user_id", data.user.id).maybeSingle();
 setLoading(false);
 if (roleRow?.status === "pending") {
 setErr("حسابك بانتظار موافقة المدير العام. سيتم إشعارك عند القبول.");
 await supabase.auth.signOut(); return;
 }
 if (roleRow?.status === "rejected") {
 setErr("تم رفض طلب تسجيلك. تواصل مع المدير العام لمزيد من التفاصيل.");
 await supabase.auth.signOut(); return;
 }
 onLogin(data.user);
 }

 async function handleSignup() {
 resetMessages();
 if (!displayName.trim()) { setErr("الرجاء إدخال الاسم"); return; }
 if (pass.length < 6) { setErr("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
 setLoading(true);
 const { data, error } = await supabase.auth.signUp({ email, password: pass });
 if (error) {
 setLoading(false);
 setErr(error.message.includes("already") ? "هذا البريد مسجّل مسبقاً" : "فشل إنشاء الحساب: " + error.message);
 return;
 }
 if (data.user) {
 await supabase.from("user_roles").insert({
 user_id: data.user.id, role:"viewer", status:"pending", display_name: displayName.trim(),
 });
 }
 setLoading(false);
 setInfo("تم إنشاء حسابك بنجاح. هو الآن بانتظار موافقة المدير العام، وستتمكن من الدخول فور القبول.");
 setMode("login"); setPass("");
 }

 async function handleReset() {
 resetMessages();
 if (!email.trim()) { setErr("الرجاء إدخال البريد الإلكتروني أولاً"); return; }
 setLoading(true);
 const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
 setLoading(false);
 if (error) { setErr("تعذّر إرسال رابط إعادة التعيين"); return; }
 setInfo("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني");
 }
 // 

 return (
 <div style={{
 minHeight:"100vh", display:"flex", flexDirection:"column",
 alignItems:"center", justifyContent:"center",
 padding:"24px 20px", direction:"rtl",
 fontFamily:"'Tajawal','Segoe UI',Tahoma,Arial,sans-serif",
 position:"relative",
 }}>
 <BgDecor/>

 {/* Content */}
 <div style={{ width:"100%", maxWidth:400, position:"relative", zIndex:1 }}>

 <LogoArea schoolCount={schoolCount}/>

 {/* Card */}
 <div className="lp-card" style={{
 background:"rgba(255,255,255,0.97)",
 borderRadius:24,
 padding:"28px 24px 24px",
 boxShadow:`
 0 32px 80px rgba(0,0,0,0.28),
 0 8px 24px rgba(0,0,0,0.12),
 0 0 0 1px rgba(255,255,255,0.15)
 `,
 backdropFilter:"blur(12px)",
 WebkitBackdropFilter:"blur(12px)",
 }}>

 {/* Tab bar — shown for login/signup, hidden for reset */}
 {mode !== "reset" && (
 <TabBar mode={mode} setMode={setMode} resetMessages={resetMessages}/>
 )}

 {/* Reset mode header */}
 {mode === "reset" && (
 <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
 <button onClick={()=>{ setMode("login"); resetMessages(); }} style={{
 background:T.emerald50, border:"none", borderRadius:10,
 width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center",
 fontSize:18, cursor:"pointer", color:T.emerald700, flexShrink:0,
 }}>←</button>
 <div>
 <p style={{ margin:0, fontSize:15, fontWeight:800, color:T.slate900 }}>استرجاع كلمة المرور</p>
 <p style={{ margin:"1px 0 0", fontSize:12, color:T.slate500 }}>سنرسل لك رابط التغيير</p>
 </div>
 </div>
 )}

 {/* Signup — name field */}
 {mode === "signup" && (
 <InputField
 label="الاسم الكامل"
 value={displayName}
 onChange={e=>setDisplayName(e.target.value)}
 placeholder="اسمك كما هو رسمياً"
 icon=""
 />
 )}

 {/* Email */}
 <InputField
 label="البريد الإلكتروني"
 type="email"
 value={email}
 onChange={e=>setEmail(e.target.value)}
 placeholder="admin@moe.edu.sa"
 icon=""
 autoComplete={mode==="login" ? "username" : "email"}
 />

 {/* Password */}
 {mode !== "reset" && (
 <InputField
 label="كلمة المرور"
 type="password"
 value={pass}
 onChange={e=>setPass(e.target.value)}
 placeholder="••••••••"
 icon=""
 onKeyDown={e=>e.key==="Enter" && (mode==="login" ? handleLogin() : handleSignup())}
 autoComplete={mode==="login" ? "current-password" : "new-password"}
 />
 )}

 {/* Alerts */}
 <AlertBanner message={err} type="error"/>
 <AlertBanner message={info} type="success"/>

 {/* Primary action */}
 {mode === "login" && (
 <PrimaryButton onClick={handleLogin} loading={loading}
 disabled={!email.trim()||!pass.trim()}>
 دخول إلى المنظومة
 </PrimaryButton>
 )}
 {mode === "signup" && (
 <PrimaryButton onClick={handleSignup} loading={loading}
 disabled={!email.trim()||!pass.trim()||!displayName.trim()}>
 إنشاء الحساب
 </PrimaryButton>
 )}
 {mode === "reset" && (
 <PrimaryButton onClick={handleReset} loading={loading}
 disabled={!email.trim()}>
 إرسال رابط إعادة التعيين
 </PrimaryButton>
 )}

 {/* Secondary links */}
 {mode === "login" && (
 <div style={{ textAlign:"center", marginTop:18 }}>
 <button onClick={()=>{ setMode("reset"); resetMessages(); }}
 className="lp-link"
 style={{
 background:"none", border:"none", cursor:"pointer",
 fontSize:13, color:T.slate500, fontFamily:"inherit",
 padding:"6px 0",
 }}>
 نسيت كلمة المرور؟
 </button>
 </div>
 )}
 </div>

 {/* Footer */}
 <p style={{
 textAlign:"center", color:"rgba(255,255,255,0.35)",
 fontSize:11, marginTop:24, lineHeight:1.6,
 }}>
 منظومة الاستبيانات · إدارة التعليم بجدة<br/>
 جميع الحقوق محفوظة {new Date().getFullYear()}
 </p>
 </div>
 </div>
 );
}


