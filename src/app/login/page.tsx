import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <main className="shell" style={{ padding: "72px 0" }}>
      <section className="card" style={{ maxWidth: 440, margin: "0 auto", padding: 32 }}>
        <Link href="/" className="muted">← 알다마</Link>
        <h1 style={{ margin: "20px 0 14px", fontSize: 28 }}>로그인</h1>
        <div className="mascot-card">
          <Image src="/mascot/face.png" alt="" width={64} height={57} style={{ width: 64, height: "auto" }} />
          <div>
            <p style={{ margin: 0, fontWeight: 800 }}>다시 만나서 반가워요!</p>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>접속 정보를 입력해주세요.</p>
          </div>
        </div>
        {params.error && <p style={{ color: "#b42318", background: "#fff0f0", padding: 12, borderRadius: 10 }}>{params.error}</p>}
        {params.message && <p style={{ color: "#067647", background: "#ecfdf3", padding: 12, borderRadius: 10 }}>{params.message}</p>}
        <LoginForm next={params.next} />
      </section>
    </main>
  );
}
