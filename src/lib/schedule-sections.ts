// 대시보드 목록을 구역별로 나누는 규칙.
// - 놓친 일정: 선택한 D-day 기준 시각이 이미 지난 것 (접힌 구역에 모아둠)
// - 마감 임박: 오늘(당일)~모레(D-2)까지, KST 달력 날짜 기준
// - 다가오는 일정: 그 뒤의 것 중 선택한 기간(1주/2주/1달/전체) 안의 것.
//   선택한 기준 시각이 없는 일정은 날짜로 거를 수 없으니 항상 다가오는 일정에 보여준다.

import { getEventDdayTime, type EventWithTimeBasis } from "./event-time-basis";

export const UPCOMING_RANGES = [
  { value: "7", label: "1주" },
  { value: "14", label: "2주" },
  { value: "30", label: "1달" },
  { value: "all", label: "전체" },
] as const;

export type UpcomingRange = (typeof UPCOMING_RANGES)[number]["value"];

/** 쿠키나 주소에서 온 값이 이상하면 기본값 1주로 되돌린다 */
export function normalizeRange(value: string | undefined): UpcomingRange {
  return UPCOMING_RANGES.some((range) => range.value === value)
    ? (value as UpcomingRange)
    : "7";
}

const kstDayString = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(date);

/** KST 달력 기준 날짜 차이. 0=당일, 1=내일(D-1), 2=모레(D-2), 과거면 음수 */
export function kstDayDiff(iso: string, now: Date = new Date()): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const target = Date.parse(`${kstDayString(new Date(iso))}T00:00:00Z`);
  const today = Date.parse(`${kstDayString(now)}T00:00:00Z`);
  return Math.round((target - today) / MS_PER_DAY);
}

type Sectionable = EventWithTimeBasis & { is_completed: boolean };

export function splitSchedule<T extends Sectionable>(
  events: T[],
  range: UpcomingRange,
  now: Date = new Date(),
) {
  const active = events.filter((event) => !event.is_completed);
  const overdue = active.filter(
    (event) => {
      const referenceTime = getEventDdayTime(event);
      return referenceTime !== null && new Date(referenceTime).getTime() < now.getTime();
    },
  );
  const future = active.filter((event) => !overdue.includes(event));
  const priority = future.filter(
    (event) => {
      const referenceTime = getEventDdayTime(event);
      return referenceTime !== null && kstDayDiff(referenceTime, now) <= 2;
    },
  );
  const rest = future.filter((event) => !priority.includes(event));
  const limit = range === "all" ? Infinity : Number(range);
  const upcoming = rest.filter(
    (event) => {
      const referenceTime = getEventDdayTime(event);
      return referenceTime === null || kstDayDiff(referenceTime, now) <= limit;
    },
  );
  return { overdue, priority, upcoming, upcomingTotal: rest.length };
}
