"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailField = z.string().trim().toLowerCase().pipe(z.email());

export type ActionResult = { ok: true } | { ok: false; error: string };

function translate(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("rate limit")) return "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
  if (normalized.includes("invalid") && normalized.includes("otp")) return "인증번호가 올바르지 않아요. 다시 확인해주세요.";
  if (normalized.includes("expired")) return "인증번호가 만료됐어요. 처음부터 다시 시도해주세요.";
  if (normalized.includes("invalid email")) return "이메일 형식을 확인해주세요.";
  return `문제가 발생했어요: ${message}`;
}

export async function sendOtp(rawEmail: string): Promise<ActionResult> {
  const parsed = emailField.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: "이메일 형식을 확인해주세요." };

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/auth/confirmed")}`,
    },
  });
  if (error) return { ok: false, error: translate(error.message) };
  return { ok: true };
}

export async function checkVerified(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return { ok: false, error: "아직 인증이 확인되지 않았어요. 메일의 링크를 누른 뒤 다시 시도해주세요." };
  }
  return { ok: true };
}

export async function verifyCode(rawEmail: string, token: string): Promise<ActionResult> {
  const parsed = emailField.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: "이메일 형식을 확인해주세요." };
  if (!/^\d{6}$/.test(token.trim())) return { ok: false, error: "6자리 숫자 인증번호를 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data,
    token: token.trim(),
    type: "email",
  });
  if (error) return { ok: false, error: translate(error.message) };
  return { ok: true };
}

export async function setPassword(password: string, passwordConfirm: string): Promise<ActionResult> {
  if (password.length < 8 || password.length > 72) {
    return { ok: false, error: "비밀번호는 8자 이상이어야 해요." };
  }
  if (password !== passwordConfirm) {
    return { ok: false, error: "비밀번호가 서로 일치하지 않아요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: translate(error.message) };

  // 설계 흐름대로 "완료 → 로그인" 화면을 보여주기 위해 세션을 정리한다.
  await supabase.auth.signOut();
  return { ok: true };
}
