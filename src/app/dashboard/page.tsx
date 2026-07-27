import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/AppNav";
import { EmptyState, StatusAlert } from "@/app/components/States";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { getUrgency } from "@/lib/urgency";
import { toKstInputValue } from "@/lib/datetime";
import { analyzeNoticeImage, createEvent, deleteEvent, restoreLearnXOriginal, updateEvent } from "./actions";
import { ClipboardAnalyzeButton } from "./ClipboardAnalyzeButton";
import { CompleteButton } from "./CompleteButton";
import { NotificationSetup } from "./NotificationSetup";
import LearnXSync from "./LearnXSync";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

const kstDay = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(iso));
const eventCalendarTime = (event: { starts_at: string | null; due_at: string | null }) => event.starts_at ?? event.due_at;
const formatKstDateTime = (iso: string) => new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
}).format(new Date(iso));

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

function buildHero(events: EventRow[]) {
  const now = Date.now();
  const active = events.filter((event) => !event.is_completed);
  const overdueCount = active.filter((event) => event.due_at && new Date(event.due_at).getTime() < now).length;
  const urgentCount = active.filter((event) => {
    if (!event.due_at) return false;
    const remaining = new Date(event.due_at).getTime() - now;
    return remaining >= 0 && remaining <= 24 * 60 * 60 * 1000;
  }).length;

  if (overdueCount > 0) {
    return {
      heroImg: "/mascot/overdue-run-v2.png",
      heroMessage: `마감이 지난 일정이 ${overdueCount}개 있어요`,
      heroDescription: "가장 급한 일정부터 확인해볼까요?",
    };
  }
  if (urgentCount > 0) {
    return {
      heroImg: "/mascot/urgent-run.png",
      heroMessage: `24시간 안에 마감 ${urgentCount}개`,
      heroDescription: "지금 확인하면 충분히 끝낼 수 있어요.",
    };
  }
  if (active.length > 0) {
    return {
      heroImg: "/mascot/neutral.png",
      heroMessage: `남은 일정 ${active.length}개`,
      heroDescription: "오늘도 차근차근 진행해봐요.",
    };
  }
  return {
    heroImg: "/mascot/neutral.png",
    heroMessage: "오늘은 여유로운 하루예요",
    heroDescription: "새 공지가 있다면 일정으로 정리해보세요.",
  };
}

function buildSyncedLabel(lastSyncedAt: string | null): string | null {
  if (!lastSyncedAt) return null;
  const minutes = Math.max(0, Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 60000));
  return `러닝엑스 · ${minutes}분 전 동기화`;
}

const typeLabels: Record<string, string> = {
  assignment: "과제",
  exam: "시험",
  presentation: "발표",
  application: "신청",
  event: "행사",
  other: "기타",
};

function EventEditor({ event, isCanvasEvent }: { event: EventRow; isCanvasEvent: boolean }) {
  return (
    <article className="event-card event-card--editing">
      <div className="event-card__edit-heading">
        <span className="badge badge--mint">일정 수정</span>
        <strong>{event.title}</strong>
      </div>
      <form action={updateEvent} className="form-stack">
        <input type="hidden" name="id" value={event.id} />
        <div className="form-grid">
          <label className="label">과목(작업)<input className="field" name="subject" defaultValue={event.subject ?? ""} placeholder="예: 컴퓨터 프로그래밍" /></label>
          <label className="label">제목<input className="field" name="title" defaultValue={event.title} required /></label>
          <label className="label">유형<select className="field" name="event_type" defaultValue={event.event_type}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="label">시작<input className="field" name="starts_at" type="datetime-local" defaultValue={toKstInputValue(event.starts_at)} /></label>
          <label className="label">마감<input className="field" name="due_at" type="datetime-local" defaultValue={toKstInputValue(event.due_at)} /></label>
        </div>
        <div className="form-actions">
          <button className="button button-primary">저장</button>
          <Link href="/dashboard" className="button button-muted">취소</Link>
        </div>
        {isCanvasEvent && <p className="field-help">여기서 바꾼 값은 다음 러닝엑스 동기화에서도 유지됩니다.</p>}
      </form>
    </article>
  );
}

function EventCard({
  event,
  editId,
  canvasSourceId,
}: {
  event: EventRow;
  editId?: string;
  canvasSourceId?: string;
}) {
  const urgency = event.is_completed
    ? { level: "none" as const, label: "완료", background: "#f3f4f6", color: "#58645f", fontWeight: 700 }
    : getUrgency(event.due_at);
  const isCanvasEvent = Boolean(canvasSourceId && event.source_id === canvasSourceId && event.external_uid?.startsWith("canvas:"));
  const hasOverrides = isCanvasEvent && (event.override_fields?.length ?? 0) > 0;

  if (editId === event.id) return <EventEditor event={event} isCanvasEvent={isCanvasEvent} />;

  return (
    <article className={`event-card event-card--${urgency.level} ${event.is_completed ? "event-card--completed" : ""}`}>
      <div className="event-card__rail" aria-hidden="true" />
      <div className="event-card__body">
        <div className="event-card__topline">
          <span className={`badge urgency-badge badge--${urgency.level}`}>{urgency.label}</span>
          <span className="badge badge--neutral">{typeLabels[event.event_type]}</span>
        </div>
        <h3>{event.title}</h3>
        {event.subject && (
          <p className="event-card__subject">
            {event.subject}
            {isCanvasEvent && <span className="source-tag">러닝엑스</span>}
            {hasOverrides && <span className="source-tag source-tag--warning">사용자 수정됨</span>}
          </p>
        )}
        <p className="event-card__date">
          {event.starts_at && <span>시작 {formatKstDateTime(event.starts_at)}</span>}
          <span>{event.due_at ? `마감 ${formatKstDateTime(event.due_at)}` : "마감 없음"}</span>
        </p>
      </div>
      <div className="event-card__controls">
        <CompleteButton id={event.id} title={event.title} isCompleted={event.is_completed} />
        <details className="action-menu">
          <summary aria-label={`${event.title} 작업 더보기`}>•••</summary>
          <div className="action-menu__panel">
            <Link href={`/dashboard?edit=${event.id}`} className="button button-muted">수정</Link>
            {hasOverrides && (
              <form action={restoreLearnXOriginal}>
                <input type="hidden" name="id" value={event.id} />
                <button className="button button-muted">원본으로 되돌리기</button>
              </form>
            )}
            <form action={deleteEvent}>
              <input type="hidden" name="id" value={event.id} />
              <button className="button button-danger">삭제</button>
            </form>
          </div>
        </details>
      </div>
    </article>
  );
}

function EventList({
  events,
  editId,
  canvasSourceId,
}: {
  events: EventRow[];
  editId?: string;
  canvasSourceId?: string;
}) {
  return (
    <div className="event-list">
      {events.map((event) => <EventCard key={event.id} event={event} editId={editId} canvasSourceId={canvasSourceId} />)}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ edit?: string; add?: string; error?: string; view?: string; date?: string; m?: string; connected?: string; syncError?: string; restored?: string; restoreError?: string }> }) {
  const { edit: editId, add: addMode, error: errorMsg, view: viewParam, date: dateParam, m: mParam, connected, syncError, restored, restoreError } = await searchParams;
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
  const visibleEvents = dateParam
    ? events.filter((event) => {
        const calendarTime = eventCalendarTime(event);
        return calendarTime !== null && kstDay(calendarTime) === dateParam;
      })
    : events;

  const { data: canvasSource } = await supabase
    .from("sources")
    .select("id, status, last_synced_at, last_sync_error")
    .eq("type", "canvas")
    .maybeSingle();

  const { heroImg, heroMessage, heroDescription } = buildHero(events);
  const activeEvents = visibleEvents.filter((event) => !event.is_completed);
  const priorityEvents = activeEvents.filter((event) => ["overdue", "urgent", "today"].includes(getUrgency(event.due_at).level));
  const upcomingEvents = activeEvents.filter((event) => !priorityEvents.includes(event));
  const completedEvents = visibleEvents.filter((event) => event.is_completed);

  return (
    <>
      <a className="skip-link" href="#dashboard-main">본문으로 건너뛰기</a>
      <AppNav active={addMode ? "add" : view} />
      <main id="dashboard-main" tabIndex={-1} className="page-shell dashboard-shell">
        <header className="page-header">
          <div>
            <p className="page-header__eyebrow">ALDAMA</p>
            <h1>{view === "calendar" ? "캘린더" : "오늘의 일정"}</h1>
          </div>
          <div className="page-header__actions">
            <NotificationSetup />
            <Link href="/settings" className="button button-muted icon-button" aria-label="설정">
              <span aria-hidden="true">⚙</span>
            </Link>
          </div>
        </header>

        <div className="dashboard-alerts">
          {connected !== undefined && <StatusAlert tone="success">러닝엑스 연결 완료 · 일정 {connected}개를 가져왔어요.</StatusAlert>}
          {syncError && syncError !== "TOKEN_INVALID" && <StatusAlert tone="warning">첫 동기화를 완료하지 못했어요. 잠시 후 다시 시도해주세요.</StatusAlert>}
          {restored === "1" && <StatusAlert tone="success">러닝엑스 원본 값으로 되돌렸어요.</StatusAlert>}
          {restoreError === "1" && <StatusAlert tone="warning">원본 보호는 해제했지만 즉시 동기화하지 못했어요.</StatusAlert>}
          {canvasSource?.status === "error" && <StatusAlert tone="danger">러닝엑스 연결이 끊겼어요. <Link href="/connect/learnx" className="text-link">다시 연결하기</Link></StatusAlert>}
          {canvasSource?.status === "active" && canvasSource.last_sync_error && <StatusAlert tone="warning">최근 동기화가 일시적으로 실패했어요. 기존 일정은 유지됩니다.</StatusAlert>}
        </div>

        <section className="mascot-card dashboard-hero">
          <div className="mascot-card__image">
            <Image src={heroImg} alt="" width={90} height={90} priority />
          </div>
          <div className="mascot-card__copy">
            <strong>{heroMessage}</strong>
            <p>{heroDescription}</p>
          </div>
          {!canvasSource && <Link href="/connect/learnx" className="button button-primary dashboard-hero__action">러닝엑스 연결</Link>}
        </section>

        {canvasSource?.status === "active" && (
          <div className="sync-row">
            <LearnXSync
              lastSyncedAt={canvasSource.last_synced_at}
              syncedLabel={buildSyncedLabel(canvasSource.last_synced_at)}
              active
            />
          </div>
        )}

        {addMode === "choose" && (
          <section className="card add-panel">
            <div className="section-heading">
              <div><p className="eyebrow">새 일정</p><h2>어떻게 추가할까요?</h2></div>
              <Link href="/dashboard" className="button button-ghost icon-button" aria-label="일정 추가 닫기">×</Link>
            </div>
            <div className="add-choice-grid">
              <Link href="/dashboard?add=direct" className="add-choice"><span aria-hidden="true">✍</span><strong>직접 입력</strong><small>제목과 마감을 바로 입력해요</small></Link>
              <Link href="/dashboard?add=text" className="add-choice"><span aria-hidden="true">▤</span><strong>공지 분석</strong><small>텍스트나 이미지에서 찾아요</small></Link>
            </div>
          </section>
        )}

        {addMode === "text" && (
          <section className="card add-panel">
            <div className="section-heading">
              <div><p className="eyebrow">새 일정</p><h2>공지에서 일정 찾기</h2></div>
              <Link href="/dashboard" className="button button-ghost icon-button" aria-label="공지 분석 닫기">×</Link>
            </div>
            <p className="section-description">카톡, 학교 공지, 이메일 내용을 붙여넣으면 날짜와 할 일을 찾아드려요.</p>
            <ClipboardAnalyzeButton />
            <form action="/share" method="GET" className="form-stack">
              <label className="label">공지 내용<textarea className="field" name="text" rows={5} placeholder="예: 7월 12일 23:59까지 보고서 제출해주세요." required /></label>
              <button className="button button-primary button-block" type="submit">텍스트 분석하기</button>
            </form>
            <div className="form-divider"><span>또는 이미지로</span></div>
            {errorMsg && <StatusAlert tone="danger">{errorMsg}</StatusAlert>}
            <form action={analyzeNoticeImage} className="form-stack">
              <label className="label">공지 스크린샷·사진<input className="field" type="file" name="image" accept="image/*" required /></label>
              <button className="button button-muted button-block">이미지 분석하기</button>
              <p className="field-help">카톡 캡처나 공지 사진을 올릴 수 있어요. 최대 7MB입니다.</p>
            </form>
          </section>
        )}

        {addMode === "direct" && (
          <section className="card add-panel">
            <div className="section-heading">
              <div><p className="eyebrow">새 일정</p><h2>직접 입력</h2></div>
              <Link href="/dashboard" className="button button-ghost icon-button" aria-label="직접 입력 닫기">×</Link>
            </div>
            <form action={createEvent} className="form-stack">
              <div className="form-grid">
                <label className="label">과목(작업)<input className="field" name="subject" placeholder="예: 컴퓨터 프로그래밍" /></label>
                <label className="label">제목<input className="field" name="title" placeholder="예: 보고서 제출" required /></label>
                <label className="label">유형<select className="field" name="event_type" defaultValue="assignment">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="label">시작<input className="field" name="starts_at" type="datetime-local" defaultValue={dateParam ? `${dateParam}T09:00` : undefined} /></label>
                <label className="label">마감<input className="field" name="due_at" type="datetime-local" defaultValue={dateParam ? `${dateParam}T23:59` : undefined} required /></label>
              </div>
              <button className="button button-primary button-block">일정 저장</button>
            </form>
          </section>
        )}

        {view === "calendar" && (() => {
          const { y, mo, cells } = monthGrid(ym);
          const byDay: Record<string, EventRow[]> = {};
          for (const event of events) {
            const calendarTime = eventCalendarTime(event);
            if (!calendarTime) continue;
            const key = kstDay(calendarTime);
            (byDay[key] ??= []).push(event);
          }
          return (
            <section className="card calendar-card">
              <div className="calendar-card__header">
                <Link href={`/dashboard?view=calendar&m=${shiftMonth(ym, -1)}`} className="button button-muted icon-button" aria-label="이전 달">←</Link>
                <strong>{y}년 {mo}월</strong>
                <Link href={`/dashboard?view=calendar&m=${shiftMonth(ym, 1)}`} className="button button-muted icon-button" aria-label="다음 달">→</Link>
              </div>
              <div className="calendar-grid">
                {[
                  ["월", "월요일"], ["화", "화요일"], ["수", "수요일"], ["목", "목요일"], ["금", "금요일"], ["토", "토요일"], ["일", "일요일"],
                ].map(([short, full]) => <div key={short} className="calendar-grid__weekday" aria-label={full}>{short}</div>)}
                {cells.map((day, index) => {
                  if (day === null) return <div key={`empty-${index}`} />;
                  const dayStr = `${ym}-${String(day).padStart(2, "0")}`;
                  const dayEvents = byDay[dayStr] ?? [];
                  const isToday = dayStr === todayStr;
                  const isSelected = dayStr === dateParam;
                  const href = dayEvents.length > 0
                    ? `/dashboard?view=calendar&m=${ym}&date=${dayStr}`
                    : `/dashboard?view=calendar&m=${ym}&add=direct&date=${dayStr}`;
                  const hasUrgent = dayEvents.some((event) => ["overdue", "urgent", "today"].includes(getUrgency(event.due_at).level));
                  return (
                    <Link
                      key={dayStr}
                      href={href}
                      className={`calendar-day ${isToday ? "calendar-day--today" : ""} ${isSelected ? "calendar-day--selected" : ""}`}
                      aria-current={isSelected ? "page" : isToday ? "date" : undefined}
                      aria-label={`${mo}월 ${day}일${isToday ? ", 오늘" : ""}${isSelected ? ", 선택됨" : ""}${dayEvents.length ? `, 일정 ${dayEvents.length}개${hasUrgent ? ", 마감 임박 일정 있음" : ""}` : ", 일정 추가"}`}
                    >
                      <span>{day}</span>
                      {dayEvents.length > 0 && <span className={`calendar-day__dot ${hasUrgent ? "calendar-day__dot--urgent" : ""}`} aria-hidden="true" />}
                      {dayEvents.length > 1 && <small>{dayEvents.length}</small>}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {dateParam && (
          <div className="selected-date">
            <div><p className="eyebrow">선택한 날짜</p><strong>{Number(dateParam.slice(5, 7))}월 {Number(dateParam.slice(8, 10))}일 일정</strong></div>
            <Link href={`/dashboard?view=${view}`} className="button button-ghost">전체 보기</Link>
          </div>
        )}

        <div className="schedule-sections">
          {visibleEvents.length === 0 && (
            <EmptyState
              title={dateParam ? "이 날짜에는 일정이 없어요" : "아직 일정이 없어요"}
              description="하단의 추가 버튼을 눌러 첫 일정을 만들어보세요."
              action={<Link href="/dashboard?add=choose" className="button button-primary">일정 추가</Link>}
            />
          )}

          {priorityEvents.length > 0 && (
            <section aria-labelledby="priority-heading">
              <div className="section-heading section-heading--list"><div><p className="eyebrow">먼저 확인하세요</p><h2 id="priority-heading">마감 임박</h2></div><span className="count-badge">{priorityEvents.length}</span></div>
              <EventList events={priorityEvents} editId={editId} canvasSourceId={canvasSource?.id} />
            </section>
          )}

          {upcomingEvents.length > 0 && (
            <section aria-labelledby="upcoming-heading">
              <div className="section-heading section-heading--list"><h2 id="upcoming-heading">다가오는 일정</h2><span className="count-badge">{upcomingEvents.length}</span></div>
              <EventList events={upcomingEvents} editId={editId} canvasSourceId={canvasSource?.id} />
            </section>
          )}

          {completedEvents.length > 0 && (
            <details className="completed-section" open={Boolean(editId && completedEvents.some((event) => event.id === editId))}>
              <summary><span>완료한 일정</span><span className="count-badge">{completedEvents.length}</span></summary>
              <EventList events={completedEvents} editId={editId} canvasSourceId={canvasSource?.id} />
            </details>
          )}
        </div>
      </main>
    </>
  );
}
