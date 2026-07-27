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
    <div className="signup-wizard" aria-busy={busy}>
      {step !== "done" && (
        <div className="signup-progress">
          <div className="signup-progress__label"><span>회원가입 단계</span><strong>{stepIndex} / 3</strong></div>
          <progress value={stepIndex} max={3}>단계 {stepIndex} / 3</progress>
        </div>
      )}
      {error && (
        <p className="status-alert status-alert--danger" role="alert">{error}</p>
      )}

      {step === "email" && (
        <form
          className="form-stack"
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
          <button className="button button-primary button-block" disabled={busy}>
            {busy ? "전송 중..." : "인증 메일 받기"}
          </button>
        </form>
      )}

      {step === "verify" && (
        <div className="form-stack">
          <p className="signup-wizard__message">
            <strong>{email}</strong> 로 인증 메일을 보냈어요.<br />
            메일함에서 <strong>“Confirm email address”</strong> 링크를 누른 뒤, 이 창으로 돌아와 아래 버튼을 눌러주세요.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => checkVerified(), "password")}
            className="button button-primary button-block"
          >
            {busy ? "확인 중..." : "인증 확인"}
          </button>
          <button
            type="button"
            className="button button-muted button-block"
            disabled={busy}
            onClick={() => run(() => sendOtp(email), "verify")}
          >
            인증 메일 다시 받기
          </button>
        </div>
      )}

      {step === "password" && (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => setPassword(pw, pwConfirm), "done");
          }}
        >
          <p className="signup-wizard__message">이메일 인증 완료! 이제 비밀번호를 정해주세요.</p>
          <label className="label">
            비밀번호 <span className="field-help">8자 이상</span>
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
          <button className="button button-primary button-block" disabled={busy}>
            {busy ? "저장 중..." : "회원가입하기"}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="signup-complete">
          <div className="signup-complete__icon" aria-hidden>🎉</div>
          <h2>회원가입이 완료되었어요!</h2>
          <Link
            className="button button-primary"
            href="/login?next=%2Fwelcome"
          >
            바로 로그인하러 갈까요?
          </Link>
        </div>
      )}
    </div>
  );
}
