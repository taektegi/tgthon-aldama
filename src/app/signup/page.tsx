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
    <main className="shell" style={{ padding: "72px 0" }}>
      <section className="card" style={{ maxWidth: 440, margin: "0 auto", padding: 32 }}>
        <Link href="/" className="muted">← 알다마</Link>
        <h1 style={{ margin: "20px 0 14px", fontSize: 28 }}>회원가입</h1>
        <div className="mascot-card" style={{ marginBottom: 20 }}>
          <Image src="/mascot/neutral.png" alt="" width={56} height={69} style={{ width: 56, height: "auto" }} />
          <div>
            <p style={{ margin: 0, fontWeight: 800 }}>새로 온 동료 펭귄, 환영해요!</p>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>이메일 인증 한 번이면 바로 시작할 수 있어요.</p>
          </div>
        </div>
        <SignupWizard />
        <p className="muted" style={{ fontSize: 13, marginTop: 20, textAlign: "center" }}>
          이미 계정이 있나요? <Link href="/login" style={{ color: "var(--primary-deep)", fontWeight: 700 }}>로그인</Link>
        </p>
      </section>
    </main>
  );
}
