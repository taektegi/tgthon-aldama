import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingCarousel } from "../OnboardingCarousel";

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  return (
    <main className="shell" style={{ padding: "72px 0 96px" }}>
      <section style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <p style={{ color: "#5b5ce2", fontWeight: 800, margin: 0 }}>ALDAMA · 알다마</p>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1.2, margin: "16px 0 10px" }}>
          환영해요! 알다마는 이렇게 써요
        </h1>

        <div style={{ margin: "32px 0" }}>
          <OnboardingCarousel />
        </div>

        <Link
          className="button button-primary"
          href="/dashboard"
          style={{ fontSize: 17, padding: "14px 28px", display: "inline-block" }}
        >
          내 일정 카드 시작하기
        </Link>
      </section>
    </main>
  );
}
