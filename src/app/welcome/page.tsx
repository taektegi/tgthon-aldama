import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon } from "@/app/components/UiIcons";
import { createClient } from "@/lib/supabase/server";
import { OnboardingCarousel } from "../OnboardingCarousel";

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  return (
    <main className="page-shell landing-shell">
      <section className="landing-hero">
        <p className="eyebrow">갈피</p>
        <h1>갈피 시작하기</h1>

        <div className="landing-carousel">
          <OnboardingCarousel />
        </div>

        <Link className="button button-primary landing-cta" href="/dashboard">
          내 일정 카드 시작하기
          <ArrowRightIcon />
        </Link>
      </section>
    </main>
  );
}
