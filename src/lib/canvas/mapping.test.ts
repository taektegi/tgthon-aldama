import { describe, expect, it } from "vitest";
import {
  isSubmitted,
  planChanges,
  toCalendarEventRow,
  toEventRow,
  type EventUpsertRow,
  type ExistingEventSnapshot,
  type OverrideField,
} from "./mapping";
import type { CanvasAssignment, CanvasCalendarEvent } from "./api";

const base: CanvasAssignment = {
  id: 42,
  name: "3주차 과제",
  due_at: "2026-08-01T14:59:00Z",
  html_url: "https://c/a/42",
  submission: { workflow_state: "unsubmitted" },
};

describe("isSubmitted", () => {
  it.each([
    ["submitted", true],
    ["graded", true],
    ["pending_review", true],
    ["unsubmitted", false],
    [undefined, false],
  ])("%s → %s", (state, expected) => {
    expect(isSubmitted(state as string)).toBe(expected);
  });
});

describe("toEventRow", () => {
  it("과제를 events 행으로 매핑한다", () => {
    const row = toEventRow(base, "자료구조", "user-1", "src-1")!;
    expect(row).toMatchObject({
      external_uid: "canvas:42",
      title: "3주차 과제",
      subject: "자료구조",
      event_type: "assignment",
      due_at: "2026-08-01T14:59:00Z",
      is_completed: false,
    });
  });

  it("마감일 없으면 null (카드로 안 만든다)", () => {
    expect(toEventRow({ ...base, due_at: null }, "c", "u", "s")).toBeNull();
  });

  it("제출됨 → is_completed true + completed_at 설정", () => {
    const row = toEventRow({ ...base, submission: { workflow_state: "graded" } }, "c", "u", "s")!;
    expect(row.is_completed).toBe(true);
    expect(row.completed_at).not.toBeNull();
  });

  it("퀴즈는 exam 유형으로", () => {
    expect(toEventRow({ ...base, is_quiz_assignment: true }, "c", "u", "s")!.event_type).toBe("exam");
  });
});

describe("toCalendarEventRow", () => {
  const calendarEvent: CanvasCalendarEvent = {
    id: 42,
    title: "팀 프로젝트 회의",
    start_at: "2099-08-02T01:00:00Z",
    end_at: "2099-08-02T03:00:00Z",
    html_url: "https://canvas.example/calendar?event_id=42",
    context_name: "자료구조",
    all_day: false,
    location_name: "공학관 101호",
    workflow_state: "active",
  };

  it("캘린더 일정을 일반 일정 카드로 매핑한다", () => {
    expect(toCalendarEventRow(calendarEvent, "u", "s")).toMatchObject({
      external_uid: "canvas:event:42",
      title: "팀 프로젝트 회의",
      subject: "자료구조",
      event_type: "event",
      starts_at: "2099-08-02T01:00:00Z",
      due_at: "2099-08-02T03:00:00Z",
      location: "공학관 101호",
      is_completed: false,
    });
  });

  it("시작 시간이 없거나 삭제된 일정은 카드로 만들지 않는다", () => {
    expect(toCalendarEventRow({ ...calendarEvent, start_at: null }, "u", "s")).toBeNull();
    expect(toCalendarEventRow({ ...calendarEvent, workflow_state: "deleted" }, "u", "s")).toBeNull();
  });

  it("종료 시간이 없으면 시작 시간을 마감 시간으로 사용한다", () => {
    expect(toCalendarEventRow({ ...calendarEvent, end_at: null }, "u", "s")?.due_at).toBe(
      calendarEvent.start_at,
    );
  });
});

describe("planChanges", () => {
  const now = new Date("2026-07-24T00:00:00Z");
  const row = toEventRow(base, "자료구조", "u", "s")!;
  const existing = (
    value: EventUpsertRow = row,
    overrides: OverrideField[] = [],
  ): ExistingEventSnapshot => ({
    id: "e1",
    title: value.title,
    subject: value.subject,
    event_type: value.event_type,
    starts_at: value.starts_at,
    due_at: value.due_at,
    is_all_day: value.is_all_day,
    location: value.location,
    source_url: value.source_url,
    is_completed: value.is_completed,
    override_fields: overrides,
  });

  it("새 미래 과제 → insert", () => {
    const { toInsert } = planChanges([row], new Map(), now);
    expect(toInsert).toHaveLength(1);
  });

  it("이미 시작했지만 아직 끝나지 않은 캘린더 일정 → insert", () => {
    const ongoing = toCalendarEventRow({
      id: 77,
      title: "진행 중인 일정",
      start_at: "2026-07-23T23:00:00Z",
      end_at: "2026-07-24T02:00:00Z",
      html_url: "https://canvas.example/calendar?event_id=77",
    }, "u", "s")!;

    expect(planChanges([ongoing], new Map(), new Date("2026-07-24T00:00:00Z")).toInsert).toHaveLength(1);
  });

  it("새 과거 과제 → 무시", () => {
    const past = { ...row, due_at: "2026-07-01T00:00:00Z" };
    const plan = planChanges([past], new Map(), now);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
  });

  it("기존 카드의 실제 값이 바뀐 경우에만 update한다", () => {
    const past = { ...row, due_at: "2026-07-01T00:00:00Z" };
    const plan = planChanges([past], new Map([["canvas:42", existing(row)]]), now);
    expect(plan.toUpdate[0].id).toBe("e1");
    expect(plan.toUpdate[0].patch).toEqual({ due_at: "2026-07-01T00:00:00Z" });
  });

  it("모든 값이 같으면 Supabase update를 만들지 않는다", () => {
    expect(planChanges([row], new Map([["canvas:42", existing()]]), now).toUpdate).toEqual([]);
  });

  it("UTC 표기만 다른 같은 시간은 변경으로 판단하지 않는다", () => {
    const incoming = { ...row, due_at: "2026-08-01T14:59:00Z" };
    const current = existing({ ...row, due_at: "2026-08-01T14:59:00+00:00" });

    expect(planChanges([incoming], new Map([["canvas:42", current]]), now).toUpdate).toEqual([]);
  });

  it("사용자가 수정한 필드는 보호하고 나머지 원본 변경만 반영한다", () => {
    const incoming = { ...row, title: "Canvas 새 제목", subject: "Canvas 새 과목", due_at: "2026-08-02T00:00:00Z" };
    const current = existing({ ...row, title: "내 제목", due_at: "2026-09-01T00:00:00Z" }, ["title", "due_at"]);
    const plan = planChanges([incoming], new Map([["canvas:42", current]]), now);
    expect(plan.toUpdate[0].patch).toEqual({ subject: "Canvas 새 과목" });
  });

  it("알다마에서 수동 완료한 카드를 미제출이라고 되돌리지 않는다", () => {
    const plan = planChanges([row], new Map([["canvas:42", existing({ ...row, is_completed: true })]]), now);
    expect(plan.toUpdate).toEqual([]);
  });

  it("제출됨이면 완료로 갱신한다", () => {
    const submitted = { ...row, is_completed: true, completed_at: "2026-07-20T00:00:00Z" };
    const plan = planChanges([submitted], new Map([["canvas:42", existing()]]), now);
    expect(plan.toUpdate[0].patch.is_completed).toBe(true);
  });
});
