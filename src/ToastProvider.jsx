/**
 * ToastProvider — مكون إشعارات Toast
 * يستمع لـ NotificationService ويعرض الإشعارات
 * أضفه مرة واحدة في App.jsx
 */

import { useState, useEffect } from "react";
import { subscribe, NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from "./NotificationService.js";
import { C } from "./lib.jsx";

const TOAST_STYLES = {
 [NOTIFICATION_TYPES.SUCCESS]: { bg: C.successBg || "#E6F4EE", border: "#276749", color: "#276749", icon: "" },
 [NOTIFICATION_TYPES.ERROR]: { bg: "#FFF5F5", border: "#C53030", color: "#C53030", icon: "" },
 [NOTIFICATION_TYPES.WARNING]: { bg: "#FFFBEB", border: "#B7791F", color: "#B7791F", icon: "" },
 [NOTIFICATION_TYPES.INFO]: { bg: "#EBF8FF", border: "#2B6CB0", color: "#2B6CB0", icon: "ℹ" },
};

export default function ToastProvider() {
 const [toasts, setToasts] = useState([]);

 useEffect(() => {
 const unsubscribe = subscribe(NOTIFICATION_CHANNELS.TOAST, (notification) => {
 setToasts(prev => [...prev, notification]);

 // إزالة تلقائية بعد المدة المحددة
 setTimeout(() => {
 setToasts(prev => prev.filter(t => t.id !== notification.id));
 }, notification.duration || 3000);
 });

 return unsubscribe;
 }, []);

 if (toasts.length === 0) return null;

 return (
 <div style={{
 position: "fixed",
 top: 80,
 left: "50%",
 transform: "translateX(-50%)",
 zIndex: 9999,
 display: "flex",
 flexDirection: "column",
 gap: 8,
 width: "calc(100% - 32px)",
 maxWidth: 400,
 pointerEvents: "none",
 }}>
 {toasts.map(toast => {
 const style = TOAST_STYLES[toast.type] || TOAST_STYLES[NOTIFICATION_TYPES.INFO];
 return (
 <div
 key={toast.id}
 style={{
 background: style.bg,
 border: `1.5px solid ${style.border}40`,
 borderRight: `4px solid ${style.border}`,
 borderRadius: 12,
 padding: "12px 16px",
 display: "flex",
 alignItems: "center",
 gap: 10,
 boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
 animation: "slideDown 0.25s ease",
 pointerEvents: "auto",
 direction: "rtl",
 }}
 >
 <span style={{ fontSize: 18, flexShrink: 0 }}>{style.icon}</span>
 <p style={{ margin: 0, fontSize: 13, color: style.color, fontWeight: 600, flex: 1, lineHeight: 1.5 }}>
 {toast.message}
 </p>
 <button
 onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
 style={{
 background: "none", border: "none", color: style.color,
 cursor: "pointer", fontSize: 16, padding: 0, flexShrink: 0, opacity: 0.6,
 }}
 ></button>
 </div>
 );
 })}
 <style>{`
 @keyframes slideDown {
 from { opacity: 0; transform: translateY(-12px); }
 to { opacity: 1; transform: translateY(0); }
 }
 `}</style>
 </div>
 );
}
