// 책갈피의 D 표시와, 선택한 날짜의 기준점 표시.
//
// D는 시각이 아니라 KST 달력 날짜로 센다. 오늘이면 D-day, 내일이면 D-1.
// 밀리초로 세면 오늘 밤 마감(10시간 남음)과 내일 아침 마감(20시간 남음)이
// 둘 다 D-1이 되어 오늘 것과 내일 것을 구분할 수 없다.
//
// 무엇까지 세는지는 시작 시각이 지났는지로 갈린다.
// - 시작 전: 시작까지 센다. 아직 손댈 수 없는 일에 마감 D를 보여주면 급한 척이 된다
// - 시작 후: 마감까지 센다. 이때부터 카드에 "진행중"이 붙는다
//
// 몇 시간 남았는지는 카드 상태 라벨("긴급! 10시간 남음")과 카드 배경색이 맡는다.
// 책갈피는 "며칠 남았나"만 답한다.

import { kstDayDiff } from "./schedule-sections";

export interface DeadlineLabelInput {
  starts_at?: string | null;
  due_at: string | null;
  is_completed: boolean;
}

/** 시작 시각이 아직 안 지났으면 "start", 그 뒤로는 "due" */
export function getCountdownTarget(event: DeadlineLabelInput, now: Date = new Date()): "start" | "due" {
  if (event.starts_at && now.getTime() < Date.parse(event.starts_at)) return "start";
  return "due";
}

export function getDeadlineLabel(event: DeadlineLabelInput, now: Date = new Date()): string {
  if (event.is_completed) return "완료";

  const iso = getCountdownTarget(event, now) === "start" ? event.starts_at : event.due_at;
  if (!iso) return "—";

  const diff = kstDayDiff(iso, now);
  if (diff < 0) return `D+${-diff}`;
  if (diff === 0) return "D-day";
  return `D-${diff}`;
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
