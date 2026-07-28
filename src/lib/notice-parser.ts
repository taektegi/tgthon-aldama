import type { Database } from "@/lib/database.types";

export type EventType = Database["public"]["Tables"]["events"]["Row"]["event_type"];

export interface NoticeCandidate {
  title: string;
  eventType: EventType;
  startsAt: string | null;
  dueAt: string | null;
  confidence: number;
  snippet: string;
}

const TYPE_KEYWORDS: Array<{ type: EventType; keywords: string[] }> = [
  { type: "assignment", keywords: ["제출", "마감", "까지"] },
  { type: "presentation", keywords: ["발표", "시연"] },
  { type: "application", keywords: ["신청", "접수"] },
  { type: "exam", keywords: ["시험", "퀴즈"] },
];

const DATE_WITH_YEAR = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const DATE_NO_YEAR = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const DATE_SLASH = /(\d{1,2})\s*[/.]\s*(\d{1,2})(?!\s*[/.:]\s*\d)/;
const TIME_24H = /(\d{1,2})\s*:\s*(\d{2})/;
const TIME_KOREAN = /(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/;

function detectEventType(segment: string): EventType {
  for (const { type, keywords } of TYPE_KEYWORDS) {
    if (keywords.some((keyword) => segment.includes(keyword))) return type;
  }
  return "other";
}

function extractDatePart(segment: string): { year?: number; month: number; day: number } | null {
  const withYear = segment.match(DATE_WITH_YEAR);
  if (withYear) return { year: Number(withYear[1]), month: Number(withYear[2]), day: Number(withYear[3]) };

  const noYear = segment.match(DATE_NO_YEAR);
  if (noYear) return { month: Number(noYear[1]), day: Number(noYear[2]) };

  const slash = segment.match(DATE_SLASH);
  if (slash) return { month: Number(slash[1]), day: Number(slash[2]) };

  return null;
}

function extractTimePart(segment: string): { hour: number; minute: number } | null {
  const time24 = segment.match(TIME_24H);
  if (time24) return { hour: Number(time24[1]), minute: Number(time24[2]) };

  const korean = segment.match(TIME_KOREAN);
  if (korean) {
    let hour = Number(korean[2]);
    const minute = korean[3] ? Number(korean[3]) : 0;
    if (korean[1] === "오후" && hour < 12) hour += 12;
    if (korean[1] === "오전" && hour === 12) hour = 0;
    return { hour, minute };
  }

  return null;
}

function buildDueAt(datePart: { year?: number; month: number; day: number }, timePart: { hour: number; minute: number } | null, now: Date): Date | null {
  if (datePart.month < 1 || datePart.month > 12 || datePart.day < 1 || datePart.day > 31) return null;

  const hour = timePart?.hour ?? 23;
  const minute = timePart?.minute ?? 59;
  let year = datePart.year ?? now.getFullYear();

  let candidate = new Date(year, datePart.month - 1, datePart.day, hour, minute);

  if (!datePart.year) {
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    if (candidate < threeDaysAgo) {
      year += 1;
      candidate = new Date(year, datePart.month - 1, datePart.day, hour, minute);
    }
  }

  return candidate;
}

function splitSegments(text: string): string[] {
  return text
    .split(/\r?\n+|(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function buildTitle(segment: string, eventType: EventType): string {
  const cleaned = segment.replace(/\s+/g, " ").trim();
  if (cleaned.length > 0 && cleaned.length <= 40) return cleaned;
  if (cleaned.length > 40) return `${cleaned.slice(0, 40)}…`;

  const fallback: Record<EventType, string> = {
    assignment: "과제 제출",
    presentation: "발표",
    application: "신청 마감",
    exam: "시험/퀴즈",
    event: "행사",
    other: "할 일",
  };
  return fallback[eventType];
}

export function parseNoticeText(rawText: string, now: Date = new Date()): NoticeCandidate[] {
  const segments = splitSegments(rawText);
  const candidates: NoticeCandidate[] = [];

  for (const segment of segments) {
    const datePart = extractDatePart(segment);
    if (!datePart) continue;

    const timePart = extractTimePart(segment);
    const dueAt = buildDueAt(datePart, timePart, now);
    if (!dueAt) continue;

    const eventType = detectEventType(segment);

    let confidence = 0.5;
    if (eventType !== "other") confidence += 0.25;
    if (timePart) confidence += 0.15;
    if (datePart.year) confidence += 0.1;
    confidence = Math.min(confidence, 0.95);

    candidates.push({
      title: buildTitle(segment, eventType),
      eventType,
      startsAt: null, // 기본(regex) 분석은 시작 시각까지는 구분하지 못한다
      dueAt: dueAt.toISOString(),
      confidence,
      snippet: segment,
    });
  }

  return candidates;
}
