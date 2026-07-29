// 책갈피의 D 표시와, 선택한 날짜의 기준점 표시.
//
// D는 시각이 아니라 KST 달력 날짜로 센다. 오늘이면 D-day, 내일이면 D-1.
// 밀리초로 세면 오늘 밤 마감(10시간 남음)과 내일 아침 마감(20시간 남음)이
// 둘 다 D-1이 되어 오늘 것과 내일 것을 구분할 수 없다.
//
// 무엇까지 세는지는 일정에 저장된 기준과 시작 시각으로 갈린다.
// - 마감 기준: 항상 마감까지 센다
// - 시작 기준 + 시작 전: 시작까지 센다
// - 시작 기준 + 시작 후: 마감까지 센다. 이때부터 카드에 "진행중"이 붙는다
//
// 몇 시간 남았는지는 카드 상태 라벨("긴급! 10시간 남음")과 카드 배경색이 맡는다.
// 책갈피는 "며칠 남았나"만 답한다.

import { getEventDdayLabel, getEventDdayTarget, kstDayDiff, type EventWithTimeBasis } from "./event-time-basis";

export interface DeadlineLabelInput extends EventWithTimeBasis {
  is_completed: boolean;
}

/** 저장된 기준과 시작 전/후 전환을 반영해 카드가 현재 세는 지점을 반환한다. */
export function getCountdownTarget(event: DeadlineLabelInput, now: Date = new Date()): "start" | "due" {
  return getEventDdayTarget(event, now).basis === "starts_at" ? "start" : "due";
}

export function getDeadlineLabel(event: DeadlineLabelInput, now: Date = new Date()): string {
  if (event.is_completed) return "완료";
  return getEventDdayLabel(event, now);
}

/** 지금 진행 중인지. 시작 시각이 실제로 지났고 마감 전일 때만 참 */
export function isInProgress(event: DeadlineLabelInput, now: Date = new Date()): boolean {
  if (event.is_completed) return false;
  if (!event.starts_at) return false;

  const at = now.getTime();
  if (at < Date.parse(event.starts_at)) return false;
  if (event.due_at && at > Date.parse(event.due_at)) return false;
  return true;
}

/** 선택한 날짜가 오늘로부터 언제인지 */
export function getRelativeDayLabel(dayStr: string, now: Date = new Date()): string | null {
  const diff = kstDayDiff(`${dayStr}T12:00:00+09:00`, now);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === 2) return "모레";
  if (diff === -1) return "어제";
  if (diff > 0) return `${diff}일 뒤`;
  return `${-diff}일 전`;
}
