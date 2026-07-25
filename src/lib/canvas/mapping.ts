// 학교 말투(Canvas 형식)의 과제를 알다마 카드 말투(events 행)로 옮기는 번역기.
import type { CanvasAssignment, CanvasCalendarEvent } from "./api";

const SUBMITTED_STATES = new Set(["submitted", "graded", "pending_review"]);

export function isSubmitted(state: string | undefined | null): boolean {
  return state != null && SUBMITTED_STATES.has(state);
}

export type EventUpsertRow = {
  user_id: string;
  source_id: string;
  external_uid: string;
  title: string;
  subject: string;
  event_type: "assignment" | "exam" | "event";
  starts_at: string | null;
  due_at: string;
  is_all_day: boolean;
  location: string | null;
  source_url: string;
  is_completed: boolean;
  completed_at: string | null;
};

export const OVERRIDABLE_FIELDS = ["title", "subject", "event_type", "starts_at", "due_at"] as const;
export type OverrideField = (typeof OVERRIDABLE_FIELDS)[number];

export type ExistingEventSnapshot = {
  id: string;
  title: string;
  subject: string | null;
  event_type: "assignment" | "exam" | "presentation" | "application" | "event" | "other";
  starts_at: string | null;
  due_at: string | null;
  is_all_day: boolean;
  location: string | null;
  source_url: string | null;
  is_completed: boolean;
  override_fields: OverrideField[];
};

function sameInstant(left: string | null, right: string | null): boolean {
  if (left === right) return true;
  if (left === null || right === null) return false;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

export function toEventRow(
  assignment: CanvasAssignment,
  courseName: string,
  userId: string,
  sourceId: string,
): EventUpsertRow | null {
  if (!assignment.due_at) return null; // 마감 없는 항목(출석 점수 등)은 카드로 안 만든다
  const submitted = isSubmitted(assignment.submission?.workflow_state);
  return {
    user_id: userId,
    source_id: sourceId,
    external_uid: `canvas:${assignment.id}`, // 같은 과제가 두 번 카드가 되지 않게 하는 이름표
    title: assignment.name,
    subject: courseName,
    event_type: assignment.is_quiz_assignment ? "exam" : "assignment",
    starts_at: null,
    due_at: assignment.due_at,
    is_all_day: false,
    location: null,
    source_url: assignment.html_url,
    is_completed: submitted,
    completed_at: submitted ? new Date().toISOString() : null,
  };
}

export function toCalendarEventRow(
  event: CanvasCalendarEvent,
  userId: string,
  sourceId: string,
): EventUpsertRow | null {
  if (!event.start_at || event.workflow_state === "deleted") return null;
  return {
    user_id: userId,
    source_id: sourceId,
    external_uid: `canvas:event:${event.id}`,
    title: event.title,
    subject: event.context_name?.trim() || "러닝엑스 캘린더",
    event_type: "event",
    starts_at: event.start_at,
    due_at: event.end_at ?? event.start_at,
    is_all_day: event.all_day ?? false,
    location: event.location_name?.trim() || null,
    source_url: event.html_url,
    is_completed: false,
    completed_at: null,
  };
}

// 가져온 과제들과 이미 있는 카드들을 비교해 "새로 만들 것 / 고칠 것"을 정한다.
export function planChanges(
  rows: EventUpsertRow[],
  existing: Map<string, ExistingEventSnapshot>,
  now: Date,
): { toInsert: EventUpsertRow[]; toUpdate: Array<{ id: string; patch: Partial<EventUpsertRow> }> } {
  const toInsert: EventUpsertRow[] = [];
  const toUpdate: Array<{ id: string; patch: Partial<EventUpsertRow> }> = [];

  for (const row of rows) {
    const current = existing.get(row.external_uid);
    if (!current) {
      // 새 과제: 이미 마감이 지난 건 굳이 추가하지 않는다
      if (new Date(row.due_at) >= now) toInsert.push(row);
      continue;
    }
    const patch: Partial<EventUpsertRow> = {};
    const overrides = new Set(current.override_fields);

    for (const field of OVERRIDABLE_FIELDS) {
      const unchanged = field === "starts_at" || field === "due_at"
        ? sameInstant(current[field], row[field])
        : current[field] === row[field];
      if (!overrides.has(field) && !unchanged) {
        Object.assign(patch, { [field]: row[field] });
      }
    }
    for (const field of ["is_all_day", "location", "source_url"] as const) {
      if (current[field] !== row[field]) Object.assign(patch, { [field]: row[field] });
    }
    // 완료는 한 방향으로만: 제출됨 → 완료. (사용자가 수동으로 완료한 걸 되돌리지 않는다)
    if (row.is_completed && !current.is_completed) {
      patch.is_completed = true;
      patch.completed_at = row.completed_at;
    }
    if (Object.keys(patch).length > 0) toUpdate.push({ id: current.id, patch });
  }
  return { toInsert, toUpdate };
}
