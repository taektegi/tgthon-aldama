import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "@/app/components/UiIcons";
import { createClient } from "@/lib/supabase/server";
import { SignupWizard } from "./SignupWizard";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims) redirect("/dashboard");

  return (
    <main className="page-shell page-shell--auth">
      <section className="card auth-card">
        <Link href="/" className="back-link"><ArrowLeftIcon />갈피</Link>
        <h1>회원가입</h1>
        <p className="auth-card__intro">이메일 인증 한 번이면 바로 시작할 수 있어요.</p>
        <SignupWizard />
        <p className="auth-card__footer">
          이미 계정이 있나요? <Link href="/login" className="text-link">로그인</Link>
        </p>
      </section>
    </main>
  );
}
