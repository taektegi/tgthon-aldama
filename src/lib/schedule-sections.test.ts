import { describe, expect, it } from "vitest";
import { kstDayDiff, normalizeRange, splitSchedule } from "./schedule-sections";

// 기준 시각: 2026-07-29(수) 낮 12시 KST
const NOW = new Date("2026-07-29T12:00:00+09:00");

const event = (due_at: string | null, is_completed = false) => ({ due_at, is_completed });

describe("kstDayDiff", () => {
  it("오늘 밤 마감은 0 (당일)", () => {
    expect(kstDayDiff("2026-07-29T23:59:00+09:00", NOW)).toBe(0);
  });
  it("내일은 1, 모레는 2", () => {
    expect(kstDayDiff("2026-07-30T09:00:00+09:00", NOW)).toBe(1);
    expect(kstDayDiff("2026-07-31T09:00:00+09:00", NOW)).toBe(2);
  });
  it("어제는 -1", () => {
    expect(kstDayDiff("2026-07-28T09:00:00+09:00", NOW)).toBe(-1);
  });
  it("UTC로 저장돼 있어도 KST 날짜로 계산한다 (Canvas due_at)", () => {
    // UTC 7/29 16:00 = KST 7/30 01:00 → 내일
    expect(kstDayDiff("2026-07-29T16:00:00Z", NOW)).toBe(1);
  });
});

describe("normalizeRange", () => {
  it("정상 값은 그대로, 이상한 값과 빈 값은 1주로", () => {
    expect(normalizeRange("14")).toBe("14");
    expect(normalizeRange("all")).toBe("all");
    expect(normalizeRange("999")).toBe("7");
    expect(normalizeRange(undefined)).toBe("7");
  });
});

describe("splitSchedule", () => {
  it("마감이 지난 것은 놓친 일정으로", () => {
    const { overdue, priority } = splitSchedule([event("2026-07-29T09:00:00+09:00")], "7", NOW);
    expect(overdue).toHaveLength(1);
    expect(priority).toHaveLength(0);
  });

  it("당일~D-2는 마감 임박, D-3부터는 다가오는 일정", () => {
    const dday = event("2026-07-29T23:00:00+09:00");
    const d2 = event("2026-07-31T09:00:00+09:00");
    const d3 = event("2026-08-01T09:00:00+09:00");
    const { priority, upcoming } = splitSchedule([dday, d2, d3], "7", NOW);
    expect(priority).toEqual([dday, d2]);
    expect(upcoming).toEqual([d3]);
  });

  it("다가오는 일정은 선택한 기간까지만 보인다", () => {
    const d5 = event("2026-08-03T09:00:00+09:00");
    const d10 = event("2026-08-08T09:00:00+09:00");
    const d40 = event("2026-09-07T09:00:00+09:00");
    expect(splitSchedule([d5, d10, d40], "7", NOW).upcoming).toEqual([d5]);
    expect(splitSchedule([d5, d10, d40], "14", NOW).upcoming).toEqual([d5, d10]);
    expect(splitSchedule([d5, d10, d40], "all", NOW).upcoming).toEqual([d5, d10, d40]);
  });

  it("기간과 무관하게 전체 개수(upcomingTotal)를 알려준다", () => {
    const d5 = event("2026-08-03T09:00:00+09:00");
    const d40 = event("2026-09-07T09:00:00+09:00");
    expect(splitSchedule([d5, d40], "7", NOW).upcomingTotal).toBe(2);
  });

  it("마감 없는 일정은 기간과 무관하게 다가오는 일정에 남는다", () => {
    const noDue = event(null);
    expect(splitSchedule([noDue], "7", NOW).upcoming).toEqual([noDue]);
  });

  it("완료한 일정은 어느 구역에도 안 들어간다", () => {
    const done = event("2026-07-28T09:00:00+09:00", true);
    const result = splitSchedule([done], "all", NOW);
    expect(result.overdue).toHaveLength(0);
    expect(result.priority).toHaveLength(0);
    expect(result.upcoming).toHaveLength(0);
  });
});
