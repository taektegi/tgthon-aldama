import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUrgency } from "@/lib/urgency";
import { createEvent, deleteEvent, signOut } from "./actions";
import { CompleteButton } from "./CompleteButton";
import { NotificationSetup } from "./NotificationSetup";

const typeLabels: Record<string, string> = {
  assignment: "과제", exam: "시험", presentation: "발표", application: "신청", event: "행사", other: "기타",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const { data } = await supabase.from("events").select("*").order("is_completed").order("due_at", { nullsFirst: false });
  const events = data ?? [];

  return (
    <main className="shell" style={{ padding: "38px 0 80px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div><p style={{ color: "#5b5ce2", fontWeight: 800, margin: 0 }}>ALDAMA</p><h1 style={{ margin: "5px 0 0" }}>내 일정 카드</h1></div>
        <form action={signOut}><button className="button button-muted">로그아웃</button></form>
      </header>

      <div style={{ marginBottom: 28 }}>
        <NotificationSetup />
      </div>

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
            ? { label: "완료", background: "#f3f4f6", color: "#6b7280", fontWeight: 700 }
            : getUrgency(event.due_at);
          return (
            <article
              key={event.id}
              className="card"
              style={{ padding: 20, display: "grid", gridTemplateColumns: "64px 1fr auto", alignItems: "center", gap: 16, opacity: event.is_completed ? 0.58 : 1 }}
            >
              <div
                style={{
                  minHeight: 56,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "6px 4px",
                  background: urgency.background,
                  color: urgency.color,
                  fontWeight: urgency.fontWeight,
                  fontSize: 13,
                  lineHeight: 1.15,
                }}
              >
                {urgency.label}
              </div>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ color: "#5b5ce2", fontSize: 13, fontWeight: 800 }}>{typeLabels[event.event_type]}</span><h3 style={{ margin: 0, textDecoration: event.is_completed ? "line-through" : "none" }}>{event.title}</h3></div>
                <p className="muted" style={{ margin: "7px 0 0" }}>{event.due_at ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(event.due_at)) : "마감 없음"}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <CompleteButton id={event.id} isCompleted={event.is_completed} />
                <form action={deleteEvent}><input type="hidden" name="id" value={event.id} /><button className="button button-danger">삭제</button></form>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
