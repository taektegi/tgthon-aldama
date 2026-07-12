import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell" style={{ padding: "96px 0" }}>
      <section className="card" style={{ padding: 48, maxWidth: 760, margin: "0 auto" }}>
        <p style={{ color: "#5b5ce2", fontWeight: 800, margin: 0 }}>ALDAMA · 알다마</p>
        <h1 style={{ fontSize: "clamp(38px, 7vw, 68px)", lineHeight: 1.05, margin: "18px 0" }}>
          놓치기 전에,<br />마감을 한곳에.
        </h1>
        <p className="muted" style={{ fontSize: 18, lineHeight: 1.7, maxWidth: 590 }}>
          LearningX, 학교 공지, 단체 채팅에 흩어진 일정을 카드로 정리합니다.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Link className="button button-primary" href="/login">시작하기</Link>
          <Link className="button button-muted" href="/dashboard">일정 보드</Link>
        </div>
      </section>
    </main>
  );
}
