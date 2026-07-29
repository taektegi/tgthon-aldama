import { describe, expect, it } from "vitest";
import { getEventDdayBasis, getEventDdayLabel, getEventDdayTime, getEventUrgency } from "./event-time-basis";

const NOW = new Date("2026-07-29T00:00:00.000Z");
const event = {
  starts_at: "2026-07-29T12:00:00.000Z",
  due_at: "2026-08-08T00:00:00.000Z",
};

describe("event D-day time basis", () => {
  it("기준이 없거나 알 수 없으면 기존 동작인 마감을 사용한다", () => {
    expect(getEventDdayBasis(event)).toBe("due_at");
    expect(getEventDdayBasis({ ...event, d_day_basis: null })).toBe("due_at");
    expect(getEventDdayTime(event)).toBe(event.due_at);
  });

  it("시작 기준을 고르면 D-day와 긴급도 모두 시작 시간을 사용한다", () => {
    const startsBased = { ...event, d_day_basis: "starts_at" as const };
    expect(getEventDdayTime(startsBased)).toBe(event.starts_at);
    expect(getEventDdayLabel(startsBased, NOW)).toBe("D-1");
    expect(getEventUrgency(startsBased, NOW).level).toBe("urgent");
  });

  it("마감 기준을 고르면 D-day와 긴급도 모두 마감 시간을 사용한다", () => {
    const dueBased = { ...event, d_day_basis: "due_at" as const };
    expect(getEventDdayLabel(dueBased, NOW)).toBe("D-10");
    expect(getEventUrgency(dueBased, NOW).level).toBe("distant");
  });

  it("선택한 기준 시간이 없으면 다른 시간으로 몰래 대체하지 않는다", () => {
    const missingDue = { starts_at: event.starts_at, due_at: null, d_day_basis: "due_at" as const };
    expect(getEventDdayTime(missingDue)).toBeNull();
    expect(getEventDdayLabel(missingDue, NOW)).toBe("—");
    expect(getEventUrgency(missingDue, NOW).level).toBe("none");
  });
});
