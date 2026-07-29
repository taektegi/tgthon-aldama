import { describe, expect, it } from "vitest";
import {
  MAX_SPAN_LANES,
  assignSpanLanes,
  getSpanRole,
  getWeekSegments,
  isMultiDay,
  isSingleDayOn,
  kstDay,
  occupiesDay,
} from "./calendar-span";

// 8/12 오전 10시 시작 ~ 8/15 밤 11:59 마감 (KST)
const span = { starts_at: "2026-08-12T10:00:00+09:00", due_at: "2026-08-15T23:59:00+09:00" };
const dueOnly = { starts_at: null, due_at: "2026-08-13T23:59:00+09:00" };
const startOnly = { starts_at: "2026-08-13T15:00:00+09:00", due_at: null };
const sameDay = { starts_at: "2026-08-13T09:00:00+09:00", due_at: "2026-08-13T18:00:00+09:00" };

describe("kstDay", () => {
  it("UTC로 저장된 Canvas 시각도 KST 날짜로 바꾼다", () => {
    // UTC 8/12 16:00 = KST 8/13 01:00
    expect(kstDay("2026-08-12T16:00:00Z")).toBe("2026-08-13");
  });
});

describe("getSpanRole", () => {
  it("기간 일정은 첫날 start, 중간 middle, 마지막 end", () => {
    expect(getSpanRole(span, "2026-08-12")).toBe("start");
    expect(getSpanRole(span, "2026-08-13")).toBe("middle");
    expect(getSpanRole(span, "2026-08-14")).toBe("middle");
    expect(getSpanRole(span, "2026-08-15")).toBe("end");
  });
  it("기간 밖이면 null", () => {
    expect(getSpanRole(span, "2026-08-11")).toBeNull();
    expect(getSpanRole(span, "2026-08-16")).toBeNull();
  });
  it("마감만 있거나 시작만 있으면 single", () => {
    expect(getSpanRole(dueOnly, "2026-08-13")).toBe("single");
    expect(getSpanRole(startOnly, "2026-08-13")).toBe("single");
  });
  it("시작과 마감이 같은 날이면 single", () => {
    expect(getSpanRole(sameDay, "2026-08-13")).toBe("single");
  });
  it("시작이 마감보다 뒤인 이상한 데이터는 하루짜리로 취급한다", () => {
    const broken = { starts_at: "2026-08-20T09:00:00+09:00", due_at: "2026-08-13T09:00:00+09:00" };
    expect(getSpanRole(broken, "2026-08-13")).toBe("single");
    expect(getSpanRole(broken, "2026-08-20")).toBeNull();
  });
  it("날짜가 아예 없으면 null", () => {
    expect(getSpanRole({ starts_at: null, due_at: null }, "2026-08-13")).toBeNull();
  });
  it("월을 넘어가는 기간도 이어진다", () => {
    const crossMonth = { starts_at: "2026-07-30T09:00:00+09:00", due_at: "2026-08-02T23:59:00+09:00" };
    expect(getSpanRole(crossMonth, "2026-07-31")).toBe("middle");
    expect(getSpanRole(crossMonth, "2026-08-01")).toBe("middle");
    expect(getSpanRole(crossMonth, "2026-08-02")).toBe("end");
  });
});

describe("occupiesDay", () => {
  it("기간 일정은 사이 모든 날에 걸쳐 있다", () => {
    for (const day of ["2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15"]) {
      expect(occupiesDay(span, day)).toBe(true);
    }
  });
});

describe("isSingleDayOn", () => {
  it("하루로 끝나는 일정만 점을 찍는다", () => {
    expect(isSingleDayOn(dueOnly, "2026-08-13")).toBe(true);
    expect(isSingleDayOn(startOnly, "2026-08-13")).toBe(true);
    expect(isSingleDayOn(sameDay, "2026-08-13")).toBe(true);
  });
  it("기간 일정은 어느 날에도 점을 찍지 않는다 (띠가 보여준다)", () => {
    for (const day of ["2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15"]) {
      expect(isSingleDayOn(span, day)).toBe(false);
    }
  });
  it("날짜가 안 맞으면 false", () => {
    expect(isSingleDayOn(dueOnly, "2026-08-14")).toBe(false);
  });
});

describe("isMultiDay", () => {
  it("여러 날에 걸치면 true", () => {
    expect(isMultiDay(span)).toBe(true);
    expect(isMultiDay(sameDay)).toBe(false);
    expect(isMultiDay(dueOnly)).toBe(false);
  });
});

describe("assignSpanLanes", () => {
  const range = (start: string, due: string) => ({
    starts_at: `${start}T09:00:00+09:00`,
    due_at: `${due}T23:59:00+09:00`,
  });

  it("겹치는 기간은 다른 줄에 놓는다 (7~18일과 17~18일)", () => {
    const lanes = assignSpanLanes([range("2026-07-07", "2026-07-18"), range("2026-07-17", "2026-07-18")]);
    expect(lanes[0]).toBe(0);
    expect(lanes[1]).toBe(1);
  });

  it("겹치지 않으면 같은 줄을 다시 쓴다", () => {
    const lanes = assignSpanLanes([range("2026-07-01", "2026-07-05"), range("2026-07-06", "2026-07-09")]);
    expect(lanes).toEqual([0, 0]);
  });

  it("하루만 맞닿아도 겹친 것으로 본다", () => {
    const lanes = assignSpanLanes([range("2026-07-01", "2026-07-05"), range("2026-07-05", "2026-07-09")]);
    expect(lanes).toEqual([0, 1]);
  });

  it("기간 일정이 아니면 -1", () => {
    const lanes = assignSpanLanes([
      { starts_at: null, due_at: "2026-07-10T23:59:00+09:00" },
      range("2026-07-01", "2026-07-05"),
      { starts_at: null, due_at: null },
    ]);
    expect(lanes).toEqual([-1, 0, -1]);
  });

  it("시작이 같으면 긴 것이 아래 줄을 차지한다", () => {
    const lanes = assignSpanLanes([range("2026-07-01", "2026-07-03"), range("2026-07-01", "2026-07-20")]);
    expect(lanes[1]).toBe(0);
    expect(lanes[0]).toBe(1);
  });

  it("줄 번호는 자르지 않는다 (몇 줄까지 그릴지는 화면이 정한다)", () => {
    // 화면에 그릴 수 있는 줄 수보다 많이 겹쳐도 번호를 잘라 겹쳐 쌓지 않는다.
    // 기대값을 손으로 박으면 MAX_SPAN_LANES를 바꿀 때마다 테스트가 낡는다
    const overlapping = Array.from({ length: MAX_SPAN_LANES + 2 }, () => range("2026-07-01", "2026-07-20"));
    const lanes = assignSpanLanes(overlapping);
    expect(lanes).toEqual(overlapping.map((_, index) => index));
  });

  it("입력 순서대로 결과를 돌려준다", () => {
    const lanes = assignSpanLanes([range("2026-07-17", "2026-07-18"), range("2026-07-07", "2026-07-18")]);
    expect(lanes).toEqual([1, 0]);
  });
});

describe("getWeekSegments", () => {
  const weekOf = (days: (number | null)[]) =>
    days.map((day) => (day === null ? null : `2026-07-${String(day).padStart(2, "0")}`));
  const range = (start: string, due: string) => ({
    starts_at: `${start}T09:00:00+09:00`,
    due_at: `${due}T23:59:00+09:00`,
  });

  // 7/9(목) ~ 7/18(토) 기간 일정. 6~12 주와 13~19 주에 걸친다
  const trip = range("2026-07-09", "2026-07-18");

  it("주가 넘어가면 조각이 갈라지고 이어지는 쪽은 열린 채로 남는다", () => {
    const lanes = assignSpanLanes([trip]);
    const first = getWeekSegments([trip], lanes, weekOf([6, 7, 8, 9, 10, 11, 12]))[0];
    expect([first.startCol, first.span, first.opensHere, first.closesHere]).toEqual([3, 4, true, false]);

    const second = getWeekSegments([trip], lanes, weekOf([13, 14, 15, 16, 17, 18, 19]))[0];
    expect([second.startCol, second.span, second.opensHere, second.closesHere]).toEqual([0, 6, false, true]);
  });

  it("기간이 걸치지 않은 주는 조각이 없다", () => {
    const lanes = assignSpanLanes([trip]);
    expect(getWeekSegments([trip], lanes, weekOf([20, 21, 22, 23, 24, 25, 26]))).toHaveLength(0);
  });

  it("달 앞쪽 빈 칸은 건너뛴다", () => {
    const early = range("2026-07-01", "2026-07-03");
    const lanes = assignSpanLanes([early]);
    const segment = getWeekSegments([early], lanes, weekOf([null, null, 1, 2, 3, 4, 5]))[0];
    expect([segment.startCol, segment.span, segment.opensHere, segment.closesHere]).toEqual([2, 3, true, true]);
  });

  it("지난 달에 시작한 기간은 이 달 화면에서 왼쪽이 열린 채로 보인다", () => {
    const crossMonth = { starts_at: "2026-06-30T09:00:00+09:00", due_at: "2026-07-02T23:59:00+09:00" };
    const lanes = assignSpanLanes([crossMonth]);
    const segment = getWeekSegments([crossMonth], lanes, weekOf([null, null, 1, 2, 3, 4, 5]))[0];
    expect([segment.startCol, segment.span, segment.opensHere, segment.closesHere]).toEqual([2, 2, false, true]);
  });
});
