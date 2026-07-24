// 동기화 한 바퀴: 금고 열기 → 학교 다녀오기 → 번역 → 카드 반영 → 기록.
// 서버 액션(사용자 클릭)과 Netlify 예약 함수(1시간마다) 둘 다 이 함수를 부른다.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { decryptSecret } from "../crypto";
import { CanvasAuthError, fetchActiveCourses, fetchCourseAssignments } from "./api";
import { planChanges, toEventRow, type EventUpsertRow } from "./mapping";

type Client = SupabaseClient<Database>;
type CanvasSource = { id: string; user_id: string; credential_ciphertext: string };

export async function syncCanvasSource(supabase: Client, source: CanvasSource) {
  // 작업 일지를 먼저 편다 (성공하든 실패하든 기록이 남게)
  const { data: run } = await supabase
    .from("sync_runs")
    .insert({ user_id: source.user_id, source_id: source.id })
    .select("id")
    .single();

  try {
    const token = decryptSecret(source.credential_ciphertext);
    const courses = await fetchActiveCourses(token);

    const rows: EventUpsertRow[] = [];
    for (const course of courses) {
      const assignments = await fetchCourseAssignments(token, course.id);
      for (const assignment of assignments) {
        const row = toEventRow(assignment, course.name, source.user_id, source.id);
        if (row) rows.push(row);
      }
    }

    // 이미 만들어진 카드들을 이름표(external_uid)로 조회
    const { data: existingRows } = await supabase
      .from("events")
      .select("id, external_uid, is_completed")
      .eq("source_id", source.id);
    const existing = new Map(
      (existingRows ?? [])
        .filter((row) => row.external_uid !== null)
        .map((row) => [row.external_uid as string, { id: row.id, is_completed: row.is_completed }]),
    );

    const plan = planChanges(rows, existing, new Date());
    if (plan.toInsert.length > 0) {
      const { error } = await supabase.from("events").insert(plan.toInsert);
      if (error) throw new Error(`insert failed: ${error.message}`);
    }
    for (const { id, patch } of plan.toUpdate) {
      const { error } = await supabase.from("events").update(patch).eq("id", id);
      if (error) throw new Error(`update failed: ${error.message}`);
    }

    await supabase
      .from("sources")
      .update({ status: "active", last_synced_at: new Date().toISOString(), last_sync_error: null })
      .eq("id", source.id);
    if (run) {
      await supabase
        .from("sync_runs")
        .update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          inserted_count: plan.toInsert.length,
          updated_count: plan.toUpdate.length,
        })
        .eq("id", run.id);
    }
    return { inserted: plan.toInsert.length, updated: plan.toUpdate.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (error instanceof CanvasAuthError) {
      // 토큰이 무효 → 대시보드에 "다시 연결해주세요" 배너를 띄우는 근거
      await supabase.from("sources").update({ status: "error", last_sync_error: "TOKEN_INVALID" }).eq("id", source.id);
    } else {
      await supabase.from("sources").update({ last_sync_error: message }).eq("id", source.id);
    }
    if (run) {
      await supabase
        .from("sync_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error_message: message })
        .eq("id", run.id);
    }
    throw error;
  }
}
