import { describe, expect, it } from "vitest";
import { getUrgency } from "./urgency";

const NOW = new Date("2026-07-28T00:00:00.000Z");

function dueAfter(milliseconds: number) {
  return new Date(NOW.getTime() + milliseconds).toISOString();
}

describe("getUrgency", () => {
  it("마감이 없으면 중립 상태를 반환한다", () => {
    expect(getUrgency(null, NOW).level).toBe("none");
  });

  it("이미 지난 마감은 별도의 마감 지남 상태로 분류한다", () => {
    expect(getUrgency(dueAfter(-1), NOW).level).toBe("overdue");
  });

  it("정확히 24시간 남은 일정까지 가장 긴박한 상태로 분류한다", () => {
    expect(getUrgency(dueAfter(24 * 60 * 60 * 1000), NOW).level).toBe("urgent");
  });

  it("24시간을 초과하고 3일 이하인 일정은 마감 임박 상태로 분류한다", () => {
    expect(getUrgency(dueAfter(24 * 60 * 60 * 1000 + 1), NOW).level).toBe("soon");
    expect(getUrgency(dueAfter(3 * 24 * 60 * 60 * 1000), NOW).level).toBe("soon");
  });

  it("3일을 초과한 일정은 일반 파란색 상태로 분류한다", () => {
    expect(getUrgency(dueAfter(3 * 24 * 60 * 60 * 1000 + 1), NOW).level).toBe("later");
    expect(getUrgency(dueAfter(8 * 24 * 60 * 60 * 1000), NOW).level).toBe("distant");
  });
});
