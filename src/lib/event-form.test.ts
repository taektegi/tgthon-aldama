import { describe, expect, it } from "vitest";
import { createEventInputSchema } from "./event-form";

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
