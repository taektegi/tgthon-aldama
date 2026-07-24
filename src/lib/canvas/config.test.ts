import { describe, expect, it } from "vitest";
import { canvasSettingsUrl } from "./config";

describe("canvasSettingsUrl", () => {
  it("경희대 LearningX 설정 페이지 주소를 만든다", () => {
    expect(canvasSettingsUrl("https://khcanvas.khu.ac.kr")).toBe(
      "https://khcanvas.khu.ac.kr/profile/settings",
    );
  });

  it("끝의 슬래시를 중복하지 않는다", () => {
    expect(canvasSettingsUrl("https://khcanvas.khu.ac.kr/")).toBe(
      "https://khcanvas.khu.ac.kr/profile/settings",
    );
  });

  it("공개 주소가 없으면 서버 주소를 사용한다", () => {
    expect(canvasSettingsUrl(undefined, "https://khcanvas.khu.ac.kr")).toBe(
      "https://khcanvas.khu.ac.kr/profile/settings",
    );
  });
});
