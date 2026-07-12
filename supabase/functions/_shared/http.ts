export const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "UNAUTHORIZED") return json({ error: message }, 401);
  if (message === "SERVER_MISCONFIGURED") return json({ error: message }, 500);
  return json({ error: "INTERNAL_ERROR" }, 500);
}
