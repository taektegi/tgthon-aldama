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

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PAGES = 100;

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
