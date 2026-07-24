import { describe, expect, it } from "vitest";
import { parseKstLocal, toKstInputValue } from "./datetime";

// 검사기계(vitest)가 잘 도는지 확인하는 첫 테스트.
// 기존 KST 헬퍼가 약속대로 동작하는지도 겸사겸사 확인한다.
describe("parseKstLocal", () => {
  it("KST 입력(15:00)을 UTC(06:00)로 변환한다", () => {
    expect(parseKstLocal("2026-07-30T15:00").toISOString()).toBe("2026-07-30T06:00:00.000Z");
  });
});

describe("toKstInputValue", () => {
  it("UTC ISO를 입력칸용 KST 값으로 되돌린다", () => {
    expect(toKstInputValue("2026-07-30T06:00:00.000Z")).toBe("2026-07-30T15:00");
  });

  it("null이면 빈 문자열", () => {
    expect(toKstInputValue(null)).toBe("");
  });
});
