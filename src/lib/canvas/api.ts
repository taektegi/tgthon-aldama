// Canvas REST API 최소 클라이언트 (로봇의 학교 가는 길 안내서).
// 토큰은 호출자에게 받아 Authorization 헤더로만 사용하고 어디에도 남기지 않는다.
export class CanvasAuthError extends Error {}

export type CanvasUser = { id: number; name: string };
export type CanvasCourse = { id: number; name: string };
export type CanvasAssignment = {
  id: number;
  name: string;
  due_at: string | null; // Canvas가 주는 UTC ISO 문자열 — 그대로 DB에 저장하면 됨
  html_url: string;
  is_quiz_assignment?: boolean;
  submission?: { workflow_state: string } | null;
};

function baseUrl(): string {
  const url = process.env.CANVAS_BASE_URL;
  if (!url) throw new Error("CANVAS_BASE_URL is not set");
  return url.replace(/\/$/, "");
}

async function canvasFetch<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new CanvasAuthError("invalid canvas token");
  if (!response.ok) throw new Error(`canvas api ${response.status}: ${path}`);
  return (await response.json()) as T;
}

export function fetchSelf(token: string): Promise<CanvasUser> {
  return canvasFetch<CanvasUser>(token, "/api/v1/users/self");
}

export function fetchActiveCourses(token: string): Promise<CanvasCourse[]> {
  return canvasFetch<CanvasCourse[]>(token, "/api/v1/courses?enrollment_state=active&per_page=100");
}

export function fetchCourseAssignments(token: string, courseId: number): Promise<CanvasAssignment[]> {
  return canvasFetch<CanvasAssignment[]>(
    token,
    `/api/v1/courses/${courseId}/assignments?include[]=submission&per_page=100&order_by=due_at`,
  );
}
