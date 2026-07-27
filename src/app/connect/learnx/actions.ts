"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { CanvasAuthError, fetchSelf } from "@/lib/canvas/api";
import { canvasSyncErrorInfo, syncCanvasSource } from "@/lib/canvas/sync";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") redirect("/login");
  return { supabase, userId };
}

export async function connectLearnX(formData: FormData) {
  if (!process.env.CANVAS_BASE_URL || !process.env.TOKEN_ENCRYPTION_KEY) {
    redirect("/connect/learnx?error=config");
  }
  const token = z.string().trim().min(10).safeParse(formData.get("token"));
  if (!token.success) redirect("/connect/learnx?error=invalid");
  const { supabase, userId } = await authenticatedClient();

  // 토큰이 진짜인지 학교에 물어본다 ("이 출입증 유효해?")
  let displayName = "";
  try {
    displayName = (await fetchSelf(token.data)).name;
  } catch (error) {
    const code = canvasSyncErrorInfo(error).code;
    const reason = error instanceof CanvasAuthError
      ? "invalid"
      : code === "RATE_LIMITED"
        ? "rateLimited"
        : code === "CANVAS_TEMPORARY"
          ? "unavailable"
          : "network";
    redirect(`/connect/learnx?error=${reason}`);
  }

  // 기존 연결이 있으면 토큰 교체(재연결), 없으면 새로 만든다
  const { data: existing, error: existingError } = await supabase
    .from("sources")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "canvas")
    .maybeSingle();
  if (existingError) redirect("/connect/learnx?error=save");

  const credential = encryptSecret(token.data);
  let sourceId: string;
  if (existing) {
    const { error } = await supabase
      .from("sources")
      .update({ credential_ciphertext: credential, status: "active", last_sync_error: null })
      .eq("id", existing.id);
    if (error) redirect("/connect/learnx?error=save");
    sourceId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("sources")
      .insert({ user_id: userId, type: "canvas", name: `LearningX (${displayName})`, credential_ciphertext: credential })
      .select("id")
      .single();
    if (error || !created) redirect("/connect/learnx?error=save");
    sourceId = created.id;
  }

  // 첫 동기화. 실패해도 연결 자체는 저장돼 있으니 대시보드에서 다시 시도 가능
  let inserted = 0;
  let syncError: string | null = null;
  try {
    const result = await syncCanvasSource(supabase, {
      id: sourceId,
      user_id: userId,
      credential_ciphertext: credential,
    });
    inserted = result.inserted;
  } catch (error) {
    syncError = canvasSyncErrorInfo(error).code;
  }
  revalidatePath("/dashboard");
  const query = new URLSearchParams({ connected: String(inserted) });
  if (syncError) query.set("syncError", syncError);
  redirect(`/dashboard?${query}`);
}

export async function disconnectLearnX() {
  const { supabase, userId } = await authenticatedClient();
  // 소스만 삭제 — events.source_id는 on delete set null이라 카드는 남는다
  const { error } = await supabase.from("sources").delete().eq("user_id", userId).eq("type", "canvas");
  if (error) redirect("/settings?learnxError=disconnect");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
