"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const eventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(100).optional().transform((value) => (value && value.length > 0 ? value : null)),
  event_type: z.enum(["assignment", "exam", "presentation", "application", "event", "other"]),
  due_at: z.string().min(1),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") redirect("/login");
  return { supabase, userId };
}

export async function createEvent(formData: FormData) {
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { supabase, userId } = await authenticatedClient();
  await supabase.from("events").insert({
    user_id: userId,
    title: parsed.data.title,
    subject: parsed.data.subject,
    event_type: parsed.data.event_type,
    due_at: new Date(parsed.data.due_at).toISOString(),
  });
  revalidatePath("/dashboard");
}

export async function toggleEvent(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  const completed = formData.get("completed") === "true";
  if (!id.success) return;
  const { supabase } = await authenticatedClient();
  await supabase.from("events").update({
    is_completed: !completed,
    completed_at: completed ? null : new Date().toISOString(),
  }).eq("id", id.data);
  revalidatePath("/dashboard");
}

export async function deleteEvent(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await authenticatedClient();
  await supabase.from("events").delete().eq("id", id.data);
  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
