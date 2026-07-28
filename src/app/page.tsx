import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon } from "@/app/components/UiIcons";
import { createClient } from "@/lib/supabase/server";
import { OnboardingCarousel } from "./OnboardingCarousel";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims) redirect("/dashboard");

  return (
    <main className="page-shell landing-shell">
      <section className="landing-hero">
        <p className="eyebrow">ALDAMA · 알다마</p>
        <h1>
          알다마에 오신 걸 환영해요
        </h1>
        <p className="landing-hero__description">
          공지 속에 숨은 마감을, 행동할 수 있는 카드로 바꿔드려요.
        </p>

        <div className="landing-carousel">
          <OnboardingCarousel />
        </div>

        <Link className="button button-primary landing-cta" href="/signup">
          바로 시작하기
          <ArrowRightIcon />
        </Link>
        <p className="landing-login">
          이미 계정이 있나요? <Link href="/login" className="text-link">로그인</Link>
        </p>
      </section>
    </main>
  );
}
