import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingCarousel } from "./OnboardingCarousel";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims) redirect("/dashboard");

  return (
    <main className="shell" style={{ padding: "72px 0 96px" }}>
      <section style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <p style={{ color: "var(--primary-deep)", fontWeight: 800, margin: 0 }}>ALDAMA · 알다마</p>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 52px)", lineHeight: 1.15, margin: "16px 0 10px" }}>
          알다마에 오신 걸 환영해요! 👋
        </h1>
        <p className="muted" style={{ fontSize: 18, lineHeight: 1.7, margin: 0 }}>
          공지 속에 숨은 마감을, 행동할 수 있는 카드로 바꿔드려요.
        </p>

        <div style={{ margin: "36px 0" }}>
          <OnboardingCarousel />
        </div>

        <Link
          className="button button-primary"
          href="/signup"
          style={{ fontSize: 17, padding: "14px 28px", display: "inline-block" }}
        >
          바로 회원가입하러 가기!
        </Link>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          이미 계정이 있다면 로그인만 하면 돼요.
        </p>
      </section>
    </main>
  );
}
