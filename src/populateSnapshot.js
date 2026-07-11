/**
 * populateSnapshot.js
 * يُستدعى عند نشر أي استبيان لحفظ قائمة المستهدفين في survey_target_snapshot
 * استخدام: import { populateSnapshot } from "./populateSnapshot.js";
 *          await populateSnapshot(survey, supabase);
 */

export async function populateSnapshot(survey, supabase) {
  const { id: survey_id, survey_type } = survey;
  if (!survey_id || !survey_type || survey_type === "open") return;

  // Check if snapshot already exists
  const { count } = await supabase
    .from("survey_target_snapshot")
    .select("*", { count:"exact", head:true })
    .eq("survey_id", survey_id);
  if (count > 0) return; // already populated

  let rows = [];

  if (survey_type === "school") {
    let all = [], from = 0;
    while (true) {
      const { data } = await supabase
        .from("survey_schools")
        .select("id,name,phone")
        .range(from, from+999);
      if (!data?.length) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }
    rows = all.map(s => ({
      survey_id,
      respondent_type: "school",
      target_id: s.id,
      target_name: s.name,
      target_phone: s.phone,
    }));

  } else if (survey_type === "supervisor") {
    const { data } = await supabase
      .from("supervisors")
      .select("national_id,name,phone")
      .eq("status", "نشط");
    rows = (data||[]).filter(s => s.national_id).map(s => ({
      survey_id,
      respondent_type: "supervisor",
      target_id: s.national_id,
      target_name: s.name,
      target_phone: s.phone,
    }));

  } else if (survey_type === "administrator") {
    const { data } = await supabase
      .from("administrators")
      .select("national_id,full_name,phone")
      .eq("status", "نشط");
    rows = (data||[]).filter(a => a.national_id).map(a => ({
      survey_id,
      respondent_type: "administrator",
      target_id: a.national_id,
      target_name: a.full_name,
      target_phone: a.phone,
    }));
  }

  if (!rows.length) return;

  // Insert in batches
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await supabase
      .from("survey_target_snapshot")
      .upsert(rows.slice(i, i+BATCH), { onConflict: "survey_id,target_id" });
  }

  console.log(`Snapshot populated: ${rows.length} targets for survey ${survey_id}`);
}

