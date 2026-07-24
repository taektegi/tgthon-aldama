import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// 실제 학교 서버 대신 가짜 fetch를 꽂아서 "로봇이 올바른 주소로, 올바른 출입증을 들고 가는지"를 검사한다.
beforeAll(() => {
  process.env.CANVAS_BASE_URL = "https://canvas.example.com";
});
afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("canvas api", () => {
  it("fetchSelf는 사용자 정보를 반환한다", async () => {
    const mock = stubFetch(200, { id: 7, name: "Sun Min" });
    const { fetchSelf } = await import("./api");
    expect(await fetchSelf("tok")).toEqual({ id: 7, name: "Sun Min" });
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe("https://canvas.example.com/api/v1/users/self");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("401이면 CanvasAuthError를 던진다", async () => {
    stubFetch(401, { errors: [] });
    const { fetchSelf, CanvasAuthError } = await import("./api");
    await expect(fetchSelf("bad")).rejects.toBeInstanceOf(CanvasAuthError);
  });

  it("fetchCourseAssignments는 submission 포함 목록을 반환한다", async () => {
    const mock = stubFetch(200, [
      { id: 1, name: "HW1", due_at: null, html_url: "u", submission: { workflow_state: "unsubmitted" } },
    ]);
    const { fetchCourseAssignments } = await import("./api");
    const list = await fetchCourseAssignments("tok", 55);
    expect(list[0].name).toBe("HW1");
    expect(String(mock.mock.calls[0][0])).toContain("/api/v1/courses/55/assignments?include[]=submission");
  });
});
