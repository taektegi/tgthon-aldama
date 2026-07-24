// 학교 말투(Canvas 형식)의 과제를 알다마 카드 말투(events 행)로 옮기는 번역기.
import type { CanvasAssignment } from "./api";

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
  event_type: "assignment" | "exam";
  due_at: string;
  source_url: string;
  is_completed: boolean;
  completed_at: string | null;
};

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
    due_at: assignment.due_at,
    source_url: assignment.html_url,
    is_completed: submitted,
    completed_at: submitted ? new Date().toISOString() : null,
  };
}

// 가져온 과제들과 이미 있는 카드들을 비교해 "새로 만들 것 / 고칠 것"을 정한다.
export function planChanges(
  rows: EventUpsertRow[],
  existing: Map<string, { id: string; is_completed: boolean }>,
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
    const patch: Partial<EventUpsertRow> = {
      title: row.title,
      subject: row.subject,
      event_type: row.event_type,
      due_at: row.due_at,
      source_url: row.source_url,
    };
    // 완료는 한 방향으로만: 제출됨 → 완료. (사용자가 수동으로 완료한 걸 되돌리지 않는다)
    if (row.is_completed && !current.is_completed) {
      patch.is_completed = true;
      patch.completed_at = row.completed_at;
    }
    toUpdate.push({ id: current.id, patch });
  }
  return { toInsert, toUpdate };
}
