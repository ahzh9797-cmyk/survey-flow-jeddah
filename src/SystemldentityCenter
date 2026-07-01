/**
 * SystemIdentityCenter.jsx
 * هوية النظام — System Identity Center
 * 
 * Standalone module — does NOT touch survey logic, routing, auth, or APIs.
 * Saves to: system_settings table in Supabase (key/value or JSONB column).
 * Admins only. Read-only for everyone else.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib.jsx";

// ── Design tokens ──────────────────────────────────────
const T = {
  e900:"#064E3B",e800:"#065F46",e700:"#047857",e600:"#059669",e500:"#10B981",
  e100:"#D1FAE5",e50:"#ECFDF5",
  s900:"#0F172A",s800:"#1E293B",s700:"#334155",s600:"#475569",s500:"#64748B",
  s400:"#94A3B8",s300:"#CBD5E1",s200:"#E2E8F0",s100:"#F1F5F9",s50:"#F8FAFC",
  white:"#FFFFFF",bg:"#F0F4F8",
  danger:"#DC2626",dangerBg:"#FEF2F2",
  warn:"#D97706",warnBg:"#FFFBEB",
  success:"#059669",successBg:"#ECFDF5",
  purple:"#7B2D8B",purpleBg:"#F5EEFA",
  gold:"#C9A84C",goldL:"#FEF3C7",
};

if (typeof document !== "undefined" && !document.getElementById("sic-styles")) {
  const s = document.createElement("style");
  s.id = "sic-styles";
  s.textContent = `
    .sic-card { transition: box-shadow 0.15s ease; }
    .sic-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.07) !important; }
    .sic-input:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.10) !important; outline: none; }
    .sic-tab { transition: all 0.15s ease; }
    .sic-upload { transition: border-color 0.2s, background 0.2s; }
    .sic-upload:hover { border-color: #059669 !important; background: #ECFDF5 !important; }
    .sic-btn { transition: all 0.12s ease; }
    .sic-btn:active { transform: scale(0.97); }
    @keyframes sic-in { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
    .sic-in { animation: sic-in 0.2s ease both; }
    @keyframes spin { to { transform: rotate(360deg) } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .sic-saving { animation: pulse 1s infinite; }

    /* Responsive grid */
    .sic-grid-2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
    @media (min-width: 768px) { .sic-grid-2 { grid-template-columns: repeat(2, 1fr); } }
    .sic-grid-3 { display: grid; grid-template-columns: 1fr; gap: 14px; }
    @media (min-width: 768px) { .sic-grid-3 { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 1200px) { .sic-grid-3 { grid-template-columns: repeat(3, 1fr); } }

    /* Social preview cards */
    .sic-preview-wa  { background: #e7fce7; border: 1px solid #c3e6c3; }
    .sic-preview-fb  { background: #e7eeff; border: 1px solid #c3cdf0; }
    .sic-preview-tw  { background: #e8f4fd; border: 1px solid #bee3f8; }
    .sic-preview-tg  { background: #e8f3fb; border: 1px solid #b4d9f5; }
    .sic-preview-goo { background: #fff; border: 1px solid #ddd; }
    .sic-preview-li  { background: #e8f0f7; border: 1px solid #b9cfe8; }
  `;
  document.head.appendChild(s);
}

// ── Supabase helpers ───────────────────────────────────
const SETTINGS_TABLE = "system_settings";
const SETTINGS_KEY   = "identity";

async function loadSettings() {
  const { data } = await supabase
    .from(SETTINGS_TABLE)
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return data?.value || {};
}

async function saveSettings(value) {
  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert({ key: SETTINGS_KEY, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return error;
}

async function uploadFile(bucket, path, file) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) return { url: null, error };
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: pub.publicUrl, error: null };
}

// ── Shared UI ──────────────────────────────────────────
const iSt = (extra={}) => ({
  width:"100%", padding:"10px 13px", border:`1.5px solid ${T.s200}`,
  borderRadius:10, fontSize:13, fontFamily:"inherit", direction:"rtl",
  boxSizing:"border-box", background:T.white, color:T.s900,
  transition:"border-color 0.2s", ...extra,
});

function Field({ label, hint, children }) {
  return (
    <div style={{marginBottom:14}}>
      {label && <label style={{display:"block",fontSize:12,fontWeight:700,color:T.s700,marginBottom:5}}>{label}</label>}
      {hint && <p style={{margin:"0 0 5px",fontSize:11,color:T.s400,lineHeight:1.5}}>{hint}</p>}
      {children}
    </div>
  );
}

function SICInput({ value, onChange, placeholder, dir="rtl", type="text", disabled=false }) {
  return (
    <input className="sic-input" type={type} value={value||""} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      style={{...iSt({direction:dir,background:disabled?T.s50:T.white,color:disabled?T.s400:T.s900})}}/>
  );
}

function SICTextarea({ value, onChange, rows=3, placeholder }) {
  return (
    <textarea className="sic-input" value={value||""} onChange={e=>onChange(e.target.value)}
      rows={rows} placeholder={placeholder}
      style={{...iSt({resize:"vertical"})}}/>
  );
}

function SICColor({ value, onChange, label }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <input type="color" value={value||"#059669"} onChange={e=>onChange(e.target.value)}
        style={{width:40,height:36,border:`1.5px solid ${T.s200}`,borderRadius:8,cursor:"pointer",padding:2,flexShrink:0}}/>
      <input className="sic-input" value={value||""} onChange={e=>onChange(e.target.value)}
        placeholder="#059669" style={{...iSt({fontFamily:"monospace",fontSize:12,marginBottom:0,flex:1})}}/>
    </div>
  );
}

function UploadZone({ label, hint, value, onChange, accept="image/*", bucket="system-assets", path }) {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");
  const ref = useRef();

  async function handleFile(file) {
    if (!file) return;
    setUploading(true); setError("");
    const ext = file.name.split(".").pop();
    const filePath = `${path || label.replace(/\s+/g,"-")}-${Date.now()}.${ext}`;
    const { url, error:err } = await uploadFile(bucket, filePath, file);
    setUploading(false);
    if (err) { setError("فشل الرفع: " + err.message); return; }
    onChange(url);
  }

  return (
    <div>
      <div className="sic-upload" onClick={()=>ref.current?.click()}
        style={{
          border:`2px dashed ${T.s300}`, borderRadius:14, padding:"20px 16px",
          textAlign:"center", cursor:"pointer", background:T.s50, marginBottom:6,
          position:"relative",
        }}>
        {uploading && (
          <div style={{position:"absolute",inset:0,background:"rgba(255,255,255,0.8)",
            display:"flex",alignItems:"center",justifyContent:"center",borderRadius:14}}>
            <div style={{width:24,height:24,borderRadius:"50%",border:`3px solid ${T.e100}`,
              borderTopColor:T.e600,animation:"spin 0.7s linear infinite"}}/>
          </div>
        )}
        {value ? (
          <div>
            <img src={value} alt={label}
              style={{maxHeight:72,maxWidth:"100%",objectFit:"contain",borderRadius:8,marginBottom:8}}/>
            <p style={{margin:0,fontSize:11,color:T.e700,fontWeight:600}}>اضغط لتغيير الصورة</p>
          </div>
        ) : (
          <>
            <div style={{fontSize:32,marginBottom:8}}>📁</div>
            <p style={{margin:"0 0 3px",fontSize:13,fontWeight:700,color:T.s700}}>{label}</p>
            {hint && <p style={{margin:0,fontSize:11,color:T.s400}}>{hint}</p>}
          </>
        )}
      </div>
      {error && <p style={{margin:"0 0 4px",fontSize:11,color:T.danger}}>{error}</p>}
      {value && (
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>onChange("")} className="sic-btn"
            style={{fontSize:10,color:T.danger,background:T.dangerBg,border:"none",
              borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
            حذف
          </button>
          <a href={value} target="_blank" rel="noopener noreferrer"
            style={{fontSize:10,color:T.e700,background:T.e50,borderRadius:7,
              padding:"4px 10px",textDecoration:"none",fontWeight:600}}>
            عرض ↗
          </a>
        </div>
      )}
      <input ref={ref} type="file" accept={accept} style={{display:"none"}}
        onChange={e=>handleFile(e.target.files?.[0])}/>
    </div>
  );
}

function SectionCard({ title, icon, children, accent=T.e600 }) {
  return (
    <div className="sic-card sic-in" style={{
      background:T.white, borderRadius:18, border:`1px solid ${T.s200}`,
      overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", marginBottom:18,
    }}>
      <div style={{
        padding:"14px 18px", borderBottom:`1px solid ${T.s100}`,
        display:"flex", alignItems:"center", gap:10,
        borderRight:`4px solid ${accent}`,
      }}>
        <span style={{fontSize:18}}>{icon}</span>
        <h3 style={{margin:0,fontSize:14,fontWeight:800,color:T.s900}}>{title}</h3>
      </div>
      <div style={{padding:"18px 18px 20px"}}>{children}</div>
    </div>
  );
}

function SaveBar({ saving, saved, error, onSave, readOnly }) {
  if (readOnly) return (
    <div style={{background:T.warnBg,border:`1px solid ${T.warn}30`,borderRadius:12,
      padding:"10px 16px",marginBottom:18,fontSize:13,color:T.warn,fontWeight:600,
      display:"flex",alignItems:"center",gap:8}}>
      🔒 وضع القراءة فقط — فقط المدير يمكنه التعديل
    </div>
  );

  return (
    <div style={{
      background:T.white, border:`1px solid ${T.s200}`, borderRadius:14,
      padding:"12px 16px", marginBottom:20,
      display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
      boxShadow:"0 2px 8px rgba(0,0,0,0.05)", flexWrap:"wrap",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {saving && <span className="sic-saving" style={{fontSize:12,color:T.s500}}>⏳ جاري الحفظ...</span>}
        {saved && !saving && <span style={{fontSize:12,color:T.success,fontWeight:600}}>✅ تم الحفظ</span>}
        {error && <span style={{fontSize:12,color:T.danger}}>{error}</span>}
        {!saving && !saved && !error && <span style={{fontSize:12,color:T.s400}}>أي تعديل يُحفظ فوراً</span>}
      </div>
      <button onClick={onSave} disabled={saving} className="sic-btn" style={{
        background:saving?`${T.e600}70`:`linear-gradient(135deg,${T.e600},${T.e800})`,
        color:"#fff", border:"none", borderRadius:10, padding:"9px 20px",
        fontSize:13, fontWeight:700, cursor:saving?"not-allowed":"pointer",
        fontFamily:"inherit", boxShadow:saving?"none":`0 3px 10px ${T.e600}35`,
      }}>💾 حفظ التغييرات</button>
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────
const TABS = [
  {id:"general",   label:"معلومات عامة", icon:"ℹ️"},
  {id:"branding",  label:"الشعارات",     icon:"🖼️"},
  {id:"theme",     label:"الألوان",      icon:"🎨"},
  {id:"seo",       label:"SEO & مشاركة", icon:"🔗"},
  {id:"email",     label:"البريد",       icon:"📧"},
  {id:"excel",     label:"Excel",        icon:"📊"},
  {id:"pdf",       label:"PDF",          icon:"📄"},
  {id:"pwa",       label:"PWA",          icon:"📱"},
  {id:"preview",   label:"معاينة",       icon:"👁️"},
];

// ── SECTION: General Info ─────────────────────────────
function GeneralSection({ data, set }) {
  return (
    <SectionCard title="المعلومات العامة" icon="ℹ️" accent={T.e600}>
      <div className="sic-grid-2">
        <Field label="اسم النظام"><SICInput value={data.systemName} onChange={v=>set("systemName",v)} placeholder="منظومة الاستبيانات"/></Field>
        <Field label="اسم الوزارة"><SICInput value={data.ministryName} onChange={v=>set("ministryName",v)} placeholder="وزارة التعليم"/></Field>
        <Field label="إدارة التعليم"><SICInput value={data.educationDept} onChange={v=>set("educationDept",v)} placeholder="إدارة تعليم جدة"/></Field>
        <Field label="اسم المؤسسة"><SICInput value={data.orgName} onChange={v=>set("orgName",v)} placeholder="إدارة التعليم بجدة"/></Field>
        <Field label="اسم الموقع"><SICInput value={data.websiteName} onChange={v=>set("websiteName",v)} placeholder="بوابة الاستبيانات"/></Field>
        <Field label="رابط الموقع"><SICInput value={data.websiteUrl} onChange={v=>set("websiteUrl",v)} placeholder="https://..." dir="ltr"/></Field>
        <Field label="البريد الإلكتروني للتواصل"><SICInput value={data.contactEmail} onChange={v=>set("contactEmail",v)} placeholder="info@..." dir="ltr" type="email"/></Field>
        <Field label="رقم التواصل"><SICInput value={data.contactPhone} onChange={v=>set("contactPhone",v)} placeholder="966..." dir="ltr"/></Field>
      </div>
      <Field label="نص التذييل" hint="يظهر في أسفل كل الصفحات والتقارير">
        <SICTextarea value={data.footerText} onChange={v=>set("footerText",v)} placeholder="إدارة تعليم جدة — جميع الحقوق محفوظة"/>
      </Field>
      <Field label="نص حقوق النشر">
        <SICInput value={data.copyright} onChange={v=>set("copyright",v)} placeholder={`© ${new Date().getFullYear()} إدارة تعليم جدة`}/>
      </Field>
    </SectionCard>
  );
}

// ── SECTION: Branding / Logos ─────────────────────────
function BrandingSection({ data, set }) {
  const logos = [
    {key:"systemLogo",  label:"شعار النظام",     hint:"PNG شفاف 200×200"},
    {key:"ministryLogo",label:"شعار الوزارة",    hint:"PNG شفاف 200×200"},
    {key:"favicon",     label:"Favicon",         hint:"32×32 ICO أو PNG",  accept:".ico,.png"},
    {key:"appIcon",     label:"أيقونة التطبيق", hint:"512×512 PNG"},
    {key:"sidebarLogo", label:"شعار الشريط الجانبي", hint:"مستطيل شفاف"},
    {key:"loginLogo",   label:"شعار صفحة الدخول",    hint:"بارز وواضح"},
    {key:"splashLogo",  label:"شعار شاشة البداية",   hint:"PNG شفاف"},
    {key:"darkLogo",    label:"شعار الوضع الداكن",   hint:"أبيض شفاف"},
    {key:"lightLogo",   label:"شعار الوضع الفاتح",   hint:"داكن شفاف"},
  ];

  return (
    <SectionCard title="الشعارات والأيقونات" icon="🖼️" accent={T.purple}>
      <div className="sic-grid-3">
        {logos.map(l=>(
          <div key={l.key} style={{background:T.s50,borderRadius:14,padding:14,border:`1px solid ${T.s100}`}}>
            <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color:T.s700}}>{l.label}</p>
            <UploadZone label={l.label} hint={l.hint} value={data[l.key]}
              onChange={v=>set(l.key,v)} accept={l.accept||"image/*"} path={l.key}/>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── SECTION: Theme ────────────────────────────────────
function ThemeSection({ data, set }) {
  const colors = [
    {key:"primaryColor",    label:"اللون الأساسي"},
    {key:"secondaryColor",  label:"اللون الثانوي"},
    {key:"accentColor",     label:"لون التأكيد"},
    {key:"sidebarColor",    label:"لون الشريط الجانبي"},
    {key:"headerColor",     label:"لون الرأس"},
    {key:"bgColor",         label:"لون الخلفية"},
    {key:"cardRadius",      label:"زوايا البطاقات (px)", type:"number"},
  ];

  return (
    <SectionCard title="الألوان والمظهر" icon="🎨" accent={T.gold}>
      <div className="sic-grid-2">
        {colors.map(c=>(
          <Field key={c.key} label={c.label}>
            {c.type==="number"
              ? <SICInput value={data[c.key]} onChange={v=>set(c.key,v)} placeholder="12" type="number" dir="ltr"/>
              : <SICColor value={data[c.key]} onChange={v=>set(c.key,v)}/>
            }
          </Field>
        ))}
      </div>
      <Field label="وضع العرض">
        <div style={{display:"flex",gap:10}}>
          {[["light","فاتح ☀️"],["dark","داكن 🌙"],["system","تلقائي 🔄"]].map(([v,l])=>(
            <button key={v} onClick={()=>set("colorMode",v)} className="sic-btn" style={{
              flex:1, padding:"10px 8px", borderRadius:10, cursor:"pointer",
              fontFamily:"inherit", fontSize:12, fontWeight:data.colorMode===v?700:400,
              border:`2px solid ${data.colorMode===v?T.e600:T.s200}`,
              background:data.colorMode===v?T.e50:T.white,
              color:data.colorMode===v?T.e700:T.s500,
            }}>{l}</button>
          ))}
        </div>
      </Field>
    </SectionCard>
  );
}

// ── SECTION: SEO & Link Sharing ───────────────────────
function SEOSection({ data, set }) {
  return (
    <>
      <SectionCard title="SEO — محركات البحث" icon="🔍" accent={T.e600}>
        <div className="sic-grid-2">
          <Field label="عنوان Meta"><SICInput value={data.metaTitle} onChange={v=>set("metaTitle",v)} placeholder="منظومة الاستبيانات — إدارة تعليم جدة"/></Field>
          <Field label="اللغة"><SICInput value={data.lang} onChange={v=>set("lang",v)} placeholder="ar" dir="ltr"/></Field>
        </div>
        <Field label="وصف Meta">
          <SICTextarea value={data.metaDesc} onChange={v=>set("metaDesc",v)} rows={2} placeholder="منصة الاستبيانات الرسمية لإدارة تعليم جدة"/>
        </Field>
        <Field label="الكلمات المفتاحية">
          <SICInput value={data.keywords} onChange={v=>set("keywords",v)} placeholder="استبيانات، تعليم، جدة، مدارس"/>
        </Field>
        <div className="sic-grid-2">
          <Field label="Canonical URL"><SICInput value={data.canonicalUrl} onChange={v=>set("canonicalUrl",v)} placeholder="https://..." dir="ltr"/></Field>
          <Field label="Robots">
            <select className="sic-input" value={data.robots||"index,follow"} onChange={e=>set("robots",e.target.value)}
              style={{...iSt({marginBottom:0}),background:T.white}}>
              <option value="index,follow">index, follow</option>
              <option value="noindex,follow">noindex, follow</option>
              <option value="noindex,nofollow">noindex, nofollow</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="مشاركة الروابط — Open Graph & Twitter Card" icon="🔗" accent={T.purple}>
        <div className="sic-grid-2">
          <Field label="عنوان المشاركة"><SICInput value={data.ogTitle} onChange={v=>set("ogTitle",v)} placeholder="منظومة الاستبيانات"/></Field>
          <Field label="اسم الموقع (og:site_name)"><SICInput value={data.ogSiteName} onChange={v=>set("ogSiteName",v)} placeholder="إدارة تعليم جدة"/></Field>
          <Field label="رابط الموقع (og:url)"><SICInput value={data.ogUrl} onChange={v=>set("ogUrl",v)} placeholder="https://..." dir="ltr"/></Field>
          <Field label="نوع الصفحة (og:type)">
            <select className="sic-input" value={data.ogType||"website"} onChange={e=>set("ogType",e.target.value)}
              style={{...iSt({marginBottom:0}),background:T.white}}>
              <option value="website">website</option>
              <option value="article">article</option>
            </select>
          </Field>
          <Field label="المؤلف / Author"><SICInput value={data.author} onChange={v=>set("author",v)} placeholder="إدارة تعليم جدة"/></Field>
          <Field label="لون الثيم (theme-color)"><SICColor value={data.themeColor} onChange={v=>set("themeColor",v)}/></Field>
        </div>
        <Field label="وصف المشاركة">
          <SICTextarea value={data.ogDesc} onChange={v=>set("ogDesc",v)} rows={2}/>
        </Field>
        <Field label="صورة المشاركة (1200×630)" hint="هذه الصورة تظهر عند المشاركة على واتساب وتليجرام وفيسبوك وX">
          <UploadZone label="صورة المشاركة" hint="1200×630 PNG أو JPG"
            value={data.ogImage} onChange={v=>set("ogImage",v)} path="og-image"/>
        </Field>

        <div style={{background:T.s50,borderRadius:12,padding:14,marginTop:14,border:`1px solid ${T.s100}`}}>
          <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color:T.s700}}>الوسوم المولّدة تلقائياً:</p>
          <div style={{fontFamily:"monospace",fontSize:11,color:T.s600,lineHeight:2,direction:"ltr",textAlign:"left"}}>
            {[
              `<meta property="og:title" content="${data.ogTitle||data.metaTitle||"..."}" />`,
              `<meta property="og:description" content="${data.ogDesc||data.metaDesc||"..."}" />`,
              `<meta property="og:image" content="${data.ogImage||"..."}" />`,
              `<meta property="og:url" content="${data.ogUrl||data.websiteUrl||"..."}" />`,
              `<meta property="og:type" content="${data.ogType||"website"}" />`,
              `<meta property="og:site_name" content="${data.ogSiteName||data.systemName||"..."}" />`,
              `<meta name="twitter:card" content="summary_large_image" />`,
              `<meta name="twitter:title" content="${data.ogTitle||data.metaTitle||"..."}" />`,
              `<meta name="twitter:description" content="${data.ogDesc||data.metaDesc||"..."}" />`,
              `<meta name="twitter:image" content="${data.ogImage||"..."}" />`,
            ].map((tag,i)=>(
              <div key={i} style={{padding:"1px 0",wordBreak:"break-all"}}>{tag}</div>
            ))}
          </div>
        </div>
      </SectionCard>
    </>
  );
}

// ── SECTION: Email Branding ───────────────────────────
function EmailSection({ data, set }) {
  return (
    <SectionCard title="هوية البريد الإلكتروني" icon="📧" accent="#1A73E8">
      <Field label="شعار البريد">
        <UploadZone label="شعار البريد" hint="PNG شفاف — يظهر في أعلى كل بريد" value={data.emailLogo} onChange={v=>set("emailLogo",v)} path="email-logo"/>
      </Field>
      <Field label="رأس البريد">
        <SICTextarea value={data.emailHeader} onChange={v=>set("emailHeader",v)} placeholder="إدارة تعليم جدة — المملكة العربية السعودية"/>
      </Field>
      <Field label="تذييل البريد">
        <SICTextarea value={data.emailFooter} onChange={v=>set("emailFooter",v)} placeholder="هذا البريد مُرسَل آلياً من منظومة الاستبيانات"/>
      </Field>
      <Field label="التوقيع">
        <SICTextarea value={data.emailSignature} onChange={v=>set("emailSignature",v)} rows={4} placeholder="مع تحيات&#10;إدارة تعليم جدة"/>
      </Field>
    </SectionCard>
  );
}

// ── SECTION: Excel Branding ───────────────────────────
function ExcelSection({ data, set }) {
  return (
    <SectionCard title="هوية ملفات Excel" icon="📊" accent={T.success}>
      <Field label="شعار Excel">
        <UploadZone label="شعار Excel" hint="PNG — يظهر في أعلى الملف" value={data.excelLogo} onChange={v=>set("excelLogo",v)} path="excel-logo"/>
      </Field>
      <Field label="رأس الملف">
        <SICInput value={data.excelHeader} onChange={v=>set("excelHeader",v)} placeholder="إدارة تعليم جدة — تقرير الاستبيانات"/>
      </Field>
      <Field label="تذييل الملف">
        <SICInput value={data.excelFooter} onChange={v=>set("excelFooter",v)} placeholder="سري — للاستخدام الرسمي فقط"/>
      </Field>
      <Field label="ملاحظات التصدير" hint="تظهر في أول ورقة في كل ملف Excel مُصدَّر">
        <SICTextarea value={data.excelNotes} onChange={v=>set("excelNotes",v)} rows={3} placeholder="هذا الملف مُولَّد آلياً من منظومة الاستبيانات..."/>
      </Field>
    </SectionCard>
  );
}

// ── SECTION: PDF Branding ─────────────────────────────
function PDFSection({ data, set }) {
  const assets = [
    {key:"pdfLogo",      label:"شعار PDF",         hint:"PNG شفاف"},
    {key:"pdfWatermark", label:"العلامة المائية",   hint:"PNG شفاف بدرجة شفافية"},
    {key:"pdfStamp",     label:"الختم الرسمي",      hint:"PNG دائري شفاف"},
    {key:"pdfSignature", label:"التوقيع الرسمي",    hint:"PNG شفاف"},
  ];
  return (
    <SectionCard title="هوية تقارير PDF" icon="📄" accent={T.danger}>
      <div className="sic-grid-2">
        {assets.map(a=>(
          <div key={a.key} style={{background:T.s50,borderRadius:12,padding:14,border:`1px solid ${T.s100}`}}>
            <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color:T.s700}}>{a.label}</p>
            <UploadZone label={a.label} hint={a.hint} value={data[a.key]} onChange={v=>set(a.key,v)} path={a.key}/>
          </div>
        ))}
      </div>
      <Field label="رأس PDF" hint="يظهر في أعلى كل صفحة">
        <SICInput value={data.pdfHeader} onChange={v=>set("pdfHeader",v)} placeholder="إدارة تعليم جدة — وزارة التعليم"/>
      </Field>
      <Field label="تذييل PDF" hint="يظهر في أسفل كل صفحة">
        <SICInput value={data.pdfFooter} onChange={v=>set("pdfFooter",v)} placeholder="سري — للاستخدام الرسمي"/>
      </Field>
    </SectionCard>
  );
}

// ── SECTION: PWA ──────────────────────────────────────
function PWASection({ data, set }) {
  return (
    <SectionCard title="إعدادات PWA" icon="📱" accent={T.purple}>
      <div className="sic-grid-2">
        <Field label="اسم التطبيق"><SICInput value={data.pwaName} onChange={v=>set("pwaName",v)} placeholder="منظومة الاستبيانات"/></Field>
        <Field label="الاسم المختصر"><SICInput value={data.pwaShortName} onChange={v=>set("pwaShortName",v)} placeholder="الاستبيانات"/></Field>
        <Field label="لون الثيم"><SICColor value={data.pwaThemeColor} onChange={v=>set("pwaThemeColor",v)}/></Field>
        <Field label="لون الخلفية"><SICColor value={data.pwaBgColor} onChange={v=>set("pwaBgColor",v)}/></Field>
        <Field label="اتجاه العرض">
          <select className="sic-input" value={data.pwaDisplay||"standalone"} onChange={e=>set("pwaDisplay",e.target.value)}
            style={{...iSt({marginBottom:0}),background:T.white}}>
            <option value="standalone">standalone</option>
            <option value="fullscreen">fullscreen</option>
            <option value="minimal-ui">minimal-ui</option>
            <option value="browser">browser</option>
          </select>
        </Field>
        <Field label="الاتجاه">
          <select className="sic-input" value={data.pwaOrientation||"portrait"} onChange={e=>set("pwaOrientation",e.target.value)}
            style={{...iSt({marginBottom:0}),background:T.white}}>
            <option value="portrait">portrait</option>
            <option value="landscape">landscape</option>
            <option value="any">any</option>
          </select>
        </Field>
      </div>
      <div className="sic-grid-2">
        <div style={{background:T.s50,borderRadius:12,padding:14,border:`1px solid ${T.s100}`}}>
          <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color:T.s700}}>أيقونة التطبيق (512×512)</p>
          <UploadZone label="أيقونة PWA" hint="512×512 PNG" value={data.pwaIcon} onChange={v=>set("pwaIcon",v)} path="pwa-icon"/>
        </div>
        <div style={{background:T.s50,borderRadius:12,padding:14,border:`1px solid ${T.s100}`}}>
          <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color:T.s700}}>شاشة البداية Splash</p>
          <UploadZone label="Splash Screen" hint="PNG 1242×2688" value={data.pwaSplash} onChange={v=>set("pwaSplash",v)} path="pwa-splash"/>
        </div>
      </div>

      <div style={{background:T.s50,borderRadius:12,padding:14,marginTop:4,border:`1px solid ${T.s100}`}}>
        <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color:T.s700}}>manifest.json المولَّد تلقائياً:</p>
        <pre style={{margin:0,fontSize:10,color:T.s600,direction:"ltr",textAlign:"left",overflowX:"auto",whiteSpace:"pre-wrap"}}>
{JSON.stringify({
  name: data.pwaName || "منظومة الاستبيانات",
  short_name: data.pwaShortName || "الاستبيانات",
  start_url: "/",
  display: data.pwaDisplay || "standalone",
  orientation: data.pwaOrientation || "portrait",
  theme_color: data.pwaThemeColor || "#059669",
  background_color: data.pwaBgColor || "#F0F4F8",
  icons: [
    { src: data.pwaIcon||"/icon.png", sizes:"512x512", type:"image/png", purpose:"any maskable" }
  ],
}, null, 2)}
        </pre>
      </div>
    </SectionCard>
  );
}

// ── SECTION: Live Preview ─────────────────────────────
function PreviewSection({ data }) {
  const title   = data.ogTitle   || data.metaTitle    || data.systemName || "منظومة الاستبيانات";
  const desc    = data.ogDesc    || data.metaDesc     || "المنصة الرسمية لإدارة تعليم جدة";
  const img     = data.ogImage   || data.systemLogo   || "";
  const url     = data.ogUrl     || data.websiteUrl   || "https://example.com";
  const siteName= data.ogSiteName|| data.systemName   || "إدارة تعليم جدة";
  const domain  = url.replace(/https?:\/\//, "").split("/")[0];

  return (
    <>
      {/* WhatsApp */}
      <SectionCard title="معاينة واتساب" icon="📱" accent="#25D366">
        <div className="sic-preview-wa" style={{borderRadius:12,padding:14,maxWidth:360}}>
          {img && <img src={img} alt="" style={{width:"100%",borderRadius:8,marginBottom:10,objectFit:"cover",height:180}}/>}
          <p style={{margin:"0 0 3px",fontSize:13,fontWeight:800,color:"#128C7E"}}>{title}</p>
          <p style={{margin:"0 0 4px",fontSize:11,color:"#555",lineHeight:1.5}}>{desc}</p>
          <p style={{margin:0,fontSize:10,color:"#999"}}>{domain}</p>
        </div>
      </SectionCard>

      {/* Telegram */}
      <SectionCard title="معاينة تليجرام" icon="✈️" accent="#2AABEE">
        <div className="sic-preview-tg" style={{borderRadius:12,padding:14,maxWidth:400}}>
          {img && <img src={img} alt="" style={{width:"100%",borderRadius:8,marginBottom:10,objectFit:"cover",height:180}}/>}
          <p style={{margin:"0 0 3px",fontSize:14,fontWeight:800,color:"#2AABEE"}}>{title}</p>
          <p style={{margin:"0 0 4px",fontSize:12,color:"#444",lineHeight:1.5}}>{desc}</p>
          <p style={{margin:0,fontSize:11,color:"#2AABEE"}}>{domain}</p>
        </div>
      </SectionCard>

      {/* Facebook */}
      <SectionCard title="معاينة فيسبوك" icon="👍" accent="#1877F2">
        <div className="sic-preview-fb" style={{borderRadius:12,overflow:"hidden",maxWidth:500}}>
          {img ? <img src={img} alt="" style={{width:"100%",objectFit:"cover",height:260}}/> 
            : <div style={{height:260,background:"#ddd",display:"flex",alignItems:"center",justifyContent:"center",color:"#aaa"}}>1200×630</div>}
          <div style={{padding:"10px 12px"}}>
            <p style={{margin:"0 0 2px",fontSize:11,color:"#999",textTransform:"uppercase"}}>{domain}</p>
            <p style={{margin:"0 0 3px",fontSize:14,fontWeight:800,color:"#1c1e21"}}>{title}</p>
            <p style={{margin:0,fontSize:12,color:"#606770"}}>{desc.slice(0,100)}</p>
          </div>
        </div>
      </SectionCard>

      {/* X / Twitter */}
      <SectionCard title="معاينة X (تويتر)" icon="𝕏" accent="#000">
        <div className="sic-preview-tw" style={{borderRadius:16,overflow:"hidden",maxWidth:500}}>
          {img ? <img src={img} alt="" style={{width:"100%",objectFit:"cover",height:250}}/>
            : <div style={{height:250,background:"#ddd",display:"flex",alignItems:"center",justifyContent:"center",color:"#aaa"}}>1200×630</div>}
          <div style={{padding:"12px 14px"}}>
            <p style={{margin:"0 0 3px",fontSize:15,fontWeight:800,color:"#0f1419"}}>{title}</p>
            <p style={{margin:"0 0 5px",fontSize:13,color:"#536471"}}>{desc.slice(0,100)}</p>
            <p style={{margin:0,fontSize:12,color:"#536471"}}>🔗 {domain}</p>
          </div>
        </div>
      </SectionCard>

      {/* LinkedIn */}
      <SectionCard title="معاينة LinkedIn" icon="💼" accent="#0A66C2">
        <div className="sic-preview-li" style={{borderRadius:8,overflow:"hidden",maxWidth:500}}>
          {img ? <img src={img} alt="" style={{width:"100%",objectFit:"cover",height:260}}/>
            : <div style={{height:260,background:"#ddd",display:"flex",alignItems:"center",justifyContent:"center",color:"#aaa"}}>1200×630</div>}
          <div style={{padding:"10px 12px",background:"#f3f2ef"}}>
            <p style={{margin:"0 0 2px",fontSize:14,fontWeight:700,color:"#000"}}>{title}</p>
            <p style={{margin:0,fontSize:12,color:"#666"}}>{domain}</p>
          </div>
        </div>
      </SectionCard>

      {/* Google Search */}
      <SectionCard title="معاينة Google" icon="🔍" accent="#4285F4">
        <div className="sic-preview-goo" style={{borderRadius:8,padding:16,maxWidth:500}}>
          <p style={{margin:"0 0 2px",fontSize:12,color:"#006621",direction:"ltr",textAlign:"left"}}>{url}</p>
          <p style={{margin:"0 0 4px",fontSize:18,color:"#1a0dab",textDecoration:"underline",cursor:"pointer",direction:"ltr",textAlign:"left"}}>{title}</p>
          <p style={{margin:0,fontSize:13,color:"#545454"}}>{desc.slice(0,160)}</p>
        </div>
      </SectionCard>
    </>
  );
}

// ── SQL Migration helper ──────────────────────────────
const SQL_MIGRATION = `-- System Settings table (run once in Supabase SQL editor)
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Admins can write, authenticated users can read
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_write" ON system_settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "all_read" ON system_settings
  FOR SELECT TO authenticated USING (true);

-- Initial row
INSERT INTO system_settings (key, value) VALUES ('identity', '{}')
ON CONFLICT (key) DO NOTHING;
`;

// ── MAIN ──────────────────────────────────────────────
export default function SystemIdentityCenter({ user, isAdmin }) {
  const [data,    setData]    = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState("general");
  const [showSQL, setShowSQL] = useState(false);

  useEffect(()=>{
    loadSettings().then(d=>{ setData(d); setLoading(false); });
  },[]);

  function set(key, value) {
    setData(p=>({...p,[key]:value}));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false);
    const err = await saveSettings(data);
    setSaving(false);
    if (err) { setError("فشل الحفظ: " + err.message); return; }
    setSaved(true);
    setTimeout(()=>setSaved(false), 3000);
  }

  return (
    <div style={{direction:"rtl"}}>
      {/* Header */}
      <div style={{marginBottom:18}}>
        <h1 style={{margin:0,fontSize:22,color:T.s900,fontWeight:800,letterSpacing:"-0.02em"}}>
          هوية النظام
        </h1>
        <p style={{margin:"4px 0 0",fontSize:13,color:T.s500}}>
          إعدادات الهوية البصرية والمعلومات العامة للمنصة
        </p>
      </div>

      {/* SQL migration hint */}
      {isAdmin && (
        <div style={{background:T.goldL,border:`1px solid ${T.gold}40`,borderRadius:12,
          padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,color:T.warn,fontWeight:600}}>
            ⚠️ تأكد من تنفيذ Migration SQL في Supabase قبل الاستخدام
          </span>
          <button onClick={()=>setShowSQL(p=>!p)} className="sic-btn" style={{
            fontSize:11,color:T.warn,background:"transparent",border:`1px solid ${T.warn}40`,
            borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,flexShrink:0,
          }}>{showSQL?"إخفاء":"عرض SQL"}</button>
        </div>
      )}
      {showSQL && (
        <div style={{background:T.s900,borderRadius:14,padding:16,marginBottom:16,overflow:"auto"}}>
          <pre style={{margin:0,fontSize:11,color:"#86efac",direction:"ltr",textAlign:"left",whiteSpace:"pre-wrap"}}>{SQL_MIGRATION}</pre>
        </div>
      )}

      <SaveBar saving={saving} saved={saved} error={error} onSave={handleSave} readOnly={!isAdmin}/>

      {/* Pill tabs */}
      <div style={{
        display:"flex", background:T.white, borderRadius:12, padding:4,
        marginBottom:20, border:`1px solid ${T.s200}`, gap:2,
        boxShadow:"0 1px 3px rgba(0,0,0,0.04)", overflowX:"auto",
      }}>
        {TABS.map(t=>{
          const active = tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} className="sic-tab" style={{
              flex:"0 0 auto", padding:"8px 14px", border:"none", borderRadius:9,
              background:active?T.e50:"transparent", cursor:"pointer",
              fontSize:11, fontFamily:"inherit", fontWeight:active?700:500,
              color:active?T.e700:T.s500, display:"flex", alignItems:"center",
              gap:5, whiteSpace:"nowrap",
            }}>
              <span style={{fontSize:13}}>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${T.e100}`,
            borderTopColor:T.e600,animation:"spin 0.7s linear infinite",margin:"0 auto 12px"}}/>
          <p style={{margin:0,color:T.s500,fontSize:13}}>جاري التحميل...</p>
        </div>
      ) : (
        <>
          {tab==="general"  && <GeneralSection data={data} set={set}/>}
          {tab==="branding" && <BrandingSection data={data} set={set}/>}
          {tab==="theme"    && <ThemeSection data={data} set={set}/>}
          {tab==="seo"      && <SEOSection data={data} set={set}/>}
          {tab==="email"    && <EmailSection data={data} set={set}/>}
          {tab==="excel"    && <ExcelSection data={data} set={set}/>}
          {tab==="pdf"      && <PDFSection data={data} set={set}/>}
          {tab==="pwa"      && <PWASection data={data} set={set}/>}
          {tab==="preview"  && <PreviewSection data={data}/>}
        </>
      )}
    </div>
  );
}

