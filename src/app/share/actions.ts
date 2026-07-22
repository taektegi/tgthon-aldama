"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  title: z.string().trim().min(1).max(200),
  event_type: z.enum(["assignment", "exam", "presentation", "application", "event", "other"]),
  due_at: z.string().min(1),
  original_text: z.string().max(2000).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") redirect("/login");
  return { supabase, userId };
}

export async function saveSharedCandidates(formData: FormData) {
  const total = Number(formData.get("total") ?? 0);
  const rows: z.infer<typeof rowSchema>[] = [];

  for (let index = 0; index < total; index++) {
    if (formData.get(`include_${index}`) !== "on") continue;
    const parsed = rowSchema.safeParse({
      title: formData.get(`title_${index}`),
      event_type: formData.get(`event_type_${index}`),
      due_at: formData.get(`due_at_${index}`),
      original_text: formData.get(`snippet_${index}`) ?? undefined,
      confidence: formData.get(`confidence_${index}`) ?? undefined,
    });
    if (parsed.success) rows.push(parsed.data);
  }

  if (rows.length === 0) redirect("/dashboard");

  const { supabase, userId } = await authenticatedClient();
  await supabase.from("events").insert(
    rows.map((row) => ({
      user_id: userId,
      title: row.title,
      event_type: row.event_type,
      due_at: new Date(row.due_at).toISOString(),
      original_text: row.original_text ?? null,
      confidence: row.confidence ?? null,
    })),
  );

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
