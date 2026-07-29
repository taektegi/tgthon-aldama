import { getUrgency } from "./urgency";

export const EVENT_D_DAY_BASES = ["due_at", "starts_at"] as const;
export type EventDdayBasis = (typeof EVENT_D_DAY_BASES)[number];

export type EventWithTimeBasis = {
  starts_at: string | null;
  due_at: string | null;
  d_day_basis?: EventDdayBasis | null;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

export function getEventDdayLabel(event: EventWithTimeBasis, now: Date = new Date()): string {
  const referenceTime = getEventDdayTime(event);
  if (!referenceTime) return "—";

  const remaining = new Date(referenceTime).getTime() - now.getTime();
  if (remaining < 0) return `D+${Math.max(1, Math.ceil(Math.abs(remaining) / DAY_IN_MS))}`;
  if (remaining <= DAY_IN_MS) return "D-1";
  return `D-${Math.ceil(remaining / DAY_IN_MS)}`;
}
