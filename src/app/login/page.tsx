import Image from "next/image";
import Link from "next/link";
import { StatusAlert } from "@/app/components/States";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <main className="page-shell page-shell--auth">
      <section className="card auth-card">
        <Link href="/" className="back-link">← 알다마</Link>
        <h1>로그인</h1>
        <div className="mascot-card">
          <div className="mascot-card__image">
            <Image src="/mascot/face.png" alt="" width={64} height={57} priority />
          </div>
          <div className="mascot-card__copy">
            <strong>다시 만나서 반가워요!</strong>
            <p>접속 정보를 입력해주세요.</p>
          </div>
        </div>
        {params.error && <StatusAlert tone="danger">{params.error}</StatusAlert>}
        {params.message && <StatusAlert tone="success">{params.message}</StatusAlert>}
        <LoginForm next={params.next} />
      </section>
    </main>
  );
}
