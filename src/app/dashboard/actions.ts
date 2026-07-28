"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { transcribeNoticeImage } from "@/lib/ai-parser";
import { parseKstLocal } from "@/lib/datetime";
import { canvasSyncErrorInfo, syncCanvasSource, type CanvasSyncErrorCode } from "@/lib/canvas/sync";
import { OVERRIDABLE_FIELDS, type OverrideField } from "@/lib/canvas/mapping";

const eventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(100).optional().transform((value) => (value && value.length > 0 ? value : null)),
  event_type: z.enum(["assignment", "exam", "presentation", "application", "event", "other"]),
  starts_at: z.string().optional().transform((value) => (value && value.length > 0 ? value : null)),
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
    starts_at: parsed.data.starts_at ? parseKstLocal(parsed.data.starts_at).toISOString() : null,
    due_at: parseKstLocal(parsed.data.due_at).toISOString(),
  });
  revalidatePath("/dashboard");
}

const updateSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(100).optional().transform((value) => (value && value.length > 0 ? value : null)),
  event_type: z.enum(["assignment", "exam", "presentation", "application", "event", "other"]),
  starts_at: z.string().optional().transform((value) => (value && value.length > 0 ? value : null)),
  due_at: z.string().optional().transform((value) => (value && value.length > 0 ? value : null)),
});

export async function updateEvent(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard");
  const { supabase } = await authenticatedClient();
  const { data: current, error } = await supabase
    .from("events")
    .select("source_id, external_uid, title, subject, event_type, starts_at, due_at, override_fields")
    .eq("id", parsed.data.id)
    .single();
  if (error || !current) redirect("/dashboard");

  const next = {
    title: parsed.data.title,
    subject: parsed.data.subject,
    event_type: parsed.data.event_type,
    starts_at: parsed.data.starts_at ? parseKstLocal(parsed.data.starts_at).toISOString() : null,
    due_at: parsed.data.due_at ? parseKstLocal(parsed.data.due_at).toISOString() : null,
  };
  const patch: typeof next & { override_fields?: string[] } = next;
  if (current.source_id && current.external_uid?.startsWith("canvas:")) {
    const overrides = new Set<OverrideField>(
      current.override_fields.filter(
        (field): field is OverrideField => OVERRIDABLE_FIELDS.includes(field as OverrideField),
      ),
    );
    for (const field of OVERRIDABLE_FIELDS) {
      const currentValue = current[field];
      const nextValue = next[field];
      const changed = field === "starts_at" || field === "due_at"
        ? currentValue !== nextValue && Date.parse(currentValue ?? "") !== Date.parse(nextValue ?? "")
        : currentValue !== nextValue;
      if (changed) overrides.add(field);
    }
    patch.override_fields = [...overrides];
  }

  await supabase.from("events").update(patch).eq("id", parsed.data.id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function restoreLearnXOriginal(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/dashboard");
  const { supabase } = await authenticatedClient();
  const { data: event, error } = await supabase
    .from("events")
    .select("source_id, external_uid")
    .eq("id", id.data)
    .single();
  if (error || !event?.source_id || !event.external_uid?.startsWith("canvas:")) {
    redirect("/dashboard");
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({ override_fields: [] })
    .eq("id", id.data);
  if (updateError) redirect("/dashboard?restoreError=1");

  const result = await syncLearnXNow();
  redirect(result.ok ? "/dashboard?restored=1" : "/dashboard?restoreError=1");
}

export type ToggleEventState = {
  status: "idle" | "success" | "error";
  message: string;
  isCompleted?: boolean;
};

export async function toggleEvent(_previousState: ToggleEventState, formData: FormData): Promise<ToggleEventState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const completed = formData.get("completed") === "true";
  if (!id.success) {
    return { status: "error", message: "일정 정보를 확인하지 못했어요. 화면을 새로고침해주세요." };
  }
  const { supabase } = await authenticatedClient();
  const nextCompleted = !completed;
  const { data: updated, error } = await supabase.from("events").update({
    is_completed: nextCompleted,
    completed_at: completed ? null : new Date().toISOString(),
  }).eq("id", id.data).select("id, is_completed").maybeSingle();

  if (error || !updated) {
    return { status: "error", message: "완료 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  revalidatePath("/dashboard");
  return {
    status: "success",
    message: updated.is_completed ? "완료했어요." : "미완료 일정으로 되돌렸어요.",
    isCompleted: updated.is_completed,
  };
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
  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("id, user_id, credential_ciphertext")
    .eq("user_id", userId)
    .eq("type", "canvas")
    .eq("status", "active")
    .maybeSingle();
  if (sourceError) {
    return { ok: false as const, code: "SYNC_DATABASE_ERROR" as const };
  }
  if (!source?.credential_ciphertext) {
    return { ok: false as const, code: "NOT_CONNECTED" as const };
  }

  try {
    const result = await syncCanvasSource(supabase, {
        id: source.id,
        user_id: source.user_id,
        credential_ciphertext: source.credential_ciphertext,
    });
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    return { ok: true as const, ...result };
  } catch (error) {
    const { code } = canvasSyncErrorInfo(error);
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    return { ok: false as const, code: code satisfies CanvasSyncErrorCode };
  }
}

export async function syncLearnXFromForm() {
  await syncLearnXNow();
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
