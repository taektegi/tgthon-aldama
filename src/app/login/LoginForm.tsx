"use client";

import { useState } from "react";
import { signIn, signUp } from "./actions";
import { SubmitButton } from "./SubmitButton";

type Mode = "signin" | "signup";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const isSignUp = mode === "signup";

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "12px 0",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: active ? 800 : 600,
    background: active ? "var(--primary-deep)" : "transparent",
    color: active ? "#fff" : "#6b7280",
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, background: "#f3f4f8", borderRadius: 12, padding: 6, marginTop: 24 }}>
        <button type="button" style={tabStyle(!isSignUp)} onClick={() => setMode("signin")}>
          로그인
        </button>
        <button type="button" style={tabStyle(isSignUp)} onClick={() => setMode("signup")}>
          회원가입
        </button>
      </div>

      <form style={{ display: "grid", gap: 16, marginTop: 24 }}>
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
          <SubmitButton className="button button-primary" formAction={signUp} pendingLabel="가입 중..." style={{ padding: "14px 0", fontSize: 16 }}>
            회원가입
          </SubmitButton>
        ) : (
          <SubmitButton className="button button-accent" formAction={signIn} pendingLabel="로그인 중..." style={{ padding: "14px 0", fontSize: 16 }}>
            로그인
          </SubmitButton>
        )}
      </form>
    </div>
  );
}
