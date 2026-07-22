import Link from "next/link";
import { signIn, signUp } from "./actions";
import { SubmitButton } from "./SubmitButton";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <main className="shell" style={{ padding: "72px 0" }}>
      <section className="card" style={{ maxWidth: 460, margin: "0 auto", padding: 36 }}>
        <Link href="/" className="muted">← 알다마</Link>
        <h1 style={{ margin: "24px 0 8px", fontSize: 32 }}>로그인</h1>
        <p className="muted" style={{ marginTop: 0 }}>내 일정 카드를 안전하게 관리하세요.</p>
        {params.error && <p style={{ color: "#b42318", background: "#fff0f0", padding: 12, borderRadius: 10 }}>{params.error}</p>}
        {params.message && <p style={{ color: "#067647", background: "#ecfdf3", padding: 12, borderRadius: 10 }}>{params.message}</p>}
        <form style={{ display: "grid", gap: 16, marginTop: 24 }}>
          {params.next && <input type="hidden" name="next" value={params.next} />}
          <label className="label">이메일<input className="field" name="email" type="email" required autoComplete="email" /></label>
          <label className="label">비밀번호<input className="field" name="password" type="password" minLength={8} required autoComplete="current-password" /></label>
          <label className="label">
            비밀번호 확인 <span className="muted" style={{ fontWeight: 400 }}>(회원가입 시에만 필요해요)</span>
            <input className="field" name="password_confirm" type="password" minLength={8} autoComplete="new-password" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <SubmitButton className="button button-primary" formAction={signIn} pendingLabel="로그인 중...">로그인</SubmitButton>
            <SubmitButton className="button button-muted" formAction={signUp} pendingLabel="가입 중...">회원가입</SubmitButton>
          </div>
        </form>
      </section>
    </main>
  );
}
