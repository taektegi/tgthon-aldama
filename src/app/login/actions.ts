"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email());

const credentialsSchema = z.object({
  email: emailField,
  password: z.string().min(8).max(72),
});

const signUpSchema = z
  .object({
    email: emailField,
    password: z.string().min(8, "비밀번호는 8자 이상이어야 해요.").max(72),
    password_confirm: z.string(),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: "비밀번호가 서로 일치하지 않아요.",
    path: ["password_confirm"],
  });

function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "이미 가입된 이메일이에요. 로그인해주세요.";
  }
  if (normalized.includes("rate limit")) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }
  if (normalized.includes("password should be at least") || normalized.includes("password is too short")) {
    return "비밀번호는 8자 이상이어야 해요.";
  }
  if (normalized.includes("unable to validate email") || normalized.includes("invalid email")) {
    return "이메일 형식을 확인해주세요.";
  }

  return `문제가 발생했어요: ${message}`;
}

function loginError(message: string, next?: FormDataEntryValue | null): never {
  const nextParam = safeNextPath(next) ? `&next=${encodeURIComponent(safeNextPath(next)!)}` : "";
  redirect(`/login?error=${encodeURIComponent(message)}${nextParam}`);
}

function safeNextPath(next: FormDataEntryValue | null | undefined): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export async function signIn(formData: FormData) {
  const next = formData.get("next");
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return loginError("이메일과 8자 이상의 비밀번호를 확인해주세요.", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) loginError(translateAuthError(error.message), next);
  redirect(safeNextPath(next) ?? "/dashboard");
}

export async function signUp(formData: FormData) {
  const next = formData.get("next");
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return loginError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.", next);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback` },
  });
  if (error) loginError(translateAuthError(error.message), next);

  if (data.session) redirect(safeNextPath(next) ?? "/dashboard");
  redirect("/login?message=확인 이메일을 보냈습니다.");
}
