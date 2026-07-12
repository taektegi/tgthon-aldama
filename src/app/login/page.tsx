import Link from "next/link";
import { signIn, signUp } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
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
          <label className="label">이메일<input className="field" name="email" type="email" required autoComplete="email" /></label>
          <label className="label">비밀번호<input className="field" name="password" type="password" minLength={8} required autoComplete="current-password" /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button className="button button-primary" formAction={signIn}>로그인</button>
            <button className="button button-muted" formAction={signUp}>회원가입</button>
          </div>
        </form>
      </section>
    </main>
  );
}
