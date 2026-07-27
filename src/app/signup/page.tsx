import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupWizard } from "./SignupWizard";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims) redirect("/dashboard");

  return (
    <main className="page-shell page-shell--auth">
      <section className="card auth-card">
        <Link href="/" className="back-link">← 알다마</Link>
        <h1>회원가입</h1>
        <div className="mascot-card auth-card__mascot">
          <div className="mascot-card__image"><Image src="/mascot/neutral.png" alt="" width={56} height={69} priority /></div>
          <div className="mascot-card__copy">
            <strong>새로 온 동료 펭귄, 환영해요!</strong>
            <p>이메일 인증 한 번이면 바로 시작할 수 있어요.</p>
          </div>
        </div>
        <SignupWizard />
        <p className="auth-card__footer">
          이미 계정이 있나요? <Link href="/login" className="text-link">로그인</Link>
        </p>
      </section>
    </main>
  );
}
