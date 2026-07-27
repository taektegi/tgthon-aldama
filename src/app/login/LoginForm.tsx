"use client";

import { useState } from "react";
import { signIn, signUp } from "./actions";
import { SubmitButton } from "./SubmitButton";

type Mode = "signin" | "signup";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const isSignUp = mode === "signup";

  return (
    <div className="auth-form">
      <div className="auth-tabs" role="tablist" aria-label="인증 방식">
        <button type="button" role="tab" aria-selected={!isSignUp} onClick={() => setMode("signin")}>
          로그인
        </button>
        <button type="button" role="tab" aria-selected={isSignUp} onClick={() => setMode("signup")}>
          회원가입
        </button>
      </div>

      <form className="form-stack">
        {next && <input type="hidden" name="next" value={next} />}
        <label className="label">
          이메일
          <input className="field" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="label">
          비밀번호
          <input
            className="field"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />
        </label>
        {isSignUp && (
          <label className="label">
            비밀번호 확인
            <input
              className="field"
              name="password_confirm"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
        )}

        {isSignUp ? (
          <SubmitButton className="button button-primary button-block" formAction={signUp} pendingLabel="가입 중...">
            회원가입
          </SubmitButton>
        ) : (
          <SubmitButton className="button button-accent button-block" formAction={signIn} pendingLabel="로그인 중...">
            로그인
          </SubmitButton>
        )}
      </form>
    </div>
  );
}
