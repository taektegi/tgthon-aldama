// One synchronization pass shared by user-triggered actions and the hourly Netlify function.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { decryptSecret } from "../crypto";
import {
  CanvasApiError,
  CanvasAuthError,
  CanvasNetworkError,
  CanvasNotFoundError,
  CanvasRateLimitError,
  CanvasTemporaryError,
  canvasCalendarWindow,
  fetchActiveCourses,
  fetchCalendarEvent,
  fetchCalendarEvents,
  fetchCourseAssignments,
} from "./api";
import {
  planChanges,
  toCalendarEventRow,
  toEventRow,
  type EventUpsertRow,
  type ExistingEventSnapshot,
  type OverrideField,
} from "./mapping";

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
    const calendarWindow = canvasCalendarWindow();
    const calendarEvents = await fetchCalendarEvents(token, courses.map((course) => course.id), calendarWindow);
    for (const calendarEvent of calendarEvents) {
      const row = toCalendarEventRow(calendarEvent, source.user_id, source.id);
      if (row) rowsByExternalUid.set(row.external_uid, row);
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("events")
      .select("id, external_uid, title, subject, event_type, starts_at, due_at, is_all_day, location, source_url, is_completed, is_hidden, override_fields")
      .eq("source_id", source.id);
    if (existingError) throw databaseError("Could not load existing events");

    // The ranged list may omit both deleted events and events moved outside the
    // window. Confirm missing IDs individually before hiding anything.
    const windowStart = new Date(calendarWindow.startDate).getTime();
    const windowEnd = new Date(calendarWindow.endDate).getTime();
    const calendarEventIdsToHide: string[] = [];
    for (const row of existingRows ?? []) {
      const externalUid = row.external_uid;
      if (
        row.is_hidden
        || !externalUid?.startsWith("canvas:event:")
        || rowsByExternalUid.has(externalUid)
      ) continue;

      const timestamp = Date.parse(row.starts_at ?? row.due_at ?? "");
      const wasInsideWindow = Number.isFinite(timestamp) && timestamp >= windowStart && timestamp <= windowEnd;
      const hasTimeOverride = row.override_fields.includes("starts_at") || row.override_fields.includes("due_at");
      if (!wasInsideWindow && !hasTimeOverride) continue;

      const match = /^canvas:event:(\d+)$/.exec(externalUid);
      const eventId = match ? Number(match[1]) : NaN;
      if (!Number.isSafeInteger(eventId) || eventId < 1) continue;

      try {
        const currentEvent = await fetchCalendarEvent(token, eventId);
        if (currentEvent.workflow_state === "deleted") {
          calendarEventIdsToHide.push(row.id);
          continue;
        }
        const currentRow = toCalendarEventRow(currentEvent, source.user_id, source.id);
        if (currentRow) rowsByExternalUid.set(currentRow.external_uid, currentRow);
      } catch (error) {
        if (error instanceof CanvasNotFoundError) {
          calendarEventIdsToHide.push(row.id);
          continue;
        }
        // A temporary lookup failure cannot prove deletion. Abort before any
        // event writes so the existing card stays visible.
        throw error;
      }
    }

    const existing = new Map(
      (existingRows ?? [])
        .filter((row) => row.external_uid !== null)
        .map((row) => [row.external_uid as string, {
          id: row.id,
          title: row.title,
          subject: row.subject,
          event_type: row.event_type,
          starts_at: row.starts_at,
          due_at: row.due_at,
          is_all_day: row.is_all_day,
          location: row.location,
          source_url: row.source_url,
          is_completed: row.is_completed,
          override_fields: row.override_fields as OverrideField[],
        } satisfies ExistingEventSnapshot]),
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
    if (calendarEventIdsToHide.length > 0) {
      const { error } = await supabase
        .from("events")
        .update({ is_hidden: true })
        .in("id", calendarEventIdsToHide);
      if (error) throw databaseError("Could not hide deleted Canvas calendar events");
    }

    const updatedCount = plan.toUpdate.length + calendarEventIdsToHide.length;

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
        updated_count: updatedCount,
      })
      .eq("id", runId);
    if (finishError) throw databaseError("Could not finish synchronization run");

    return { inserted: plan.toInsert.length, updated: updatedCount, syncedAt: finishedAt };
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
