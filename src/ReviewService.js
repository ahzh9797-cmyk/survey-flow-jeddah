/**
 * ReviewService.js
 * All Supabase operations for Review Center
 * Independent from existing survey/template logic
 */

import { supabase } from "./lib.jsx";

// ── Permissions ──────────────────────────────────────
export const PERMISSIONS = {
  view_only:          { label:"عرض فقط",           icon:"👁️" },
  simulation_only:    { label:"محاكاة فقط",         icon:"▶️" },
  comment_only:       { label:"تعليق فقط",          icon:"💬" },
  simulation_comment: { label:"محاكاة + تعليق",     icon:"🔍" },
  approve:            { label:"مراجعة واعتماد",      icon:"✅" },
  admin:              { label:"مسؤول المراجعة",      icon:"👑" },
};

export const EXPIRY_OPTIONS = [
  { label:"ساعة واحدة",   hours: 1 },
  { label:"24 ساعة",      hours: 24 },
  { label:"7 أيام",       hours: 24*7 },
  { label:"30 يوماً",     hours: 24*30 },
  { label:"لا ينتهي",     hours: null },
];

// ── Preview Links ────────────────────────────────────
export async function createPreview({ surveyId, title, permission, expiryHours, allowAnonymous, notes, userId, userEmail }) {
  const expires_at = expiryHours
    ? new Date(Date.now() + expiryHours * 3600000).toISOString()
    : null;

  const { data, error } = await supabase
    .from("review_previews")
    .insert({
      survey_id: surveyId,
      title: title || null,
      permission,
      expires_at,
      allow_anonymous: allowAnonymous !== false,
      notes: notes || null,
      created_by: userId || null,
      created_by_email: userEmail || null,
    })
    .select().single();

  if (!error && data) {
    await logReviewAction({ previewId:data.id, surveyId, action:"preview_created", actorEmail:userEmail, details:{ permission, expires_at } });
  }
  return { data, error };
}

export async function fetchPreviews(surveyId) {
  const { data, error } = await supabase
    .from("review_previews")
    .select("*, review_comments(count), review_approvals(count)")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function fetchPreviewByToken(token) {
  const { data, error } = await supabase
    .from("review_previews")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single();
  return { data, error };
}

export async function deactivatePreview(id) {
  return supabase.from("review_previews").update({ is_active: false }).eq("id", id);
}

export async function incrementViewCount(id) {
  // Use RPC if available, else just update
  return supabase.rpc("increment_preview_views", { preview_id: id }).catch(() =>
    supabase.from("review_previews").select("view_count").eq("id", id).single()
      .then(({data}) => supabase.from("review_previews").update({ view_count:(data?.view_count||0)+1 }).eq("id", id))
  );
}

export function isPreviewExpired(preview) {
  if (!preview?.expires_at) return false;
  return new Date(preview.expires_at) < new Date();
}

export function buildPreviewUrl(token) {
  return `${window.location.origin}${window.location.pathname}?review=${token}`;
}

// ── Comments ─────────────────────────────────────────
export async function fetchComments(previewId) {
  const { data, error } = await supabase
    .from("review_comments")
    .select("*")
    .eq("preview_id", previewId)
    .order("created_at", { ascending: true });
  return { data: data || [], error };
}

export async function addComment({ previewId, questionId, reviewerName, reviewerEmail, content, parentId }) {
  const { data, error } = await supabase
    .from("review_comments")
    .insert({
      preview_id: previewId,
      question_id: questionId || null,
      reviewer_name: reviewerName || "مجهول",
      reviewer_email: reviewerEmail || null,
      content,
      parent_id: parentId || null,
    })
    .select().single();

  if (!error) {
    await logReviewAction({ previewId, action:"comment_added", actorName:reviewerName, details:{ question_id:questionId, content:content.slice(0,50) } });
  }
  return { data, error };
}

export async function resolveComment(id, resolvedBy) {
  const { data, error } = await supabase
    .from("review_comments")
    .update({ status:"resolved", resolved_at:new Date().toISOString(), resolved_by:resolvedBy })
    .eq("id", id).select().single();
  if (!error) await logReviewAction({ action:"comment_resolved", actorName:resolvedBy, details:{comment_id:id} });
  return { data, error };
}

export async function reopenComment(id) {
  return supabase.from("review_comments")
    .update({ status:"reopened", resolved_at:null, resolved_by:null })
    .eq("id", id);
}

// ── Approvals ────────────────────────────────────────
export async function submitApproval({ previewId, surveyId, reviewerId, decision, note, reviewerName }) {
  const { data, error } = await supabase
    .from("review_approvals")
    .insert({ preview_id:previewId, survey_id:surveyId, reviewer_id:reviewerId||null, decision, note:note||null })
    .select().single();

  if (!error) {
    await logReviewAction({
      previewId, surveyId,
      action: decision==="approved" ? "approval_granted" : "approval_rejected",
      actorName: reviewerName, details:{ decision, note }
    });
  }
  return { data, error };
}

export async function fetchApprovals(previewId) {
  const { data, error } = await supabase
    .from("review_approvals")
    .select("*, review_reviewers(name, email)")
    .eq("preview_id", previewId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

// ── Reviewers ────────────────────────────────────────
export async function addReviewer({ previewId, name, email, role }) {
  return supabase.from("review_reviewers")
    .insert({ preview_id:previewId, name, email, role:role||"reviewer" })
    .select().single();
}

export async function fetchReviewers(previewId) {
  const { data, error } = await supabase
    .from("review_reviewers").select("*").eq("preview_id", previewId);
  return { data: data || [], error };
}

export async function updateReviewerStatus(id, status, note) {
  return supabase.from("review_reviewers")
    .update({ status, approval_note:note||null, completed_at: ["approved","changes_requested"].includes(status) ? new Date().toISOString() : null })
    .eq("id", id);
}

// ── Audit ────────────────────────────────────────────
export async function logReviewAction({ previewId, surveyId, action, actorName, actorEmail, details }) {
  return supabase.from("review_audit").insert({
    preview_id: previewId || null,
    survey_id:  surveyId  || null,
    action, actor_name:actorName||null, actor_email:actorEmail||null,
    details: details || null,
  }).catch(() => {}); // non-fatal
}

export async function fetchReviewAudit(previewId) {
  const { data } = await supabase
    .from("review_audit").select("*")
    .eq("preview_id", previewId)
    .order("created_at", { ascending: false })
    .limit(100);
  return data || [];
}

// ── WhatsApp Message ─────────────────────────────────
export function buildWhatsAppMessage({ surveyTitle, creatorEmail, previewUrl, expiresAt, notes }) {
  const expText = expiresAt
    ? `\n⏰ صالح حتى: ${new Date(expiresAt).toLocaleDateString("ar-SA")}`
    : "";
  const notesText = notes ? `\n📝 ملاحظات: ${notes}` : "";
  return encodeURIComponent(
    `السلام عليكم،\n\nيُرجى مراجعة الاستبيان التالي:\n*${surveyTitle}*\n\n🔗 رابط المراجعة:\n${previewUrl}${expText}${notesText}\n\nإدارة التعليم — جدة`
  );
}

// ── Analytics ────────────────────────────────────────
export function computeReviewStats(comments, approvals) {
  const total    = comments.length;
  const resolved = comments.filter(c=>c.status==="resolved").length;
  const open     = comments.filter(c=>c.status==="open" || c.status==="reopened").length;
  const approved = approvals.filter(a=>a.decision==="approved").length;
  const rejected = approvals.filter(a=>a.decision==="changes_requested").length;
  return { total, resolved, open, approved, rejected, resolvedPct: total ? Math.round(resolved/total*100) : 0 };
}

