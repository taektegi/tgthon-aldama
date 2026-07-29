import { describe, expect, it } from "vitest";
import { getCountdownTarget, getDeadlineLabel, getRelativeDayLabel, isInProgress } from "./deadline-label";

// 기준 시각: 2026-08-12(수) 오후 2시 KST
const NOW = new Date("2026-08-12T14:00:00+09:00");

const event = (due_at: string | null, is_completed = false) => ({ due_at, is_completed });
const period = (starts_at: string | null, due_at: string | null, is_completed = false) => ({
  starts_at,
  due_at,
  is_completed,
});

describe("getCountdownTarget", () => {
  it("시작 시각이 아직 안 지났으면 시작을 센다", () => {
    expect(getCountdownTarget(period("2026-08-14T09:00:00+09:00", "2026-08-18T23:59:00+09:00"), NOW)).toBe("start");
  });
  it("시작 시각이 지났으면 마감을 센다", () => {
    expect(getCountdownTarget(period("2026-08-10T09:00:00+09:00", "2026-08-18T23:59:00+09:00"), NOW)).toBe("due");
  });
  it("같은 날이라도 시각으로 가른다", () => {
    const today = (h: string) => period(`2026-08-12T${h}:00+09:00`, "2026-08-20T23:59:00+09:00");
    expect(getCountdownTarget(today("13:00"), NOW)).toBe("due");
    expect(getCountdownTarget(today("15:00"), NOW)).toBe("start");
  });
  it("시작이 없으면 마감을 센다", () => {
    expect(getCountdownTarget(period(null, "2026-08-18T23:59:00+09:00"), NOW)).toBe("due");
  });
});

describe("getDeadlineLabel · 기간 일정", () => {
  it("시작 전에는 시작까지 센다 (마감이 멀어도)", () => {
    // 시작 8/14, 마감 8/18 → 마감 기준이면 D-6이지만 아직 시작 전이라 D-2
    expect(getDeadlineLabel(period("2026-08-14T09:00:00+09:00", "2026-08-18T23:59:00+09:00"), NOW)).toBe("D-2");
  });
  it("오늘 시작하는데 아직 시각이 안 됐으면 D-day", () => {
    expect(getDeadlineLabel(period("2026-08-12T18:00:00+09:00", "2026-08-20T23:59:00+09:00"), NOW)).toBe("D-day");
  });
  it("시작 시각이 지나면 마감까지로 바뀐다", () => {
    expect(getDeadlineLabel(period("2026-08-12T10:00:00+09:00", "2026-08-13T23:59:00+09:00"), NOW)).toBe("D-1");
  });
  it("진행 중에 마감이 오늘이면 D-day", () => {
    expect(getDeadlineLabel(period("2026-08-10T10:00:00+09:00", "2026-08-12T23:59:00+09:00"), NOW)).toBe("D-day");
  });
  it("마감이 지나면 D+N", () => {
    expect(getDeadlineLabel(period("2026-08-05T10:00:00+09:00", "2026-08-10T23:59:00+09:00"), NOW)).toBe("D+2");
  });
  it("완료면 시작 전이든 후든 완료", () => {
    expect(getDeadlineLabel(period("2026-08-14T09:00:00+09:00", "2026-08-18T23:59:00+09:00", true), NOW)).toBe("완료");
  });
});

describe("isInProgress", () => {
  it("시작 시각이 지나고 마감 전이면 진행중", () => {
    expect(isInProgress(period("2026-08-10T09:00:00+09:00", "2026-08-18T23:59:00+09:00"), NOW)).toBe(true);
  });
  it("시작 전이면 진행중이 아니다 (5일짜리라도)", () => {
    expect(isInProgress(period("2026-08-14T09:00:00+09:00", "2026-08-19T23:59:00+09:00"), NOW)).toBe(false);
  });
  it("오늘 시작이지만 시각이 안 됐으면 아직 아니다", () => {
    expect(isInProgress(period("2026-08-12T18:00:00+09:00", "2026-08-20T23:59:00+09:00"), NOW)).toBe(false);
  });
  it("시작 시각을 막 지났으면 진행중", () => {
    expect(isInProgress(period("2026-08-12T13:59:00+09:00", "2026-08-20T23:59:00+09:00"), NOW)).toBe(true);
  });
  it("마감이 지나면 진행중이 아니다", () => {
    expect(isInProgress(period("2026-08-01T09:00:00+09:00", "2026-08-11T23:59:00+09:00"), NOW)).toBe(false);
  });
  it("시작이 없는 일정은 진행중이 아니다", () => {
    expect(isInProgress(period(null, "2026-08-18T23:59:00+09:00"), NOW)).toBe(false);
  });
  it("완료면 진행중이 아니다", () => {
    expect(isInProgress(period("2026-08-10T09:00:00+09:00", "2026-08-18T23:59:00+09:00", true), NOW)).toBe(false);
  });
  it("마감이 없고 시작만 지났으면 진행중", () => {
    expect(isInProgress(period("2026-08-10T09:00:00+09:00", null), NOW)).toBe(true);
  });
});

describe("getDeadlineLabel", () => {
  it("오늘 밤 마감은 D-day (예전엔 D-1로 떴다)", () => {
    expect(getDeadlineLabel(event("2026-08-12T23:59:00+09:00"), NOW)).toBe("D-day");
  });
  it("오늘 안에 남은 시간이 적어도 D-day", () => {
    expect(getDeadlineLabel(event("2026-08-12T14:30:00+09:00"), NOW)).toBe("D-day");
  });
  it("내일은 시각과 무관하게 모두 D-1", () => {
    expect(getDeadlineLabel(event("2026-08-13T00:30:00+09:00"), NOW)).toBe("D-1");
    expect(getDeadlineLabel(event("2026-08-13T23:00:00+09:00"), NOW)).toBe("D-1");
  });
  it("모레는 D-2", () => {
    expect(getDeadlineLabel(event("2026-08-14T09:00:00+09:00"), NOW)).toBe("D-2");
  });
  it("마감이 지나면 D+N", () => {
    expect(getDeadlineLabel(event("2026-08-11T23:59:00+09:00"), NOW)).toBe("D+1");
    expect(getDeadlineLabel(event("2026-08-09T09:00:00+09:00"), NOW)).toBe("D+3");
  });
  it("완료면 완료, 마감이 없으면 —", () => {
    expect(getDeadlineLabel(event("2026-08-09T09:00:00+09:00", true), NOW)).toBe("완료");
    expect(getDeadlineLabel(event(null), NOW)).toBe("—");
  });
  it("UTC로 저장된 Canvas 마감도 KST 날짜로 센다", () => {
    // UTC 8/12 16:00 = KST 8/13 01:00 → 내일
    expect(getDeadlineLabel(event("2026-08-12T16:00:00Z"), NOW)).toBe("D-1");
  });
  it("자정 직전과 직후는 하루 차이가 난다", () => {
    const beforeMidnight = new Date("2026-08-12T23:59:00+09:00");
    const afterMidnight = new Date("2026-08-13T00:01:00+09:00");
    const due = event("2026-08-13T10:00:00+09:00");
    expect(getDeadlineLabel(due, beforeMidnight)).toBe("D-1");
    expect(getDeadlineLabel(due, afterMidnight)).toBe("D-day");
  });
});

describe("getRelativeDayLabel", () => {
  it("오늘·내일·모레·어제는 말로", () => {
    expect(getRelativeDayLabel("2026-08-12", NOW)).toBe("오늘");
    expect(getRelativeDayLabel("2026-08-13", NOW)).toBe("내일");
    expect(getRelativeDayLabel("2026-08-14", NOW)).toBe("모레");
    expect(getRelativeDayLabel("2026-08-11", NOW)).toBe("어제");
  });
  it("그 밖은 N일 뒤 / N일 전", () => {
    expect(getRelativeDayLabel("2026-08-15", NOW)).toBe("3일 뒤");
    expect(getRelativeDayLabel("2026-08-09", NOW)).toBe("3일 전");
  });
  it("월을 넘어가도 센다", () => {
    expect(getRelativeDayLabel("2026-09-01", NOW)).toBe("20일 뒤");
  });
});
