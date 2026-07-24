// Canvas REST API client. Access tokens only travel in the Authorization header.
export class CanvasAuthError extends Error {
  readonly code = "TOKEN_INVALID";
}

export class CanvasRateLimitError extends Error {
  readonly code = "RATE_LIMITED";
}

export class CanvasTemporaryError extends Error {
  readonly code = "CANVAS_TEMPORARY";
}

export class CanvasNetworkError extends Error {
  readonly code = "NETWORK_ERROR";
}

export class CanvasApiError extends Error {
  readonly code = "CANVAS_ERROR";
}

export class CanvasNotFoundError extends CanvasApiError {}

export type CanvasUser = { id: number; name: string };
export type CanvasCourse = { id: number; name: string };
export type CanvasAssignment = {
  id: number;
  name: string;
  due_at: string | null;
  html_url: string;
  is_quiz_assignment?: boolean;
  submission?: { workflow_state: string } | null;
};
export type CanvasCalendarEvent = {
  id: number;
  title: string;
  start_at: string | null;
  end_at: string | null;
  html_url: string;
  context_name?: string | null;
  all_day?: boolean;
  location_name?: string | null;
  workflow_state?: "active" | "locked" | "deleted" | string;
};

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PAGES = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const CALENDAR_LOOKBACK_DAYS = 30;
const CALENDAR_LOOKAHEAD_DAYS = 365;

export type CanvasCalendarWindow = { startDate: string; endDate: string };

export function canvasCalendarWindow(now: Date = new Date()): CanvasCalendarWindow {
  return {
    startDate: new Date(now.getTime() - CALENDAR_LOOKBACK_DAYS * DAY_MS).toISOString(),
    endDate: new Date(now.getTime() + CALENDAR_LOOKAHEAD_DAYS * DAY_MS).toISOString(),
  };
}

function baseUrl(): URL {
  const raw = process.env.CANVAS_BASE_URL;
  if (!raw) throw new Error("CANVAS_BASE_URL is not set");
  return new URL(raw.replace(/\/$/, ""));
}

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const match = part.match(/^\s*<([^>]+)>\s*;\s*rel=(?:"([^"]+)"|([^;\s]+))/);
    if (match?.[2] === "next" || match?.[3] === "next") return match[1];
  }
  return null;
}

function safeNextUrl(link: string, origin: URL): URL {
  const next = new URL(link, origin);
  if (next.origin !== origin.origin || !next.pathname.startsWith("/api/v1/")) {
    throw new CanvasApiError("Canvas returned an unsafe pagination link");
  }
  return next;
}

async function request<T>(token: string, url: URL): Promise<{ data: T; next: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new CanvasNetworkError("Canvas request timed out");
    throw new CanvasNetworkError("Canvas network request failed", { cause: error });
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401) throw new CanvasAuthError("Canvas token is invalid");
  if (response.status === 404) throw new CanvasNotFoundError("Canvas resource was not found");
  if (response.status === 429) throw new CanvasRateLimitError("Canvas rate limit reached");
  if (response.status >= 500) throw new CanvasTemporaryError("Canvas is temporarily unavailable");
  if (!response.ok) throw new CanvasApiError(`Canvas request failed (${response.status})`);

  try {
    return { data: (await response.json()) as T, next: nextLink(response.headers.get("link")) };
  } catch (error) {
    throw new CanvasApiError("Canvas returned an invalid response", { cause: error });
  }
}

async function fetchPaginated<T>(token: string, path: string): Promise<T[]> {
  const origin = baseUrl();
  let url = new URL(path, origin);
  const items: T[] = [];
  const visited = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (visited.has(url.href)) throw new CanvasApiError("Canvas pagination loop detected");
    visited.add(url.href);

    const result = await request<T[]>(token, url);
    if (!Array.isArray(result.data)) throw new CanvasApiError("Canvas returned an invalid list");
    items.push(...result.data);
    if (!result.next) return items;
    url = safeNextUrl(result.next, origin);
  }

  throw new CanvasApiError("Canvas returned too many pages");
}

export async function fetchSelf(token: string): Promise<CanvasUser> {
  const result = await request<CanvasUser>(token, new URL("/api/v1/users/self", baseUrl()));
  return result.data;
}

export function fetchActiveCourses(token: string): Promise<CanvasCourse[]> {
  return fetchPaginated<CanvasCourse>(token, "/api/v1/courses?enrollment_state=active&per_page=100");
}

export function fetchCourseAssignments(token: string, courseId: number): Promise<CanvasAssignment[]> {
  if (!Number.isSafeInteger(courseId) || courseId < 1) throw new CanvasApiError("Invalid Canvas course id");
  return fetchPaginated<CanvasAssignment>(
    token,
    `/api/v1/courses/${courseId}/assignments?include[]=submission&per_page=100&order_by=due_at`,
  );
}

export async function fetchCalendarEvents(
  token: string,
  courseIds: number[],
  window: CanvasCalendarWindow = canvasCalendarWindow(),
): Promise<CanvasCalendarEvent[]> {
  for (const courseId of courseIds) {
    if (!Number.isSafeInteger(courseId) || courseId < 1) throw new CanvasApiError("Invalid Canvas course id");
  }

  const personalParams = new URLSearchParams({
    type: "event",
    start_date: window.startDate,
    end_date: window.endDate,
    per_page: "100",
  });
  const events = await fetchPaginated<CanvasCalendarEvent>(token, `/api/v1/calendar_events?${personalParams}`);

  // Canvas accepts at most 10 context_codes in one calendar request.
  for (let index = 0; index < courseIds.length; index += 10) {
    const params = new URLSearchParams({
      type: "event",
      start_date: window.startDate,
      end_date: window.endDate,
      per_page: "100",
    });
    for (const courseId of courseIds.slice(index, index + 10)) {
      params.append("context_codes[]", `course_${courseId}`);
    }
    events.push(...await fetchPaginated<CanvasCalendarEvent>(token, `/api/v1/calendar_events?${params}`));
  }

  return [...new Map(events.map((event) => [event.id, event])).values()];
}

export async function fetchCalendarEvent(token: string, eventId: number): Promise<CanvasCalendarEvent> {
  if (!Number.isSafeInteger(eventId) || eventId < 1) throw new CanvasApiError("Invalid Canvas calendar event id");
  const result = await request<CanvasCalendarEvent>(
    token,
    new URL(`/api/v1/calendar_events/${eventId}`, baseUrl()),
  );
  return result.data;
}
