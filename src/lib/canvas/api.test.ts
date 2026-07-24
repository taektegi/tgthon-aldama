import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.CANVAS_BASE_URL = "https://khcanvas.khu.ac.kr";
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
    expect(String(url)).toBe("https://khcanvas.khu.ac.kr/api/v1/users/self");
    expect(String(url)).not.toContain("tok");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("Link 헤더의 다음 페이지까지 합친다", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, [{ id: 1, name: "A" }], {
          Link: '<https://khcanvas.khu.ac.kr/api/v1/courses?page=2&per_page=100>; rel="next", <https://khcanvas.khu.ac.kr/api/v1/courses?page=2&per_page=100>; rel="last"',
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

  it("개인 캘린더와 활성 강좌 캘린더 일정을 조회한다", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(response(200, [{ id: 1, title: "개인 일정", start_at: "2099-01-01T00:00:00Z", html_url: "u1" }]))
      .mockResolvedValueOnce(response(200, [{ id: 2, title: "강좌 일정", start_at: "2099-01-02T00:00:00Z", html_url: "u2" }]));
    vi.stubGlobal("fetch", mock);
    const { fetchCalendarEvents } = await import("./api");
    const window = {
      startDate: "2026-06-25T00:00:00.000Z",
      endDate: "2027-07-25T00:00:00.000Z",
    };

    await expect(fetchCalendarEvents("tok", [10, 20], window)).resolves.toHaveLength(2);
    const personalUrl = new URL(mock.mock.calls[0][0] as URL);
    const courseUrl = new URL(mock.mock.calls[1][0] as URL);
    expect(personalUrl.pathname).toBe("/api/v1/calendar_events");
    expect(personalUrl.searchParams.get("all_events")).toBeNull();
    expect(personalUrl.searchParams.get("start_date")).toBe(window.startDate);
    expect(personalUrl.searchParams.get("end_date")).toBe(window.endDate);
    expect(personalUrl.searchParams.get("context_codes[]")).toBeNull();
    expect(courseUrl.searchParams.getAll("context_codes[]")).toEqual(["course_10", "course_20"]);
    expect(courseUrl.searchParams.get("start_date")).toBe(window.startDate);
    expect(courseUrl.searchParams.get("end_date")).toBe(window.endDate);
  });

  it("캘린더 일정 하나를 Canvas ID로 조회한다", async () => {
    const event = {
      id: 77,
      title: "옮겨진 일정",
      start_at: "2028-08-01T00:00:00Z",
      end_at: "2028-08-01T01:00:00Z",
      html_url: "https://khcanvas.khu.ac.kr/calendar?event_id=77",
    };
    const mock = vi.fn().mockResolvedValue(response(200, event));
    vi.stubGlobal("fetch", mock);
    const { fetchCalendarEvent } = await import("./api");

    await expect(fetchCalendarEvent("tok", 77)).resolves.toEqual(event);
    expect(String(mock.mock.calls[0][0])).toBe("https://khcanvas.khu.ac.kr/api/v1/calendar_events/77");
  });

  it("단건 캘린더 일정이 없으면 CanvasNotFoundError를 던진다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(404, { errors: [] })));
    const { CanvasNotFoundError, fetchCalendarEvent } = await import("./api");

    await expect(fetchCalendarEvent("tok", 77)).rejects.toBeInstanceOf(CanvasNotFoundError);
  });

  it("Canvas 제한에 맞춰 강좌 캘린더를 10개씩 나눠 조회한다", async () => {
    const mock = vi.fn().mockImplementation(() => Promise.resolve(response(200, [])));
    vi.stubGlobal("fetch", mock);
    const { fetchCalendarEvents } = await import("./api");
    const window = {
      startDate: "2026-06-25T00:00:00.000Z",
      endDate: "2027-07-25T00:00:00.000Z",
    };

    await fetchCalendarEvents("tok", Array.from({ length: 11 }, (_, index) => index + 1), window);

    expect(mock).toHaveBeenCalledTimes(3); // 개인 캘린더 1회 + 강좌 묶음 2회
    for (const [url] of mock.mock.calls) {
      const parsed = new URL(url as URL);
      expect(parsed.searchParams.get("start_date")).toBe(window.startDate);
      expect(parsed.searchParams.get("end_date")).toBe(window.endDate);
    }
  });

  it("동기화 범위는 기준 시각에서 과거 30일, 미래 365일이다", async () => {
    const { canvasCalendarWindow } = await import("./api");

    expect(canvasCalendarWindow(new Date("2026-07-25T12:00:00.000Z"))).toEqual({
      startDate: "2026-06-25T12:00:00.000Z",
      endDate: "2027-07-25T12:00:00.000Z",
    });
  });
});
