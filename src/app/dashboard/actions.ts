"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { transcribeNoticeImage } from "@/lib/ai-parser";
import { parseKstLocal } from "@/lib/datetime";
import { syncCanvasSource } from "@/lib/canvas/sync";

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
    due_at: parseKstLocal(parsed.data.due_at).toISOString(),
  });
  revalidatePath("/dashboard");
}

const updateSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(100).optional().transform((value) => (value && value.length > 0 ? value : null)),
  event_type: z.enum(["assignment", "exam", "presentation", "application", "event", "other"]),
  due_at: z.string().optional().transform((value) => (value && value.length > 0 ? value : null)),
});

export async function updateEvent(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard");
  const { supabase } = await authenticatedClient();
  await supabase.from("events").update({
    title: parsed.data.title,
    subject: parsed.data.subject,
    event_type: parsed.data.event_type,
    due_at: parsed.data.due_at ? parseKstLocal(parsed.data.due_at).toISOString() : null,
  }).eq("id", parsed.data.id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
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
  const { data: event } = await supabase.from("events").select("source_id").eq("id", id.data).single();
  if (event?.source_id) {
    // 연동 카드는 지우면 다음 동기화 때 되살아나므로 "숨김"으로 처리한다
    await supabase.from("events").update({ is_hidden: true }).eq("id", id.data);
  } else {
    await supabase.from("events").delete().eq("id", id.data);
  }
  revalidatePath("/dashboard");
}

export async function syncLearnXNow() {
  const { supabase, userId } = await authenticatedClient();
  const { data: source } = await supabase
    .from("sources")
    .select("id, user_id, credential_ciphertext")
    .eq("user_id", userId)
    .eq("type", "canvas")
    .eq("status", "active")
    .maybeSingle();
  if (source?.credential_ciphertext) {
    try {
      await syncCanvasSource(supabase, {
        id: source.id,
        user_id: source.user_id,
        credential_ciphertext: source.credential_ciphertext,
      });
    } catch {
      // 실패 내용은 sources.status/last_sync_error에 기록됨 — 대시보드 배너가 안내
    }
  }
  revalidatePath("/dashboard");
}

export async function analyzeNoticeImage(formData: FormData) {
  await authenticatedClient();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/dashboard?add=text&error=" + encodeURIComponent("이미지를 선택해주세요."));
  }
  if (!file.type.startsWith("image/")) {
    redirect("/dashboard?add=text&error=" + encodeURIComponent("이미지 파일만 올릴 수 있어요."));
  }
  if (file.size > 7 * 1024 * 1024) {
    redirect("/dashboard?add=text&error=" + encodeURIComponent("이미지가 너무 커요 (7MB 이하)."));
  }

  let text: string;
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    text = await transcribeNoticeImage(base64, file.type);
  } catch {
    redirect("/dashboard?add=text&error=" + encodeURIComponent("이미지에서 글자를 읽지 못했어요. 텍스트로 붙여넣어 주세요."));
  }

  redirect(`/share?text=${encodeURIComponent(text.slice(0, 3000))}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
