// 일정 유형의 이름과 색을 한 곳에서 정한다.
//
// 예전에는 같은 목록이 page.tsx, EventFormFields.tsx, share/page.tsx 세 곳에 복사돼 있었다.
// 캘린더에 유형 점을 넣으면서 색까지 붙게 되어, 복사본이 늘면 한쪽만 고쳐 어긋날 위험이 커졌다.
//
// 점 색은 CSS(.calendar-day__dot--{유형})에 있고 여기서는 클래스 이름만 만든다.
// 색값을 CSS와 TS 양쪽에 적어두면 그것부터 어긋나기 때문이다.

import type { Database } from "./database.types";

export type EventType = Database["public"]["Tables"]["events"]["Row"]["event_type"];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  assignment: "과제",
  exam: "시험",
  presentation: "발표",
  application: "신청",
  event: "행사",
  other: "기타",
};

export const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS) as EventType[];

/** 캘린더 유형 점의 CSS 클래스. 모르는 값이 들어오면 기타로 떨어뜨린다 */
export function eventTypeDotClass(type: string): string {
  const known = (EVENT_TYPES as string[]).includes(type) ? type : "other";
  return `calendar-day__dot--${known}`;
}

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABELS[type as EventType] ?? EVENT_TYPE_LABELS.other;
}
