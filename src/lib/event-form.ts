import { z } from "zod";

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
export const updateEventInputSchema = z.object({ id: z.uuid(), ...eventFields });
