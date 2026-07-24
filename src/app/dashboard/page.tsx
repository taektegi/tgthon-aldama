import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUrgency } from "@/lib/urgency";
import { toKstInputValue } from "@/lib/datetime";
import { analyzeNoticeImage, createEvent, deleteEvent, updateEvent } from "./actions";
import { ClipboardAnalyzeButton } from "./ClipboardAnalyzeButton";
import { CompleteButton } from "./CompleteButton";
import { NotificationSetup } from "./NotificationSetup";
import LearnXSync from "./LearnXSync";

const kstDay = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(iso));

function monthGrid(ym: string) {
  const [y, mo] = ym.split("-").map(Number);
  const startDow = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { y, mo, cells: [...Array(startDow).fill(null) as null[], ...Array.from({ length: days }, (_, i) => i + 1)] };
}

function shiftMonth(ym: string, delta: number) {
  const [y, mo] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

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

function buildSyncedLabel(lastSyncedAt: string | null): string | null {
  if (!lastSyncedAt) return null;
  const minutes = Math.max(0, Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 60000));
  return `러닝엑스 · ${minutes}분 전 동기화`;
}

const typeLabels: Record<string, string> = {
  assignment: "과제", exam: "시험", presentation: "발표", application: "신청", event: "행사", other: "기타",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ edit?: string; add?: string; error?: string; view?: string; date?: string; m?: string; connected?: string; syncError?: string }> }) {
  const { edit: editId, add: addMode, error: errorMsg, view: viewParam, date: dateParam, m: mParam, connected, syncError } = await searchParams;
  const cookieStore = await cookies();
  const savedView = cookieStore.get("aldama_view")?.value;
  const view = viewParam === "calendar" || viewParam === "list" ? viewParam : savedView === "calendar" ? "calendar" : "list";
  const todayStr = kstDay(new Date().toISOString());
  const ym = /^\d{4}-\d{2}$/.test(mParam ?? "") ? mParam! : todayStr.slice(0, 7);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const { data } = await supabase.from("events").select("*").eq("is_hidden", false).order("is_completed").order("due_at", { nullsFirst: false });
  const events = data ?? [];

  const { data: canvasSource } = await supabase
    .from("sources")
    .select("id, status, last_synced_at, last_sync_error")
    .eq("type", "canvas")
    .maybeSingle();

  const { heroImg, heroMessage } = buildHero(events);

  return (
    <main className="shell" style={{ padding: "38px 0 80px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div><p style={{ color: "var(--primary-deep)", fontWeight: 800, margin: 0 }}>ALDAMA</p><h1 style={{ margin: "5px 0 0" }}>내 일정 카드</h1></div>
        <Link href="/settings" className="button button-muted">⚙️ 설정</Link>
      </header>

      <div style={{ marginBottom: 16 }}>
        <NotificationSetup />
      </div>

      {connected !== undefined && (
        <section className="card" style={{ padding: 14, marginBottom: 16, background: "var(--primary-pale)", fontWeight: 700 }}>
          🎉 러닝엑스가 연결됐어요! 과제 {connected}개를 가져왔어요.
        </section>
      )}

      {syncError && syncError !== "TOKEN_INVALID" && (
        <section className="card" style={{ padding: 14, marginBottom: 16, background: "#fff8e8", color: "#8a5a00", fontWeight: 700 }}>
          러닝엑스 연결은 저장했지만 첫 동기화는 완료하지 못했어요. 잠시 후 &lsquo;지금 동기화&rsquo;를 눌러주세요.
        </section>
      )}

      {canvasSource?.status === "error" && (
        <section className="card" style={{ padding: 14, marginBottom: 16, background: "#fff0f0", color: "#b42318", fontWeight: 700 }}>
          러닝엑스 연결이 끊겼어요. <Link href="/connect/learnx" style={{ color: "#b42318", textDecoration: "underline" }}>다시 연결하기</Link>
        </section>
      )}

      {canvasSource?.status === "active" && canvasSource.last_sync_error && (
        <section className="card" style={{ padding: 14, marginBottom: 16, background: "#fff8e8", color: "#8a5a00", fontWeight: 700 }}>
          최근 러닝엑스 동기화가 일시적으로 실패했어요. 기존 일정은 그대로 유지됩니다.
        </section>
      )}

      <section className="mascot-card" style={{ marginBottom: 24, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Image src={heroImg} alt="" width={90} height={90} style={{ height: 80, width: "auto" }} />
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 17 }}>{heroMessage}</p>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>알다마 펭귄이 마감을 지켜보고 있어요.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!canvasSource && <Link href="/connect/learnx" className="button button-primary">🔗 러닝엑스 연결</Link>}
          <Link href="/dashboard?add=choose" className="button button-accent">+ 계획 추가하기!</Link>
        </div>
      </section>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Link href="/dashboard?view=calendar" className={`button ${view === "calendar" ? "button-primary" : "button-muted"}`}>📅 캘린더</Link>
        <Link href="/dashboard?view=list" className={`button ${view === "list" ? "button-primary" : "button-muted"}`}>📋 할 일 목록</Link>
        <LearnXSync
          lastSyncedAt={canvasSource?.last_synced_at ?? null}
          syncedLabel={buildSyncedLabel(canvasSource?.last_synced_at ?? null)}
          active={canvasSource?.status === "active"}
        />
      </div>

      {view === "calendar" && (() => {
        const { y, mo, cells } = monthGrid(ym);
        const byDay: Record<string, string[]> = {};
        for (const event of events) {
          if (!event.due_at) continue;
          const key = kstDay(event.due_at);
          (byDay[key] ??= []).push(typeLabels[event.event_type]);
        }
        return (
          <section className="card" style={{ padding: 18, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, marginBottom: 12 }}>
              <Link href={`/dashboard?view=calendar&m=${shiftMonth(ym, -1)}`} className="button button-muted" style={{ minHeight: 32, padding: "0 10px" }}>←</Link>
              <strong style={{ fontSize: 17 }}>{y}년 {mo}월</strong>
              <Link href={`/dashboard?view=calendar&m=${shiftMonth(ym, 1)}`} className="button button-muted" style={{ minHeight: 32, padding: "0 10px" }}>→</Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
                <div key={d} className="muted" style={{ textAlign: "center", fontSize: 12, fontWeight: 700 }}>{d}</div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`e${i}`} />;
                const dayStr = `${ym}-${String(day).padStart(2, "0")}`;
                const chips = byDay[dayStr] ?? [];
                const isToday = dayStr === todayStr;
                const isSelected = dayStr === dateParam;
                const href = chips.length > 0
                  ? `/dashboard?view=calendar&m=${ym}&date=${dayStr}`
                  : `/dashboard?view=calendar&m=${ym}&add=direct&date=${dayStr}`;
                return (
                  <Link key={dayStr} href={href} style={{
                    minHeight: 58, borderRadius: 10, padding: 4, display: "grid", alignContent: "start", gap: 2,
                    background: isToday ? "var(--primary-pale)" : "transparent",
                    border: isSelected ? "2px solid var(--primary-deep)" : "1px solid transparent",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, textAlign: "center", color: isToday ? "var(--primary-deep)" : "inherit" }}>{day}</span>
                    {chips.slice(0, 2).map((label, j) => (
                      <span key={j} style={{ fontSize: 10, fontWeight: 700, background: "var(--primary-pale)", color: "var(--primary-deep)", borderRadius: 6, padding: "1px 3px", textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>{label}</span>
                    ))}
                    {chips.length > 2 && <span className="muted" style={{ fontSize: 10, textAlign: "center" }}>+{chips.length - 2}</span>}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })()}

      {dateParam && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <strong>{Number(dateParam.slice(5, 7))}월 {Number(dateParam.slice(8, 10))}일 일정</strong>
          <Link href={`/dashboard?view=${view}`} className="muted" style={{ fontSize: 13 }}>전체 보기 ✕</Link>
        </div>
      )}

      {addMode === "choose" && (
        <section className="card" style={{ padding: 20, marginBottom: 24, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>어떻게 추가할까요?</p>
          <Link href="/dashboard?add=text" className="button button-primary">📋 공지 텍스트로</Link>
          <Link href="/dashboard?add=direct" className="button button-muted">✍️ 직접 입력</Link>
          <Link href="/dashboard" className="muted" style={{ fontSize: 13, marginLeft: "auto" }}>취소</Link>
        </section>
      )}

      {addMode === "text" && (
        <section className="card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ marginTop: 0 }}>공지 텍스트로 추가</h2>
            <Link href="/dashboard" className="muted" style={{ fontSize: 13 }}>닫기 ✕</Link>
          </div>
          <p className="muted" style={{ marginTop: -8 }}>카톡, 학교 공지, 이메일 내용을 복사해서 붙여넣으면 날짜/할 일을 자동으로 찾아드려요.</p>
          <div style={{ marginBottom: 14 }}>
            <ClipboardAnalyzeButton />
          </div>
          <form action="/share" method="GET" style={{ display: "grid", gap: 12 }}>
            <label className="label">
              공지 내용
              <textarea className="field" name="text" rows={4} placeholder="예: 7월 12일 23:59까지 보고서 제출해주세요." required />
            </label>
            <button className="button button-primary" type="submit" style={{ justifySelf: "start" }}>분석하기</button>
          </form>
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 16 }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 14, color: "#33463f" }}>또는 스크린샷·사진으로</p>
            {errorMsg && (
              <p style={{ color: "#b42318", background: "#fff0f0", padding: 12, borderRadius: 10 }}>{errorMsg}</p>
            )}
            <form action={analyzeNoticeImage} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input className="field" type="file" name="image" accept="image/*" required style={{ maxWidth: 340 }} />
              <button className="button button-primary">🖼️ 이미지 분석하기</button>
            </form>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>카톡 대화 캡처, 공지 사진 등을 올리면 글자를 읽어서 분석해요. (7MB 이하)</p>
          </div>
        </section>
      )}

      {addMode === "direct" && (
        <section className="card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ marginTop: 0 }}>일정 직접 추가</h2>
            <Link href="/dashboard" className="muted" style={{ fontSize: 13 }}>닫기 ✕</Link>
          </div>
          <form action={createEvent} style={{ display: "grid", gridTemplateColumns: "minmax(130px, 1fr) minmax(150px, 1.5fr) minmax(90px, 0.8fr) minmax(180px, 1fr) auto", gap: 12, alignItems: "end" }}>
            <label className="label">과목(작업)<input className="field" name="subject" placeholder="예: 컴퓨터 프로그래밍" /></label>
            <label className="label">제목<input className="field" name="title" placeholder="예: 보고서 제출" required /></label>
            <label className="label">유형<select className="field" name="event_type" defaultValue="assignment">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="label">마감<input className="field" name="due_at" type="datetime-local" defaultValue={dateParam ? `${dateParam}T23:59` : undefined} required /></label>
            <button className="button button-primary">추가</button>
          </form>
        </section>
      )}

      <section style={{ display: "grid", gap: 12 }}>
        {(dateParam ? events.filter((event) => event.due_at && kstDay(event.due_at) === dateParam) : events).length === 0 && (
          <div className="card muted" style={{ padding: 36, textAlign: "center" }}>
            {dateParam ? "이 날짜에는 일정이 없어요." : "아직 일정이 없습니다. 첫 일정을 추가해보세요."}
          </div>
        )}
        {(dateParam ? events.filter((event) => event.due_at && kstDay(event.due_at) === dateParam) : events).map((event) => {
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

          if (editId === event.id) {
            return (
              <article key={event.id} className="card" style={{ padding: 14, display: "grid", gridTemplateColumns: "96px 1fr", alignItems: "stretch", gap: 16 }}>
                <div style={{ background: "var(--primary-pale)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
                  <Image src="/mascot/reading.png" alt="" width={80} height={80} style={{ maxHeight: 76, width: "auto", maxWidth: 80 }} />
                </div>
                <form action={updateEvent} style={{ display: "grid", gap: 10, alignContent: "center" }}>
                  <input type="hidden" name="id" value={event.id} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10 }}>
                    <label className="label">과목(작업)<input className="field" name="subject" defaultValue={event.subject ?? ""} placeholder="예: 컴퓨터 프로그래밍" /></label>
                    <label className="label">제목<input className="field" name="title" defaultValue={event.title} required /></label>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10 }}>
                    <label className="label">유형<select className="field" name="event_type" defaultValue={event.event_type}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label className="label">마감<input className="field" name="due_at" type="datetime-local" defaultValue={toKstInputValue(event.due_at)} /></label>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="button button-primary">저장</button>
                    <Link href="/dashboard" className="button button-muted">취소</Link>
                  </div>
                </form>
              </article>
            );
          }

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
                {event.subject && (
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--primary-deep)" }}>
                    {event.subject}
                    {canvasSource && event.source_id === canvasSource.id && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, background: "var(--primary-pale)", color: "var(--primary-deep)", borderRadius: 6, padding: "1px 6px" }}>러닝엑스</span>
                    )}
                  </p>
                )}
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
                  <Link href={`/dashboard?edit=${event.id}`} className="button button-muted">수정</Link>
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
