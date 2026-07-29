import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/AppNav";
import { EmptyState, StatusAlert } from "@/app/components/States";
import { AlertIcon, ArrowLeftIcon, CircleCheckIcon, MoreIcon, PlusIcon, SettingsIcon } from "@/app/components/UiIcons";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { getUrgency } from "@/lib/urgency";
import { getEventDdayBasis, getEventDdayLabel, getEventDdayTime, getEventUrgency } from "@/lib/event-time-basis";
import { buildDashboardReturnPath } from "@/lib/event-form";
import { normalizeRange, splitSchedule } from "@/lib/schedule-sections";
import { analyzeNoticeImage, completeAllOverdue, createEvent, deleteEvent, restoreLearnXOriginal, updateEvent } from "./actions";
import { AppBadge } from "./AppBadge";
import { ClipboardAnalyzeButton } from "./ClipboardAnalyzeButton";
import { CompleteButton } from "./CompleteButton";
import { NotificationSetup } from "./NotificationSetup";
import { SaveConfirm } from "./SaveConfirm";
import { UpcomingRangeFilter } from "./UpcomingRangeFilter";
import LearnXSync from "./LearnXSync";
import { EventFormFields } from "./EventFormFields";

/**
 * THESIS: /dashboard is a quiet wallet for deadlines, not a decorative planner.
 * OWN-WORLD: warm gray canvas, crisp white passes, charcoal controls, and bookmark status color.
 * STORY: scan urgent work first, act on one card, then continue through the remaining schedule.
 * FIRST VIEWPORT: compact title, dark status pass, horizontally scrollable priority cards, persistent bottom nav.
 * FORM: Quiet Wallet; native mobile scrolling and existing URLs/actions remain authoritative.
 */

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CalendarDayStatus = "overdue" | "due-soon" | "active" | "completed";

const calendarDayStatusLabels: Record<CalendarDayStatus, string> = {
  overdue: "기준 시간이 지난 일정 포함",
  "due-soon": "기준 시간이 3일 이내인 일정 포함",
  active: "진행 중 일정 있음",
  completed: "모든 일정 완료",
};

function getCalendarDayStatus(events: EventRow[]): CalendarDayStatus {
  const activeEvents = events.filter((event) => !event.is_completed);
  if (activeEvents.some((event) => getEventUrgency(event).level === "overdue")) return "overdue";
  if (activeEvents.some((event) => ["urgent", "today", "soon"].includes(getEventUrgency(event).level))) return "due-soon";
  if (activeEvents.length > 0) return "active";
  return "completed";
}

const kstDay = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(iso));
const eventCalendarTime = (event: { starts_at: string | null; due_at: string | null }) => event.starts_at ?? event.due_at;
const formatKstDateTime = (iso: string) => new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
}).format(new Date(iso));
const formatKstDayLabel = (day: string) => new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long",
  timeZone: "Asia/Seoul",
}).format(new Date(`${day}T12:00:00+09:00`));

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
  const overdueCount = active.filter((event) => {
    const referenceTime = getEventDdayTime(event);
    return referenceTime && new Date(referenceTime).getTime() < now;
  }).length;
  const urgentCount = active.filter((event) => {
    const referenceTime = getEventDdayTime(event);
    if (!referenceTime) return false;
    const remaining = new Date(referenceTime).getTime() - now;
    return remaining >= 0 && remaining <= 24 * 60 * 60 * 1000;
  }).length;

  if (overdueCount > 0) {
    return {
      heroMessage: `기준 시간이 지난 일정이 ${overdueCount}개 있어요`,
      heroDescription: "지금이라도 확인해볼까요?",
      badgeCount: urgentCount,
    };
  }
  if (urgentCount > 0) {
    return {
      heroMessage: `24시간 안에 마감 ${urgentCount}개`,
      heroDescription: "지금 확인하면 충분히 끝낼 수 있어요.",
      badgeCount: urgentCount,
    };
  }
  if (active.length > 0) {
    return {
      heroMessage: `남은 일정 ${active.length}개`,
      heroDescription: "오늘도 차근차근 진행해봐요.",
      badgeCount: urgentCount,
    };
  }
  return {
    heroMessage: "오늘은 여유로운 하루예요",
    heroDescription: "새 공지가 있다면 일정으로 정리해보세요.",
    badgeCount: urgentCount,
  };
}

function buildSyncedLabel(lastSyncedAt: string | null): string | null {
  if (!lastSyncedAt) return null;
  const minutes = Math.max(0, Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 60000));
  return `LearningX · ${minutes}분 전 동기화`;
}

function getEventStatusLabel(event: EventRow, urgencyLevel: ReturnType<typeof getUrgency>["level"]) {
  if (event.is_completed) return "완료";
  if (urgencyLevel === "overdue") return getEventDdayBasis(event) === "starts_at" ? "시작 지남" : "마감 지남";
  if (["urgent", "today"].includes(urgencyLevel)) return "24시간 이내";
  if (urgencyLevel === "soon") return "마감 임박";
  if (urgencyLevel === "none") return getEventDdayBasis(event) === "starts_at" ? "시작 없음" : "마감 없음";
  return "일반";
}

function addEditToDashboardPath(returnHref: string, eventId: string): string {
  return `${returnHref}${returnHref.includes("?") ? "&" : "?"}edit=${encodeURIComponent(eventId)}`;
}

function EventEditor({ event, isCanvasEvent, returnHref }: { event: EventRow; isCanvasEvent: boolean; returnHref: string }) {
  return (
    <article className="event-card event-card--editing" role="listitem">
      <div className="event-card__edit-heading">
        <span className="badge badge--mint">일정 수정</span>
        <strong>{event.title}</strong>
      </div>
      <form action={updateEvent} className="form-stack">
        <input type="hidden" name="id" value={event.id} />
        <input type="hidden" name="return_to" value={returnHref} />
        <EventFormFields event={event} />
        <div className="form-actions">
          <button className="button button-primary">저장</button>
          <Link href={returnHref} className="button button-muted">취소</Link>
        </div>
        {isCanvasEvent && <p className="field-help">여기서 바꾼 값은 다음 LearningX 동기화에서도 유지됩니다.</p>}
      </form>
    </article>
  );
}

function EventCard({
  event,
  editId,
  canvasSourceId,
  returnHref,
}: {
  event: EventRow;
  editId?: string;
  canvasSourceId?: string;
  returnHref: string;
}) {
  const urgency = event.is_completed
    ? { level: "none" as const, label: "완료", background: "#f3f4f6", color: "#58645f", fontWeight: 700 }
    : getEventUrgency(event);
  const isCanvasEvent = Boolean(canvasSourceId && event.source_id === canvasSourceId && event.external_uid?.startsWith("canvas:"));
  const hasOverrides = isCanvasEvent && (event.override_fields?.length ?? 0) > 0;
  const statusLabel = getEventStatusLabel(event, urgency.level);
  const bookmarkLabel = event.is_completed ? "완료" : getEventDdayLabel(event);

  if (editId === event.id) return <EventEditor event={event} isCanvasEvent={isCanvasEvent} returnHref={returnHref} />;

  return (
    <article className={`event-card event-card--${urgency.level} ${event.is_completed ? "event-card--completed" : ""}`} role="listitem">
      <span className="event-card__bookmark" aria-label={`D-day 표시 ${bookmarkLabel}`}>
        {bookmarkLabel}
      </span>
      <div className="event-card__body">
        <h3>{event.title}</h3>
        <span className={`event-card__status event-card__status--${urgency.level}`}>{statusLabel}</span>
        {event.subject && (
          <p className="event-card__subject">
            {event.subject}
            {isCanvasEvent && <span className="source-tag">LearningX</span>}
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
          <summary aria-label={`${event.title} 작업 더보기`}><MoreIcon /></summary>
          <div className="action-menu__panel">
            <Link href={addEditToDashboardPath(returnHref, event.id)} className="button button-muted">수정</Link>
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
  returnHref,
  variant = "stack",
}: {
  events: EventRow[];
  editId?: string;
  canvasSourceId?: string;
  returnHref: string;
  variant?: "stack" | "carousel";
}) {
  return (
    <div
      className={`event-list ${variant === "carousel" ? "event-list--carousel" : ""}`}
      role="list"
      tabIndex={variant === "carousel" && events.length > 1 ? 0 : undefined}
      aria-label={variant === "carousel" ? `마감 임박 일정 ${events.length}개` : undefined}
    >
      {events.map((event) => <EventCard key={event.id} event={event} editId={editId} canvasSourceId={canvasSourceId} returnHref={returnHref} />)}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ edit?: string; add?: string; error?: string; view?: string; date?: string; m?: string; range?: string; overdue?: string; saved?: string; connected?: string; syncError?: string; restored?: string; restoreError?: string }> }) {
  const { edit: editId, add: addMode, error: errorMsg, view: viewParam, date: dateParam, m: mParam, range: rangeParam, overdue: overdueParam, saved, connected, syncError, restored, restoreError } = await searchParams;
  const cookieStore = await cookies();
  const savedView = cookieStore.get("aldama_view")?.value;
  const view = viewParam === "calendar" || viewParam === "list" ? viewParam : savedView === "calendar" ? "calendar" : "list";
  const range = normalizeRange(rangeParam ?? cookieStore.get("aldama_range")?.value);
  const todayStr = kstDay(new Date().toISOString());
  const ym = /^\d{4}-\d{2}$/.test(mParam ?? "") ? mParam! : todayStr.slice(0, 7);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const { data } = await supabase.from("events").select("*").eq("is_hidden", false).order("is_completed");
  const events = [...(data ?? [])].sort((left, right) => {
    if (left.is_completed !== right.is_completed) return Number(left.is_completed) - Number(right.is_completed);
    const leftTime = getEventDdayTime(left);
    const rightTime = getEventDdayTime(right);
    if (leftTime === null) return rightTime === null ? 0 : 1;
    if (rightTime === null) return -1;
    return Date.parse(leftTime) - Date.parse(rightTime);
  });
  const selectedCalendarDate = view === "calendar"
    ? dateParam ?? (ym === todayStr.slice(0, 7) ? todayStr : null)
    : null;
  const eventFilterDate = view === "calendar" ? selectedCalendarDate : dateParam;
  const visibleEvents = eventFilterDate
    ? events.filter((event) => {
        const calendarTime = eventCalendarTime(event);
        return calendarTime !== null && kstDay(calendarTime) === eventFilterDate;
      })
    : events;

  const { data: canvasSource } = await supabase
    .from("sources")
    .select("id, status, last_synced_at, last_sync_error")
    .eq("type", "canvas")
    .maybeSingle();

  const { heroMessage, heroDescription, badgeCount } = buildHero(events);
  const { overdue: overdueEvents, priority: priorityEvents, upcoming: upcomingEvents, upcomingTotal } = splitSchedule(visibleEvents, range);
  const completedEvents = visibleEvents.filter((event) => event.is_completed);
  // 놓친 일정 패널: 히어로의 펼쳐보기를 눌렀거나, 놓친 일정을 수정하는 중이면 열어둔다
  const overdueOpen = overdueParam === "1" || Boolean(editId && overdueEvents.some((event) => event.id === editId));
  const dashboardReturnHref = buildDashboardReturnPath(view === "calendar"
    ? { view, month: ym, date: selectedCalendarDate ?? undefined }
    : { view, range, date: dateParam, overdue: overdueParam === "1" });

  return (
    <div className={`dashboard-page dashboard-page--${view}${addMode ? " dashboard-page--add" : ""}${addMode === "choose" ? " dashboard-page--add-choose" : ""}`}>
      <a className="skip-link" href="#dashboard-main">본문으로 건너뛰기</a>
      <AppNav active={addMode ? "add" : view} variant="wallet" />
      <main id="dashboard-main" tabIndex={-1} className="page-shell dashboard-shell">
        <AppBadge count={badgeCount} />
        <header className="page-header">
          <div>
            <h1 className={addMode ? undefined : "page-title--wordmark"}>{addMode ? "일정 추가" : "갈 피"}</h1>
          </div>
          <div className="page-header__actions">
            <NotificationSetup />
            <Link href="/settings" className="button button-muted icon-button" aria-label="설정">
              <SettingsIcon />
            </Link>
          </div>
        </header>

        {!addMode && view === "list" && <div className="dashboard-alerts">
          {saved === "1" && <StatusAlert tone="success">일정이 저장되었습니다!</StatusAlert>}
          {connected !== undefined && <StatusAlert tone="success">LearningX 연결 완료 · 일정 {connected}개를 가져왔어요.</StatusAlert>}
          {syncError && syncError !== "TOKEN_INVALID" && <StatusAlert tone="warning">첫 동기화를 완료하지 못했어요. 잠시 후 다시 시도해주세요.</StatusAlert>}
          {restored === "1" && <StatusAlert tone="success">LearningX 원본 값으로 되돌렸어요.</StatusAlert>}
          {restoreError === "1" && <StatusAlert tone="warning">원본 보호는 해제했지만 즉시 동기화하지 못했어요.</StatusAlert>}
          {canvasSource?.status === "error" && <StatusAlert tone="danger">LearningX 연결이 끊겼어요. <Link href="/connect/learnx" className="text-link">다시 연결하기</Link></StatusAlert>}
          {canvasSource?.status === "active" && canvasSource.last_sync_error && <StatusAlert tone="warning">최근 동기화가 일시적으로 실패했어요. 기존 일정은 유지됩니다.</StatusAlert>}
        </div>}

        {!addMode && view === "calendar" && saved === "1" && (
          <div className="dashboard-alerts">
            <StatusAlert tone="success">일정이 저장되었습니다!</StatusAlert>
          </div>
        )}

        {/* 놓친 일정이 있으면 경고 배너, 없으면 칭찬 배너 */}
        {!addMode && view === "list" && (overdueEvents.length > 0 ? (
          <section className="dashboard-hero" aria-label="일정 현황">
            <div className="dashboard-hero__icon" aria-hidden="true"><AlertIcon /></div>
            <div className="dashboard-hero__copy">
              <strong>{heroMessage}</strong>
              <p>{heroDescription}</p>
            </div>
            <Link
              href={overdueOpen ? "/dashboard" : "/dashboard?overdue=1"}
              className="dashboard-hero__expand"
              aria-expanded={overdueOpen}
            >
              {overdueOpen ? "접기" : "펼쳐보기"}
            </Link>
          </section>
        ) : (
          <section className="dashboard-hero dashboard-hero--calm" aria-label="일정 현황">
            <div className="dashboard-hero__icon" aria-hidden="true"><CircleCheckIcon /></div>
            <div className="dashboard-hero__copy">
              <strong>놓친 일정 0개</strong>
              <p>지금 페이스 그대로 가면 돼요</p>
            </div>
          </section>
        ))}

        {!addMode && view === "list" && overdueOpen && overdueEvents.length > 0 && (
          <section className="overdue-panel" aria-labelledby="overdue-heading">
            <div className="section-heading section-heading--list">
              <h2 id="overdue-heading">놓친 일정</h2>
              <form action={completeAllOverdue}>
                <button type="submit" className="button button-muted overdue-complete-all">전체 완료</button>
              </form>
            </div>
            <EventList events={overdueEvents} editId={editId} canvasSourceId={canvasSource?.id} returnHref={dashboardReturnHref} />
          </section>
        )}

        {!addMode && view === "list" && !canvasSource && (
          <div className="dashboard-connect-action">
            <Link href="/connect/learnx" className="button button-muted dashboard-connect-action__button">LearningX 연결</Link>
          </div>
        )}

        {!addMode && view === "list" && canvasSource?.status === "active" && (
          <div className="sync-row">
            <LearnXSync
              lastSyncedAt={canvasSource.last_synced_at}
              syncedLabel={buildSyncedLabel(canvasSource.last_synced_at)}
              active
            />
          </div>
        )}

        {addMode === "choose" && (
          <section className="card add-panel add-panel--choose">
            <div className="section-heading">
              <h2>어떻게 추가할까요?</h2>
            </div>
            <div className="add-choice-grid">
              <Link href="/dashboard?add=direct" className="add-choice"><span aria-hidden="true">✍</span><strong>직접 입력</strong><small>제목과 마감을 바로 입력해요</small></Link>
              <Link href="/dashboard?add=text" className="add-choice"><span aria-hidden="true">▤</span><strong>공지 분석</strong><small>텍스트나 이미지에서 찾아요</small></Link>
            </div>
          </section>
        )}

        {addMode === "text" && (
          <section className="card add-panel">
            <Link href="/dashboard?add=choose" className="add-back-link" aria-label="추가 방식 선택으로 돌아가기">
              <ArrowLeftIcon />
            </Link>
            <div className="section-heading">
              <h2>공지에서 일정 찾기</h2>
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

        {addMode === "direct" && saved && (
          <SaveConfirm key={saved} />
        )}

        {addMode === "direct" && (
          <section className="card add-panel">
            <Link href="/dashboard?add=choose" className="add-back-link" aria-label="추가 방식 선택으로 돌아가기">
              <ArrowLeftIcon />
            </Link>
            <div className="section-heading">
              <h2>직접 입력</h2>
            </div>
            <form action={createEvent} className="form-stack">
              <EventFormFields defaultDate={dateParam} />
              <button className="button button-primary button-block">일정 저장</button>
            </form>
          </section>
        )}

        {!addMode && view === "calendar" && (() => {
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
                  const isSelected = dayStr === selectedCalendarDate;
                  const href = `/dashboard?view=calendar&m=${ym}&date=${dayStr}`;
                  const dayStatus = dayEvents.length > 0 ? getCalendarDayStatus(dayEvents) : null;
                  return (
                    <Link
                      key={dayStr}
                      href={href}
                      className={`calendar-day ${isToday ? "calendar-day--today" : ""} ${isSelected ? "calendar-day--selected" : ""}`}
                      aria-current={isSelected ? "page" : isToday ? "date" : undefined}
                      aria-label={`${mo}월 ${day}일${isToday ? ", 오늘" : ""}${isSelected ? ", 선택됨" : ""}${dayEvents.length ? `, 일정 ${dayEvents.length}개, ${calendarDayStatusLabels[dayStatus!]}` : ", 일정 없음"}`}
                    >
                      <span className="calendar-day__number">{day}</span>
                      {dayStatus && (
                        <small className={`calendar-day__count calendar-day__count--${dayStatus}`} aria-hidden="true">
                          {dayEvents.length > 9 ? "9+" : dayEvents.length}
                        </small>
                      )}
                    </Link>
                  );
                })}
              </div>
              <div className="calendar-legend" aria-label="일정 상태 안내">
                <span><i className="calendar-legend__dot calendar-legend__dot--overdue" aria-hidden="true" />기준 시간 지남</span>
                <span><i className="calendar-legend__dot calendar-legend__dot--due-soon" aria-hidden="true" />기준 시간 3일 이내</span>
              </div>
            </section>
          );
        })()}

        {!addMode && view === "calendar" && selectedCalendarDate && (
          <div className="selected-date selected-date--calendar">
            <div>
              <strong>{formatKstDayLabel(selectedCalendarDate)}</strong>
              <span>일정 {visibleEvents.length}개</span>
            </div>
            <Link href={`/dashboard?add=direct&date=${selectedCalendarDate}`} className="button button-muted calendar-add-button">
              <PlusIcon />
              <span>추가</span>
            </Link>
          </div>
        )}

        {!addMode && view === "list" && dateParam && (
          <div className="selected-date">
            <div><p className="eyebrow">선택한 날짜</p><strong>{Number(dateParam.slice(5, 7))}월 {Number(dateParam.slice(8, 10))}일 일정</strong></div>
            <Link href={`/dashboard?view=${view}`} className="button button-ghost">전체 보기</Link>
          </div>
        )}

        {!addMode && view === "calendar" && (
          <section className="calendar-selected-events" aria-label="선택한 날짜의 일정" aria-live="polite">
            {!selectedCalendarDate ? (
              <div className="calendar-date-prompt">
                <strong>확인할 날짜를 선택하세요</strong>
                <p>날짜를 누르면 그날의 일정만 모아볼 수 있어요.</p>
              </div>
            ) : visibleEvents.length === 0 ? (
              <div className="calendar-day-empty">
                <strong>이 날짜에는 일정이 없어요</strong>
                <p>필요한 일정을 바로 추가할 수 있어요.</p>
                <Link href={`/dashboard?add=direct&date=${selectedCalendarDate}`} className="button button-primary">
                  <PlusIcon />
                  일정 추가
                </Link>
              </div>
            ) : (
              <EventList events={visibleEvents} editId={editId} canvasSourceId={canvasSource?.id} returnHref={dashboardReturnHref} />
            )}
          </section>
        )}

        {!addMode && view === "list" && <div className="schedule-sections">
          {visibleEvents.length === 0 && (
            <EmptyState
              title={dateParam ? "이 날짜에는 일정이 없어요" : "아직 일정이 없어요"}
              description="하단의 추가 버튼을 눌러 첫 일정을 만들어보세요."
              action={<Link href="/dashboard?add=choose" className="button button-primary">일정 추가</Link>}
            />
          )}

          {priorityEvents.length > 0 && (
            <section aria-labelledby="priority-heading">
              <div className="section-heading section-heading--list section-heading--priority">
                <h2 id="priority-heading">마감 임박</h2>
                <span className="count-badge">{priorityEvents.length}</span>
              </div>
              <EventList events={priorityEvents} editId={editId} canvasSourceId={canvasSource?.id} returnHref={dashboardReturnHref} variant="carousel" />
            </section>
          )}

          {upcomingTotal > 0 && (
            <section aria-labelledby="upcoming-heading">
              <div className="section-heading section-heading--list">
                <h2 id="upcoming-heading">다가오는 일정</h2>
                <UpcomingRangeFilter selected={range} />
              </div>
              {upcomingEvents.length > 0
                ? <EventList events={upcomingEvents} editId={editId} canvasSourceId={canvasSource?.id} returnHref={dashboardReturnHref} />
                : <p className="upcoming-empty">이 기간에는 일정이 없어요. 기간을 늘려보세요.</p>}
            </section>
          )}

          {completedEvents.length > 0 && (
            <details className="completed-section" open={Boolean(editId && completedEvents.some((event) => event.id === editId))}>
              <summary><span>완료한 일정</span><span className="count-badge">{completedEvents.length}</span></summary>
              <EventList events={completedEvents} editId={editId} canvasSourceId={canvasSource?.id} returnHref={dashboardReturnHref} />
            </details>
          )}
        </div>}
      </main>
    </div>
  );
}
