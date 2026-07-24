import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.CANVAS_BASE_URL = "https://canvas.example.com";
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function response(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("canvas api", () => {
  it("fetchSelf는 사용자 정보를 반환하고 토큰을 헤더로만 보낸다", async () => {
    const mock = vi.fn().mockResolvedValue(response(200, { id: 7, name: "Sun Min" }));
    vi.stubGlobal("fetch", mock);
    const { fetchSelf } = await import("./api");

    expect(await fetchSelf("tok")).toEqual({ id: 7, name: "Sun Min" });
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe("https://canvas.example.com/api/v1/users/self");
    expect(String(url)).not.toContain("tok");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("Link 헤더의 다음 페이지까지 합친다", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, [{ id: 1, name: "A" }], {
          Link: '<https://canvas.example.com/api/v1/courses?page=2&per_page=100>; rel="next", <https://canvas.example.com/api/v1/courses?page=2&per_page=100>; rel="last"',
        }),
      )
      .mockResolvedValueOnce(response(200, [{ id: 2, name: "B" }]));
    vi.stubGlobal("fetch", mock);
    const { fetchActiveCourses } = await import("./api");

    await expect(fetchActiveCourses("tok")).resolves.toEqual([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("다른 origin의 페이지네이션 링크에는 토큰을 보내지 않는다", async () => {
    const mock = vi.fn().mockResolvedValue(
      response(200, [{ id: 1, name: "A" }], { Link: '<https://evil.example/api/v1/courses?page=2>; rel="next"' }),
    );
    vi.stubGlobal("fetch", mock);
    const { CanvasApiError, fetchActiveCourses } = await import("./api");

    await expect(fetchActiveCourses("tok")).rejects.toBeInstanceOf(CanvasApiError);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("401이면 CanvasAuthError를 던진다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401, { errors: [] })));
    const { fetchSelf, CanvasAuthError } = await import("./api");
    await expect(fetchSelf("bad")).rejects.toBeInstanceOf(CanvasAuthError);
  });

  it("429이면 CanvasRateLimitError를 던진다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(429, { errors: [] })));
    const { fetchSelf, CanvasRateLimitError } = await import("./api");
    await expect(fetchSelf("tok")).rejects.toBeInstanceOf(CanvasRateLimitError);
  });

  it("5xx이면 CanvasTemporaryError를 던진다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(503, { errors: [] })));
    const { fetchSelf, CanvasTemporaryError } = await import("./api");
    await expect(fetchSelf("tok")).rejects.toBeInstanceOf(CanvasTemporaryError);
  });

  it("네트워크 실패를 CanvasNetworkError로 감싼다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("socket failed")));
    const { fetchSelf, CanvasNetworkError } = await import("./api");
    await expect(fetchSelf("tok")).rejects.toBeInstanceOf(CanvasNetworkError);
  });

  it("10초가 지나면 요청을 중단한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })),
    );
    const { fetchSelf, CanvasNetworkError } = await import("./api");

    const pending = fetchSelf("tok");
    const assertion = expect(pending).rejects.toBeInstanceOf(CanvasNetworkError);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("과제 요청은 submission을 포함한다", async () => {
    const mock = vi.fn().mockResolvedValue(response(200, [
      { id: 1, name: "HW1", due_at: null, html_url: "u", submission: { workflow_state: "unsubmitted" } },
    ]));
    vi.stubGlobal("fetch", mock);
    const { fetchCourseAssignments } = await import("./api");

    const list = await fetchCourseAssignments("tok", 55);
    expect(list[0].name).toBe("HW1");
    expect(String(mock.mock.calls[0][0])).toContain("/api/v1/courses/55/assignments?include[]=submission");
  });
});
