// One synchronization pass shared by user-triggered actions and the hourly Netlify function.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { decryptSecret } from "../crypto";
import {
  CanvasApiError,
  CanvasAuthError,
  CanvasNetworkError,
  CanvasRateLimitError,
  CanvasTemporaryError,
  fetchActiveCourses,
  fetchCourseAssignments,
} from "./api";
import { planChanges, toEventRow, type EventUpsertRow } from "./mapping";

type Client = SupabaseClient<Database>;
export type CanvasSource = { id: string; user_id: string; credential_ciphertext: string };

export type CanvasSyncErrorCode =
  | "TOKEN_INVALID"
  | "RATE_LIMITED"
  | "CANVAS_TEMPORARY"
  | "NETWORK_ERROR"
  | "CANVAS_ERROR"
  | "SYNC_DATABASE_ERROR"
  | "SYNC_ERROR";

class CanvasSyncDatabaseError extends Error {}

export function canvasSyncErrorInfo(error: unknown): { code: CanvasSyncErrorCode; message: string } {
  if (error instanceof CanvasAuthError) return { code: "TOKEN_INVALID", message: "Canvas token is invalid" };
  if (error instanceof CanvasRateLimitError) return { code: "RATE_LIMITED", message: "Canvas rate limit reached" };
  if (error instanceof CanvasTemporaryError) return { code: "CANVAS_TEMPORARY", message: "Canvas is temporarily unavailable" };
  if (error instanceof CanvasNetworkError) return { code: "NETWORK_ERROR", message: "Canvas network request failed" };
  if (error instanceof CanvasApiError) return { code: "CANVAS_ERROR", message: "Canvas request failed" };
  if (error instanceof CanvasSyncDatabaseError) return { code: "SYNC_DATABASE_ERROR", message: "Database synchronization failed" };
  return { code: "SYNC_ERROR", message: "Canvas synchronization failed" };
}

function databaseError(context: string): CanvasSyncDatabaseError {
  // Do not embed Supabase's raw response: user data or implementation details can be present there.
  return new CanvasSyncDatabaseError(context);
}

export async function syncCanvasSource(supabase: Client, source: CanvasSource) {
  let runId: string | null = null;

  try {
    const { data: run, error: runError } = await supabase
      .from("sync_runs")
      .insert({ user_id: source.user_id, source_id: source.id })
      .select("id")
      .single();
    if (runError || !run) throw databaseError("Could not create synchronization run");
    runId = run.id;

    const token = decryptSecret(source.credential_ciphertext);
    const courses = await fetchActiveCourses(token);

    const rowsByExternalUid = new Map<string, EventUpsertRow>();
    for (const course of courses) {
      const assignments = await fetchCourseAssignments(token, course.id);
      for (const assignment of assignments) {
        const row = toEventRow(assignment, course.name, source.user_id, source.id);
        if (row) rowsByExternalUid.set(row.external_uid, row);
      }
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("events")
      .select("id, external_uid, is_completed")
      .eq("source_id", source.id);
    if (existingError) throw databaseError("Could not load existing events");

    const existing = new Map(
      (existingRows ?? [])
        .filter((row) => row.external_uid !== null)
        .map((row) => [row.external_uid as string, { id: row.id, is_completed: row.is_completed }]),
    );
    const plan = planChanges([...rowsByExternalUid.values()], existing, new Date());

    if (plan.toInsert.length > 0) {
      const { error } = await supabase.from("events").insert(plan.toInsert);
      if (error) throw databaseError("Could not insert Canvas events");
    }
    for (const { id, patch } of plan.toUpdate) {
      const { error } = await supabase.from("events").update(patch).eq("id", id);
      if (error) throw databaseError("Could not update Canvas event");
    }

    const finishedAt = new Date().toISOString();
    const { error: sourceError } = await supabase
      .from("sources")
      .update({ status: "active", last_synced_at: finishedAt, last_sync_error: null })
      .eq("id", source.id);
    if (sourceError) throw databaseError("Could not update Canvas source");

    const { error: finishError } = await supabase
      .from("sync_runs")
      .update({
        status: "succeeded",
        finished_at: finishedAt,
        inserted_count: plan.toInsert.length,
        updated_count: plan.toUpdate.length,
      })
      .eq("id", runId);
    if (finishError) throw databaseError("Could not finish synchronization run");

    return { inserted: plan.toInsert.length, updated: plan.toUpdate.length, syncedAt: finishedAt };
  } catch (error) {
    const info = canvasSyncErrorInfo(error);
    const sourcePatch = error instanceof CanvasAuthError
      ? { status: "error" as const, last_sync_error: info.code }
      : { last_sync_error: info.code };
    await supabase.from("sources").update(sourcePatch).eq("id", source.id);

    if (runId) {
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_code: info.code,
          error_message: info.message,
        })
        .eq("id", runId);
    }
    throw error;
  }
}
