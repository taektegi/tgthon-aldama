import { getUrgency } from "./urgency";

export const EVENT_D_DAY_BASES = ["due_at", "starts_at"] as const;
export type EventDdayBasis = (typeof EVENT_D_DAY_BASES)[number];

export type EventWithTimeBasis = {
  starts_at: string | null;
  due_at: string | null;
  d_day_basis?: EventDdayBasis | null;
};

export type EventScheduleBucket = "overdue" | "priority" | "upcoming";

const kstDayString = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(date);

/** KST 달력 기준 날짜 차이. 0=당일, 1=내일(D-1), 2=모레(D-2), 과거면 음수. */
export function kstDayDiff(iso: string, now: Date = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const target = Date.parse(`${kstDayString(new Date(iso))}T00:00:00Z`);
  const today = Date.parse(`${kstDayString(now)}T00:00:00Z`);
  return Math.round((target - today) / msPerDay);
}

/** 과거 데이터나 알 수 없는 값은 기존 동작인 마감 시간 기준으로 해석한다. */
export function getEventDdayBasis(event: EventWithTimeBasis): EventDdayBasis {
  return event.d_day_basis === "starts_at" ? "starts_at" : "due_at";
}

/** D-day, 긴급도 색상, 우선 구역 분류가 함께 사용하는 단일 기준 시간. */
export function getEventDdayTime(event: EventWithTimeBasis): string | null {
  const value = getEventDdayBasis(event) === "starts_at" ? event.starts_at : event.due_at;
  return value && Number.isFinite(Date.parse(value)) ? value : null;
}

export function getEventUrgency(event: EventWithTimeBasis, now: Date = new Date()) {
  return getUrgency(getEventDdayTime(event), now);
}

/** 시작/마감 중 선택한 동일 기준 시간으로 목록 구역까지 결정한다. */
export function getEventScheduleBucket(
  event: EventWithTimeBasis,
  now: Date = new Date(),
): EventScheduleBucket {
  const referenceTime = getEventDdayTime(event);
  if (!referenceTime) return "upcoming";
  if (Date.parse(referenceTime) < now.getTime()) return "overdue";
  return kstDayDiff(referenceTime, now) <= 2 ? "priority" : "upcoming";
}

export function getEventDdayLabel(event: EventWithTimeBasis, now: Date = new Date()): string {
  const referenceTime = getEventDdayTime(event);
  if (!referenceTime) return "—";

  const dayDiff = kstDayDiff(referenceTime, now);
  if (dayDiff < 0) return `D+${Math.abs(dayDiff)}`;
  if (dayDiff === 0) return "D-Day";
  return `D-${dayDiff}`;
}
