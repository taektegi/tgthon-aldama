import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUrgency } from "@/lib/urgency";
import { createEvent, deleteEvent, signOut } from "./actions";
import { CompleteButton } from "./CompleteButton";
import { NotificationSetup } from "./NotificationSetup";

function buildHero(events: Array<{ is_completed: boolean; due_at: string | null }>) {
  const now = Date.now();
  const active = events.filter((event) => !event.is_completed);
  const overdueCount = active.filter(
    (event) => event.due_at && new Date(event.due_at).getTime() < now,
  ).length;
  const urgentCount = active.filter(
    (event) => event.due_at && new Date(event.due_at).getTime() - now <= 24 * 60 * 60 * 1000,
  ).length - overdueCount;

  if (overdueCount > 0) {
    return { heroImg: "/mascot/overdue.png", heroMessage: `앗… 마감이 지난 일정이 ${overdueCount}개 있어요. 확인해주세요!` };
  }
  if (urgentCount > 0) {
    return { heroImg: "/mascot/urgent-run.png", heroMessage: `서둘러요! 24시간 안에 마감 ${urgentCount}개가 있어요.` };
  }
  if (active.length > 0) {
    return { heroImg: "/mascot/neutral.png", heroMessage: `오늘도 차근차근! 남은 일정 ${active.length}개를 지켜보고 있어요.` };
  }
  return { heroImg: "/mascot/neutral.png", heroMessage: "아직 일정이 없어요. 첫 카드를 만들어볼까요?" };
}

const typeLabels: Record<string, string> = {
  assignment: "과제", exam: "시험", presentation: "발표", application: "신청", event: "행사", other: "기타",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const { data } = await supabase.from("events").select("*").order("is_completed").order("due_at", { nullsFirst: false });
  const events = data ?? [];

  const { heroImg, heroMessage } = buildHero(events);

  return (
    <main className="shell" style={{ padding: "38px 0 80px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div><p style={{ color: "var(--primary-deep)", fontWeight: 800, margin: 0 }}>ALDAMA</p><h1 style={{ margin: "5px 0 0" }}>내 일정 카드</h1></div>
        <form action={signOut}><button className="button button-muted">로그아웃</button></form>
      </header>

      <div style={{ marginBottom: 16 }}>
        <NotificationSetup />
      </div>

      <section className="mascot-card" style={{ marginBottom: 24 }}>
        <Image src={heroImg} alt="" width={90} height={90} style={{ height: 80, width: "auto" }} />
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 17 }}>{heroMessage}</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>알다마 펭귄이 마감을 지켜보고 있어요.</p>
        </div>
      </section>

      <section className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>공지 텍스트로 추가</h2>
        <p className="muted" style={{ marginTop: -8 }}>카톡, 학교 공지, 이메일 내용을 복사해서 붙여넣으면 날짜/할 일을 자동으로 찾아드려요.</p>
        <form action="/share" method="GET" style={{ display: "grid", gap: 12 }}>
          <label className="label">
            공지 내용
            <textarea className="field" name="text" rows={4} placeholder="예: 7월 12일 23:59까지 보고서 제출해주세요." required />
          </label>
          <button className="button button-primary" type="submit" style={{ justifySelf: "start" }}>분석하기</button>
        </form>
      </section>

      <section className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>일정 직접 추가</h2>
        <form action={createEvent} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 2fr) 1fr minmax(190px, 1fr) auto", gap: 12, alignItems: "end" }}>
          <label className="label">제목<input className="field" name="title" placeholder="예: 프로젝트 보고서 제출" required /></label>
          <label className="label">유형<select className="field" name="event_type" defaultValue="assignment">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="label">마감<input className="field" name="due_at" type="datetime-local" required /></label>
          <button className="button button-primary">추가</button>
        </form>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        {events.length === 0 && <div className="card muted" style={{ padding: 36, textAlign: "center" }}>아직 일정이 없습니다. 첫 일정을 추가해보세요.</div>}
        {events.map((event) => {
          const urgency = event.is_completed
            ? { level: "none" as const, label: "완료", background: "#f3f4f6", color: "#6b7280", fontWeight: 700 }
            : getUrgency(event.due_at);
          const mascotByLevel: Record<string, string> = {
            overdue: "/mascot/urgent-run.png",
            urgent: "/mascot/alarm.png",
            today: "/mascot/alarm.png",
            soon: "/mascot/face.png",
            later: "/mascot/question.png",
            distant: "/mascot/sleeping.png",
            none: "/mascot/face.png",
          };
          const mascotSrc = event.is_completed ? "/mascot/happy.png" : mascotByLevel[urgency.level];
          const bigLabel = urgency.level === "overdue" ? "마감 경과! 긴급!" : urgency.label;
          return (
            <article
              key={event.id}
              className="card"
              style={{ padding: 14, display: "grid", gridTemplateColumns: "96px 1fr auto", alignItems: "stretch", gap: 16, opacity: event.is_completed ? 0.55 : 1 }}
            >
              <div
                style={{
                  background: "var(--primary-pale)",
                  borderRadius: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 8,
                }}
              >
                <Image
                  src={mascotSrc}
                  alt=""
                  width={80}
                  height={80}
                  style={{ maxHeight: 76, width: "auto", maxWidth: 80 }}
                />
              </div>
              <div style={{ display: "grid", alignContent: "center", gap: 4 }}>
                <p style={{ margin: 0, fontSize: 22, lineHeight: 1.1, color: urgency.color, fontWeight: urgency.fontWeight >= 800 ? 900 : 800 }}>
                  {bigLabel}
                </p>
                <h3 style={{ margin: 0, fontSize: 16, textDecoration: event.is_completed ? "line-through" : "none" }}>{event.title}</h3>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {event.due_at ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(event.due_at)) : "마감 없음"}
                </p>
              </div>
              <div style={{ display: "grid", alignContent: "center", justifyItems: "end", gap: 8 }}>
                <span
                  style={{
                    background: urgency.background,
                    color: urgency.color,
                    fontWeight: 800,
                    fontSize: 13,
                    padding: "5px 12px",
                    borderRadius: 999,
                  }}
                >
                  {typeLabels[event.event_type]}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <CompleteButton id={event.id} isCompleted={event.is_completed} />
                  <form action={deleteEvent}><input type="hidden" name="id" value={event.id} /><button className="button button-danger">삭제</button></form>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
