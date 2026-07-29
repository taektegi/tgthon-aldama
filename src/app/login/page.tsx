import Link from "next/link";
import { StatusAlert } from "@/app/components/States";
import { ArrowLeftIcon } from "@/app/components/UiIcons";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <main className="page-shell page-shell--auth">
      <section className="card auth-card">
        <Link href="/" className="back-link"><ArrowLeftIcon />갈피</Link>
        <h1>로그인</h1>
        <p className="auth-card__intro">접속 정보를 입력해주세요.</p>
        {params.error && <StatusAlert tone="danger">{params.error}</StatusAlert>}
        {params.message && <StatusAlert tone="success">{params.message}</StatusAlert>}
        <LoginForm next={params.next} />
      </section>
    </main>
  );
}
