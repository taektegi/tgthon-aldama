import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <main className="shell" style={{ padding: "72px 0" }}>
      <section className="card" style={{ maxWidth: 440, margin: "0 auto", padding: 32 }}>
        <Link href="/" className="muted">← 알다마</Link>
        <h1 style={{ margin: "20px 0 6px", fontSize: 28 }}>다시 만나서 반가워요</h1>
        <p className="muted" style={{ marginTop: 0 }}>내 일정 카드를 안전하게 관리하세요.</p>
        {params.error && <p style={{ color: "#b42318", background: "#fff0f0", padding: 12, borderRadius: 10 }}>{params.error}</p>}
        {params.message && <p style={{ color: "#067647", background: "#ecfdf3", padding: 12, borderRadius: 10 }}>{params.message}</p>}
        <LoginForm next={params.next} />
      </section>
    </main>
  );
}
