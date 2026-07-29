// 마감 알림 4단계: 남은 시간에 따라 카드가 어느 단계 알림을 받아야 하는지 계산한다.
// DB의 events.reminder_stage(0~4)와 비교해서 "계산된 단계 > 기록된 단계"일 때만 발송.
// 이렇게 하면 함수 실행이 밀려도 중복 없이 최신 단계 하나만 나간다.

const HOUR_MS = 60 * 60 * 1000;

// [단계, 남은 시간(시간)] — 큰 단계부터 검사한다
const STAGES: Array<[stage: number, withinHours: number]> = [
  [4, 1],
  [3, 3],
  [2, 6],
  [1, 24],
];

export const MAX_REMINDER_STAGE = 4;
export const REMINDER_WINDOW_HOURS = 24;

export function computeReminderStage(dueAt: string | null, now: Date): number {
  if (!dueAt) return 0;
  const diff = new Date(dueAt).getTime() - now.getTime();
  if (diff < 0) return 0; // 이미 지난 마감은 알림 의미 없음

  for (const [stage, withinHours] of STAGES) {
    if (diff <= withinHours * HOUR_MS) return stage;
  }
  return 0;
}

export function stageLabel(stage: number): string {
  switch (stage) {
    case 1: return "🗓️ 마감이 하루 앞으로!";
    case 2: return "⏰ 마감 6시간 전!";
    case 3: return "⏰ 마감 3시간 전!";
    case 4: return "🚨 마감 1시간 전!";
    default: return "갈피 알림";
  }
}
