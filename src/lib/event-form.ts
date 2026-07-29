import { z } from "zod";

export type DashboardReturnState = {
  view: "list" | "calendar";
  range?: string;
  date?: string;
  month?: string;
  overdue?: boolean;
};

const dashboardBaseUrl = "https://aldama.local";
const dashboardDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const dashboardMonthPattern = /^\d{4}-\d{2}$/;
const dashboardRanges = new Set(["7", "14", "30", "all"]);

export function buildDashboardReturnPath(state: DashboardReturnState): string {
  const params = new URLSearchParams({ view: state.view });

  if (state.view === "list") {
    if (state.range && dashboardRanges.has(state.range)) params.set("range", state.range);
    if (state.date && dashboardDatePattern.test(state.date)) params.set("date", state.date);
    if (state.overdue) params.set("overdue", "1");
  } else {
    if (state.month && dashboardMonthPattern.test(state.month)) params.set("m", state.month);
    if (state.date && dashboardDatePattern.test(state.date)) params.set("date", state.date);
  }

  return `/dashboard?${params.toString()}`;
}

export function normalizeDashboardReturnPath(value?: string): string {
  if (!value) return "/dashboard";

  try {
    const url = new URL(value, dashboardBaseUrl);
    if (url.origin !== dashboardBaseUrl || url.pathname !== "/dashboard") return "/dashboard";

    const view = url.searchParams.get("view");
    if (view !== "list" && view !== "calendar") return "/dashboard";

    return buildDashboardReturnPath({
      view,
      range: url.searchParams.get("range") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
      month: url.searchParams.get("m") ?? undefined,
      overdue: url.searchParams.get("overdue") === "1",
    });
  } catch {
    return "/dashboard";
  }
}

export function addSavedDashboardState(value?: string): string {
  const returnPath = normalizeDashboardReturnPath(value);
  const url = new URL(returnPath, dashboardBaseUrl);
  url.searchParams.set("saved", "1");
  return `${url.pathname}?${url.searchParams.toString()}`;
}

const optionalDateTime = z.string().optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const eventFields = {
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(100).optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  event_type: z.enum(["assignment", "exam", "presentation", "application", "event", "other"]),
  starts_at: optionalDateTime,
  due_at: optionalDateTime,
  use_start_time_for_d_day: z.string().optional()
    .transform((value) => (value === "on" ? "starts_at" as const : "due_at" as const)),
};

export const createEventInputSchema = z.object(eventFields);
export const updateEventInputSchema = z.object({
  id: z.uuid(),
  return_to: z.string().optional().transform(normalizeDashboardReturnPath),
  ...eventFields,
});
