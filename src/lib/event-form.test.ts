import { describe, expect, it } from "vitest";
import {
  addSavedDashboardState,
  buildDashboardReturnPath,
  createEventInputSchema,
  normalizeDashboardReturnPath,
  updateEventInputSchema,
} from "./event-form";

const base = { title: "보고서 제출", subject: "자료구조", event_type: "assignment" };

describe("createEventInputSchema", () => {
  it.each([
    ["시작 시간만", { starts_at: "2026-07-30T09:00", due_at: "" }, "2026-07-30T09:00", null],
    ["마감 시간만", { starts_at: "", due_at: "2026-07-30T23:59" }, null, "2026-07-30T23:59"],
    ["시작·마감 모두", { starts_at: "2026-07-30T09:00", due_at: "2026-07-30T23:59" }, "2026-07-30T09:00", "2026-07-30T23:59"],
    ["두 시간 모두 없음", { starts_at: "", due_at: "" }, null, null],
  ])("%s 입력을 허용한다", (_label, input, expectedStart, expectedDue) => {
    const parsed = createEventInputSchema.parse({ ...base, ...input });
    expect(parsed.starts_at).toBe(expectedStart);
    expect(parsed.due_at).toBe(expectedDue);
  });

  it("체크하지 않으면 마감, 체크하면 시작 기준으로 해석한다", () => {
    expect(createEventInputSchema.parse(base).use_start_time_for_d_day).toBe("due_at");
    expect(createEventInputSchema.parse({ ...base, use_start_time_for_d_day: "on" }).use_start_time_for_d_day).toBe("starts_at");
  });

  it("제목은 계속 필수다", () => {
    expect(createEventInputSchema.safeParse({ ...base, title: "" }).success).toBe(false);
  });
});

describe("dashboard edit return state", () => {
  it("목록의 기간, 선택 날짜, 놓친 일정 펼침 상태를 보존한다", () => {
    expect(buildDashboardReturnPath({
      view: "list",
      range: "30",
      date: "2026-07-31",
      overdue: true,
    })).toBe("/dashboard?view=list&range=30&date=2026-07-31&overdue=1");
  });

  it("캘린더의 월과 선택 날짜를 보존한다", () => {
    expect(buildDashboardReturnPath({
      view: "calendar",
      month: "2026-08",
      date: "2026-08-17",
    })).toBe("/dashboard?view=calendar&m=2026-08&date=2026-08-17");
  });

  it("저장 후에도 기존 화면 상태를 유지하고 saved 표시만 추가한다", () => {
    expect(addSavedDashboardState("/dashboard?view=calendar&m=2026-08&date=2026-08-17"))
      .toBe("/dashboard?view=calendar&m=2026-08&date=2026-08-17&saved=1");
  });

  it("외부 경로와 수정용 임시 파라미터를 서버 액션에 전달하지 않는다", () => {
    expect(normalizeDashboardReturnPath("https://example.com/dashboard?view=list")).toBe("/dashboard");
    expect(normalizeDashboardReturnPath("/dashboard?view=list&range=14&edit=event-id&saved=1&unknown=x"))
      .toBe("/dashboard?view=list&range=14");
  });

  it("수정 스키마가 안전하게 정규화한 복귀 경로를 반환한다", () => {
    const parsed = updateEventInputSchema.parse({
      ...base,
      id: "1e365bc7-1e2a-491c-915f-52288391ab21",
      return_to: "/dashboard?view=calendar&m=2026-07&date=2026-07-29&edit=ignored",
    });

    expect(parsed.return_to).toBe("/dashboard?view=calendar&m=2026-07&date=2026-07-29");
  });
});
