/**
 * ContentLibraryService.js
 * All Supabase operations for the Content Library system
 * Independent from existing survey logic
 */

import { supabase } from "./lib.jsx";

// ── Smart Variables ──────────────────────────────────
export const SMART_VARIABLES = [
  { key:"{{school_name}}",        label:"اسم المدرسة",         example:"مدرسة الأمل الابتدائية" },
  { key:"{{school_stage}}",       label:"المرحلة الدراسية",    example:"الابتدائية" },
  { key:"{{sector}}",             label:"القطاع",              example:"قطاع شمال جدة" },
  { key:"{{district}}",           label:"الحي",                example:"حي النزهة" },
  { key:"{{principal_name}}",     label:"اسم المدير/ة",        example:"أحمد محمد" },
  { key:"{{supervisor_name}}",    label:"اسم المشرف/ة",        example:"سارة عبدالله" },
  { key:"{{administrator_name}}", label:"اسم الإداري/ة",       example:"خالد العمري" },
  { key:"{{today}}",              label:"تاريخ اليوم",         example:"١٤٤٦/٠٦/١٢" },
  { key:"{{current_year}}",       label:"السنة الدراسية الحالية", example:"١٤٤٦" },
];

export function detectVariables(text) {
  if (!text) return [];
  return SMART_VARIABLES.filter(v => text.includes(v.key)).map(v => v.key);
}

export function resolveVariables(text, context = {}) {
  if (!text) return text;
  let result = text;
  const today = new Date();
  const replacements = {
    "{{school_name}}":        context.school_name        || "",
    "{{school_stage}}":       context.school_stage       || "",
    "{{sector}}":             context.sector             || "",
    "{{district}}":           context.district           || "",
    "{{principal_name}}":     context.principal_name     || context.principal || "",
    "{{supervisor_name}}":    context.supervisor_name    || "",
    "{{administrator_name}}": context.administrator_name || "",
    "{{today}}":              today.toLocaleDateString("ar-SA-u-ca-islamic"),
    "{{current_year}}":       today.toLocaleDateString("ar-SA-u-ca-islamic", { year:"numeric" }),
  };
  Object.entries(replacements).forEach(([k, v]) => {
    result = result.replaceAll(k, v);
  });
  return result;
}

// ── Categories ───────────────────────────────────────
export async function fetchCategories() {
  const { data, error } = await supabase
    .from("library_categories")
    .select("*")
    .order("sort_order");
  return { data: data || [], error };
}

export async function createCategory(payload) {
  return supabase.from("library_categories").insert(payload).select().single();
}

export async function deleteCategory(id) {
  return supabase.from("library_categories").delete().eq("id", id);
}

// ── Question Library ─────────────────────────────────
export async function fetchLibraryQuestions({ categoryId, search, favoritesOnly } = {}) {
  let q = supabase
    .from("library_questions")
    .select("*, library_categories(name, icon, color)")
    .order("updated_at", { ascending: false });

  if (categoryId) q = q.eq("category_id", categoryId);
  if (favoritesOnly) q = q.eq("is_favorite", true);

  const { data, error } = await q;
  if (error) return { data: [], error };

  let results = data || [];
  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    results = results.filter(item =>
      item.name.toLowerCase().includes(s) ||
      (item.description||"").toLowerCase().includes(s) ||
      (item.tags||[]).some(t => t.toLowerCase().includes(s)) ||
      (item.question_data?.label||"").toLowerCase().includes(s)
    );
  }
  return { data: results, error: null };
}

export async function saveLibraryQuestion({ name, categoryId, description, tags, questionData, userId, userEmail }) {
  const variables = detectVariables(questionData?.label) || [];
  const payload = {
    name, category_id: categoryId || null,
    description: description || "",
    tags: tags || [],
    question_data: questionData,
    variables,
    version: 1,
    created_by: userId || null,
    created_by_email: userEmail || null,
  };
  const { data, error } = await supabase.from("library_questions").insert(payload).select().single();
  if (!error && data) {
    // Save initial version
    await supabase.from("library_question_versions").insert({
      question_id: data.id, version: 1,
      question_data: questionData,
      change_note: "النسخة الأولى",
      created_by_email: userEmail,
    });
  }
  return { data, error };
}

export async function updateLibraryQuestion(id, { name, categoryId, description, tags, questionData, userEmail, changeNote }) {
  // Get current version
  const { data: current } = await supabase.from("library_questions").select("version").eq("id", id).single();
  const newVersion = (current?.version || 1) + 1;

  const variables = detectVariables(questionData?.label) || [];
  const { data, error } = await supabase
    .from("library_questions")
    .update({ name, category_id: categoryId || null, description, tags, question_data: questionData, variables, version: newVersion })
    .eq("id", id).select().single();

  if (!error) {
    await supabase.from("library_question_versions").insert({
      question_id: id, version: newVersion,
      question_data: questionData,
      change_note: changeNote || `تحديث إلى النسخة ${newVersion}`,
      created_by_email: userEmail,
    });
  }
  return { data, error };
}

export async function deleteLibraryQuestion(id) {
  return supabase.from("library_questions").delete().eq("id", id);
}

export async function toggleQuestionFavorite(id, current) {
  return supabase.from("library_questions").update({ is_favorite: !current }).eq("id", id);
}

export async function fetchQuestionVersions(questionId) {
  const { data, error } = await supabase
    .from("library_question_versions")
    .select("*")
    .eq("question_id", questionId)
    .order("version", { ascending: false });
  return { data: data || [], error };
}

// ── Section Library ──────────────────────────────────
export async function fetchLibrarySections({ categoryId, search, favoritesOnly } = {}) {
  let q = supabase
    .from("library_sections")
    .select("*, library_categories(name, icon, color)")
    .order("updated_at", { ascending: false });

  if (categoryId) q = q.eq("category_id", categoryId);
  if (favoritesOnly) q = q.eq("is_favorite", true);

  const { data, error } = await q;
  if (error) return { data: [], error };

  let results = data || [];
  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    results = results.filter(item =>
      item.name.toLowerCase().includes(s) ||
      (item.description||"").toLowerCase().includes(s) ||
      (item.tags||[]).some(t => t.toLowerCase().includes(s))
    );
  }
  return { data: results, error: null };
}

export async function saveLibrarySection({ name, categoryId, description, tags, questions, conditionalLogic, userId, userEmail }) {
  const allText = questions.map(q => q.label || "").join(" ");
  const variables = detectVariables(allText);
  const payload = {
    name, category_id: categoryId || null,
    description: description || "",
    tags: tags || [],
    questions: questions,
    conditional_logic: conditionalLogic || null,
    variables, version: 1,
    created_by: userId || null,
    created_by_email: userEmail || null,
  };
  const { data, error } = await supabase.from("library_sections").insert(payload).select().single();
  if (!error && data) {
    await supabase.from("library_section_versions").insert({
      section_id: data.id, version: 1, questions,
      change_note: "النسخة الأولى", created_by_email: userEmail,
    });
  }
  return { data, error };
}

export async function updateLibrarySection(id, { name, categoryId, description, tags, questions, conditionalLogic, userEmail, changeNote }) {
  const { data: current } = await supabase.from("library_sections").select("version").eq("id", id).single();
  const newVersion = (current?.version || 1) + 1;
  const allText = questions.map(q => q.label || "").join(" ");
  const variables = detectVariables(allText);

  const { data, error } = await supabase
    .from("library_sections")
    .update({ name, category_id: categoryId || null, description, tags, questions, conditional_logic: conditionalLogic || null, variables, version: newVersion })
    .eq("id", id).select().single();

  if (!error) {
    await supabase.from("library_section_versions").insert({
      section_id: id, version: newVersion, questions,
      change_note: changeNote || `تحديث إلى النسخة ${newVersion}`,
      created_by_email: userEmail,
    });
  }
  return { data, error };
}

export async function deleteLibrarySection(id) {
  return supabase.from("library_sections").delete().eq("id", id);
}

export async function toggleSectionFavorite(id, current) {
  return supabase.from("library_sections").update({ is_favorite: !current }).eq("id", id);
}

export async function fetchSectionVersions(sectionId) {
  const { data, error } = await supabase
    .from("library_section_versions")
    .select("*")
    .eq("section_id", sectionId)
    .order("version", { ascending: false });
  return { data: data || [], error };
}

// ── Conditional Templates ────────────────────────────
export async function fetchLibraryConditions({ categoryId, search, favoritesOnly } = {}) {
  let q = supabase
    .from("library_conditions")
    .select("*, library_categories(name, icon, color)")
    .order("updated_at", { ascending: false });

  if (categoryId) q = q.eq("category_id", categoryId);
  if (favoritesOnly) q = q.eq("is_favorite", true);

  const { data, error } = await q;
  if (error) return { data: [], error };

  let results = data || [];
  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    results = results.filter(item =>
      item.name.toLowerCase().includes(s) ||
      (item.description||"").toLowerCase().includes(s) ||
      (item.tags||[]).some(t => t.toLowerCase().includes(s))
    );
  }
  return { data: results, error: null };
}

export async function saveLibraryCondition({ name, categoryId, description, tags, conditionData, userId, userEmail }) {
  const payload = {
    name, category_id: categoryId || null,
    description: description || "",
    tags: tags || [],
    condition_data: conditionData,
    version: 1,
    created_by: userId || null,
    created_by_email: userEmail || null,
  };
  return supabase.from("library_conditions").insert(payload).select().single();
}

export async function updateLibraryCondition(id, updates) {
  const { data: current } = await supabase.from("library_conditions").select("version").eq("id", id).single();
  return supabase.from("library_conditions")
    .update({ ...updates, version: (current?.version || 1) + 1 })
    .eq("id", id).select().single();
}

export async function deleteLibraryCondition(id) {
  return supabase.from("library_conditions").delete().eq("id", id);
}

export async function toggleConditionFavorite(id, current) {
  return supabase.from("library_conditions").update({ is_favorite: !current }).eq("id", id);
}

// ── Import / Export ──────────────────────────────────
export function exportLibraryToJSON(questions, sections, conditions) {
  const data = {
    version: "1.0",
    exported_at: new Date().toISOString(),
    questions: questions.map(q => ({ name:q.name, category:q.library_categories?.name, description:q.description, tags:q.tags, question_data:q.question_data, variables:q.variables })),
    sections:  sections.map(s  => ({ name:s.name, category:s.library_categories?.name, description:s.description, tags:s.tags, questions:s.questions, variables:s.variables })),
    conditions: conditions.map(c => ({ name:c.name, category:c.library_categories?.name, description:c.description, tags:c.tags, condition_data:c.condition_data })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url;
  a.download = `content-library-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}

export async function importLibraryFromJSON(jsonData, userId, userEmail) {
  const results = { questions:0, sections:0, conditions:0, errors:[] };
  const { data: cats } = await fetchCategories();
  const catMap = Object.fromEntries(cats.map(c=>[c.name, c.id]));

  for (const q of jsonData.questions || []) {
    const { error } = await saveLibraryQuestion({
      name: q.name, categoryId: catMap[q.category] || null,
      description: q.description, tags: q.tags,
      questionData: q.question_data, userId, userEmail,
    });
    if (error) results.errors.push(q.name); else results.questions++;
  }
  for (const s of jsonData.sections || []) {
    const { error } = await saveLibrarySection({
      name: s.name, categoryId: catMap[s.category] || null,
      description: s.description, tags: s.tags,
      questions: s.questions, userId, userEmail,
    });
    if (error) results.errors.push(s.name); else results.sections++;
  }
  for (const c of jsonData.conditions || []) {
    const { error } = await saveLibraryCondition({
      name: c.name, categoryId: catMap[c.category] || null,
      description: c.description, tags: c.tags,
      conditionData: c.condition_data, userId, userEmail,
    });
    if (error) results.errors.push(c.name); else results.conditions++;
  }
  return results;
}

export async function exportLibraryToExcel(questions, sections) {
  const { default: XLSX } = await import("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js").catch(()=>({default:null}));
  if (!XLSX) { alert("فشل تحميل مكتبة Excel"); return; }

  const qRows = questions.map(q=>({
    "الاسم": q.name,
    "الفئة": q.library_categories?.name || "",
    "الوصف": q.description || "",
    "الوسوم": (q.tags||[]).join(", "),
    "نوع السؤال": q.question_data?.type || "",
    "نص السؤال": q.question_data?.label || "",
    "مطلوب": q.question_data?.required ? "نعم" : "لا",
    "النسخة": q.version,
    "المنشئ": q.created_by_email || "",
    "تاريخ الإنشاء": new Date(q.created_at).toLocaleDateString("ar-SA"),
  }));
  const sRows = sections.map(s=>({
    "الاسم": s.name,
    "الفئة": s.library_categories?.name || "",
    "الوصف": s.description || "",
    "الوسوم": (s.tags||[]).join(", "),
    "عدد الأسئلة": (s.questions||[]).length,
    "النسخة": s.version,
    "المنشئ": s.created_by_email || "",
    "تاريخ الإنشاء": new Date(s.created_at).toLocaleDateString("ar-SA"),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qRows), "الأسئلة");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sRows), "الأقسام");
  XLSX.writeFile(wb, `مكتبة-المحتوى-${new Date().toISOString().slice(0,10)}.xlsx`);
}

