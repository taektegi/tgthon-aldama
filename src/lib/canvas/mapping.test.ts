import { describe, expect, it } from "vitest";
import { isSubmitted, planChanges, toEventRow } from "./mapping";
import type { CanvasAssignment } from "./api";

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

describe("planChanges", () => {
  const now = new Date("2026-07-24T00:00:00Z");
  const row = toEventRow(base, "자료구조", "u", "s")!;

  it("새 미래 과제 → insert", () => {
    const { toInsert } = planChanges([row], new Map(), now);
    expect(toInsert).toHaveLength(1);
  });

  it("새 과거 과제 → 무시", () => {
    const past = { ...row, due_at: "2026-07-01T00:00:00Z" };
    const plan = planChanges([past], new Map(), now);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
  });

  it("기존 카드 → update (과거 마감이어도 갱신)", () => {
    const past = { ...row, due_at: "2026-07-01T00:00:00Z" };
    const plan = planChanges([past], new Map([["canvas:42", { id: "e1", is_completed: false }]]), now);
    expect(plan.toUpdate[0].id).toBe("e1");
    expect(plan.toUpdate[0].patch.due_at).toBe("2026-07-01T00:00:00Z");
    expect("is_hidden" in plan.toUpdate[0].patch).toBe(false);
  });

  it("알다마에서 수동 완료한 카드를 미제출이라고 되돌리지 않는다", () => {
    const plan = planChanges([row], new Map([["canvas:42", { id: "e1", is_completed: true }]]), now);
    expect(plan.toUpdate[0].patch.is_completed).toBeUndefined();
  });

  it("제출됨이면 완료로 갱신한다", () => {
    const submitted = { ...row, is_completed: true, completed_at: "2026-07-20T00:00:00Z" };
    const plan = planChanges([submitted], new Map([["canvas:42", { id: "e1", is_completed: false }]]), now);
    expect(plan.toUpdate[0].patch.is_completed).toBe(true);
  });
});
