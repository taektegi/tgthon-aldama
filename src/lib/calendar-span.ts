// 캘린더에서 일정 하나가 날짜 칸들과 어떤 관계인지 정하는 규칙.
//
// 표시 하나가 질문 하나만 답하게 나눈다:
// - 제목 띠   → 어떤 일이 언제부터 언제까지인가 (시작·마감이 둘 다 있는 기간 일정)
// - 숫자 배지 → 이 날 끝내야 할 게 몇 개인가 (마감일과 하루짜리 일정)
//
// 그래서 기간 일정의 시작일과 중간 날은 배지에 세지 않는다.
// 3일짜리 하나가 3일 내내 "일정 1개"를 만들어 "3일 연속 마감"으로 오해되던 문제를 막는다.
//
// 시각(몇 시)은 보지 않고 KST 달력 날짜만 본다. Canvas due_at은 UTC ISO로 저장되므로
// 반드시 KST로 변환해서 비교해야 한다.

export type SpanRole =
  | "single" // 하루짜리 (시작만 있거나 마감만 있거나, 시작·마감이 같은 날)
  | "start" // 기간 일정의 첫날
  | "middle" // 기간 일정의 중간 날
  | "end"; // 기간 일정의 마지막 날

export interface SpanEvent {
  starts_at: string | null;
  due_at: string | null;
}

/** ISO 시각을 KST 달력 날짜 문자열(YYYY-MM-DD)로 */
export function kstDay(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(iso));
}

export function getDayRange(event: SpanEvent): { startDay: string; dueDay: string } | null {
  return dayRange(event);
}

function dayRange(event: SpanEvent): { startDay: string; dueDay: string } | null {
  const startDay = event.starts_at ? kstDay(event.starts_at) : null;
  const dueDay = event.due_at ? kstDay(event.due_at) : null;
  if (startDay && dueDay) {
    // 시작이 마감보다 뒤인 이상한 데이터는 하루짜리로 취급한다
    return startDay <= dueDay ? { startDay, dueDay } : { startDay: dueDay, dueDay };
  }
  const single = startDay ?? dueDay;
  if (!single) return null;
  return { startDay: single, dueDay: single };
}

/** 이 일정이 해당 날짜 칸에서 어떤 역할인지. 그 날에 없으면 null */
export function getSpanRole(event: SpanEvent, dayStr: string): SpanRole | null {
  const range = dayRange(event);
  if (!range) return null;
  const { startDay, dueDay } = range;
  if (dayStr < startDay || dayStr > dueDay) return null;
  if (startDay === dueDay) return "single";
  if (dayStr === startDay) return "start";
  if (dayStr === dueDay) return "end";
  return "middle";
}

/** 이 날짜 칸에 일정이 걸쳐 있는지 (선을 그릴지, 목록에 보일지) */
export function occupiesDay(event: SpanEvent, dayStr: string): boolean {
  return getSpanRole(event, dayStr) !== null;
}

/** 여러 날에 걸친 기간 일정인지 */
export function isMultiDay(event: SpanEvent): boolean {
  const range = dayRange(event);
  return range !== null && range.startDay !== range.dueDay;
}

/**
 * 이 날 개수 배지에 세야 하는 일정인지.
 *
 * 기간 일정은 제목이 적힌 띠로 보여주므로 시작일은 배지에서 뺀다. 마감일은 남긴다 —
 * 띠는 "언제부터 언제까지"를 말하고 배지는 "이 날 끝내야 할 게 몇 개"를 말하기 때문이다.
 */
export function countsInBadge(event: SpanEvent, dayStr: string): boolean {
  const role = getSpanRole(event, dayStr);
  return role === "single" || role === "end";
}

/** 이 날 마감되는지 (배지를 빨갛게 할지 판단할 때 쓴다) */
export function isDueOn(event: SpanEvent, dayStr: string): boolean {
  const role = getSpanRole(event, dayStr);
  if (role === null) return false;
  if (!event.due_at) return false;
  return role === "single" || role === "end";
}

/** 한 칸에 그릴 수 있는 띠의 최대 줄 수.
 *  띠 하나가 15px. 칸을 86px로 키워 세 줄까지 겹침 없이 들어간다.
 *  그보다 많이 겹치면 칸에 "+N"으로 알린다 */
export const MAX_SPAN_LANES = 3;

/**
 * 기간이 겹치는 일정들을 서로 다른 높이(줄)에 놓는다.
 * 7~18일 일정과 17~18일 일정이 같은 높이에 겹쳐 한 줄처럼 보이는 것을 막는다.
 *
 * 입력 순서 그대로 줄 번호를 돌려준다. 기간 일정이 아니면 -1.
 * 시작이 이른 것부터, 같으면 긴 것부터 아래 줄(0번)을 차지한다.
 */
export function assignSpanLanes(events: SpanEvent[]): number[] {
  const lanes: number[] = events.map(() => -1);
  const entries = events
    .map((event, index) => ({ index, range: dayRange(event) }))
    .filter((entry): entry is { index: number; range: { startDay: string; dueDay: string } } =>
      entry.range !== null && entry.range.startDay !== entry.range.dueDay,
    )
    .sort((a, b) =>
      a.range.startDay === b.range.startDay
        ? b.range.dueDay.localeCompare(a.range.dueDay)
        : a.range.startDay.localeCompare(b.range.startDay),
    );

  // laneEnds[i] = i번 줄에서 마지막으로 자리를 차지한 날. 그 날 이후여야 같은 줄에 들어갈 수 있다
  const laneEnds: string[] = [];
  for (const entry of entries) {
    let lane = laneEnds.findIndex((end) => end < entry.range.startDay);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(entry.range.dueDay);
    } else {
      laneEnds[lane] = entry.range.dueDay;
    }
    // 줄 번호는 자르지 않는다. 화면에 몇 줄까지 그릴지는 그리는 쪽이 정한다
    lanes[entry.index] = lane;
  }
  return lanes;
}

export interface WeekSegment {
  /** 입력 배열에서 몇 번째 일정인지 */
  eventIndex: number;
  lane: number;
  /** 이 주의 몇 번째 칸에서 시작하는지 (0~6) */
  startCol: number;
  /** 몇 칸을 덮는지 */
  span: number;
  /** 이 주에서 일정이 실제로 시작하는가 (왼쪽 끝을 둥글게) */
  opensHere: boolean;
  /** 이 주에서 일정이 실제로 끝나는가 (오른쪽 끝을 둥글게) */
  closesHere: boolean;
}

/**
 * 한 주(7칸)에 걸친 기간 일정을 띠 한 조각으로 자른다.
 *
 * 띠는 여러 칸을 덮는 하나의 요소라서 주 단위로 잘라야 한다. 주가 넘어가면
 * 다음 주에 새 조각이 생기고, 그 조각은 opensHere가 false라 왼쪽이 각지게 남는다.
 * 제목은 조각마다 다시 적는다 — 안 그러면 둘째 주에는 제목 없는 띠만 남는다.
 */
export function getWeekSegments(
  events: SpanEvent[],
  lanes: number[],
  weekDays: (string | null)[],
): WeekSegment[] {
  const segments: WeekSegment[] = [];
  events.forEach((event, eventIndex) => {
    let startCol = -1;
    let endCol = -1;
    weekDays.forEach((day, col) => {
      if (day === null || getSpanRole(event, day) === null) return;
      if (startCol === -1) startCol = col;
      endCol = col;
    });
    if (startCol === -1) return;
    segments.push({
      eventIndex,
      lane: lanes[eventIndex],
      startCol,
      span: endCol - startCol + 1,
      opensHere: getSpanRole(event, weekDays[startCol]!) === "start",
      closesHere: getSpanRole(event, weekDays[endCol]!) === "end",
    });
  });
  return segments.sort((a, b) => a.lane - b.lane);
}
