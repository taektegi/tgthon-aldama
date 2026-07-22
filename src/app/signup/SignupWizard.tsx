"use client";

import Link from "next/link";
import { useState } from "react";
import { sendOtp, checkVerified, setPassword } from "./actions";

type Step = "email" | "verify" | "password" | "done";

export function SignupWizard() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, nextStep: Step) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      setStep(nextStep);
    } else {
      setError(result.error ?? "문제가 발생했어요.");
    }
  }

  const stepIndex = { email: 1, verify: 2, password: 3, done: 4 }[step];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {step !== "done" && (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>단계 {stepIndex} / 3</p>
      )}
      {error && (
        <p style={{ color: "#b42318", background: "#fff0f0", padding: 12, borderRadius: 10, margin: 0 }}>{error}</p>
      )}

      {step === "email" && (
        <form
          style={{ display: "grid", gap: 16 }}
          onSubmit={(event) => {
            event.preventDefault();
            run(() => sendOtp(email), "verify");
          }}
        >
          <label className="label">
            이메일
            <input
              className="field"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="school@university.ac.kr"
              required
              autoComplete="email"
            />
          </label>
          <button className="button button-primary" disabled={busy} style={{ padding: "14px 0", fontSize: 16 }}>
            {busy ? "전송 중..." : "인증 메일 받기"}
          </button>
        </form>
      )}

      {step === "verify" && (
        <div style={{ display: "grid", gap: 16 }}>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            <strong>{email}</strong> 로 인증 메일을 보냈어요.<br />
            메일함에서 <strong>“Confirm email address”</strong> 링크를 누른 뒤, 이 창으로 돌아와 아래 버튼을 눌러주세요.
          </p>
          <button
            type="button"
            className="button button-primary"
            disabled={busy}
            onClick={() => run(() => checkVerified(), "password")}
            style={{ padding: "14px 0", fontSize: 16 }}
          >
            {busy ? "확인 중..." : "인증 확인"}
          </button>
          <button
            type="button"
            className="button button-muted"
            disabled={busy}
            onClick={() => run(() => sendOtp(email), "verify")}
          >
            인증 메일 다시 받기
          </button>
        </div>
      )}

      {step === "password" && (
        <form
          style={{ display: "grid", gap: 16 }}
          onSubmit={(event) => {
            event.preventDefault();
            run(() => setPassword(pw, pwConfirm), "done");
          }}
        >
          <p className="muted" style={{ margin: 0 }}>이메일 인증 완료! 이제 비밀번호를 정해주세요.</p>
          <label className="label">
            비밀번호 <span className="muted" style={{ fontWeight: 400 }}>(8자 이상)</span>
            <input
              className="field"
              type="password"
              minLength={8}
              value={pw}
              onChange={(event) => setPw(event.target.value)}
              required
              autoComplete="new-password"
            />
          </label>
          <label className="label">
            비밀번호 확인
            <input
              className="field"
              type="password"
              minLength={8}
              value={pwConfirm}
              onChange={(event) => setPwConfirm(event.target.value)}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="button button-primary" disabled={busy} style={{ padding: "14px 0", fontSize: 16 }}>
            {busy ? "저장 중..." : "회원가입하기"}
          </button>
        </form>
      )}

      {step === "done" && (
        <div style={{ display: "grid", gap: 16, justifyItems: "center", textAlign: "center", padding: "12px 0" }}>
          <div style={{ fontSize: 56 }} aria-hidden>🎉</div>
          <h2 style={{ margin: 0 }}>회원가입이 완료되었어요!</h2>
          <Link
            className="button button-primary"
            href="/login?next=%2Fwelcome"
            style={{ padding: "14px 28px", fontSize: 16 }}
          >
            바로 로그인하러 갈까요?
          </Link>
        </div>
      )}
    </div>
  );
}
