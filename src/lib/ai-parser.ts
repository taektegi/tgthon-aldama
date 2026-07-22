import { z } from "zod";
import { parseNoticeText, type NoticeCandidate } from "@/lib/notice-parser";

const EVENT_TYPES = ["assignment", "exam", "presentation", "application", "event", "other"] as const;

const aiCandidateSchema = z.object({
  title: z.string().trim().min(1).max(80),
  event_type: z.enum(EVENT_TYPES),
  due_at: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  snippet: z.string().min(1).max(600),
});

export interface ParseResult {
  candidates: NoticeCandidate[];
  engine: "ai" | "regex";
}

function buildPrompt(rawText: string, now: Date): string {
  const nowKst = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(now);

  return `당신은 대학생을 위한 일정 관리 앱의 공지 분석기입니다.
아래 공지 텍스트에서 학생이 실제로 해야 할 행동(할 일)을 모두 추출하세요.

현재 시각: ${nowKst} (한국 시간, Asia/Seoul)

규칙:
- 각 할 일마다: title(간결한 한국어, 예: "보고서 제출"), event_type, due_at, confidence, snippet을 만드세요.
- event_type: assignment(제출/과제), exam(시험/퀴즈), presentation(발표/시연), application(신청/접수), event(행사/참석), other(기타) 중 하나.
- due_at: 마감 일시를 ISO 8601 형식(+09:00 포함, 예: 2026-07-12T23:59:00+09:00)으로. "다음 주 금요일" 같은 상대 표현은 현재 시각 기준으로 계산. 시간이 없으면 23:59로. 날짜가 전혀 없으면 null.
- 날짜가 없어도 해야 할 일이면 추출하세요 (예: "발표자료도 준비해주세요"). 이 경우 due_at은 null, confidence는 낮게.
- confidence: 추출 확신도 0~1. 날짜와 행동이 명확하면 높게.
- snippet: 근거가 된 원문 문장 그대로.
- 같은 할 일을 중복 생성하지 마세요. 인사말/서명 등 할 일이 아닌 내용은 무시하세요.

공지 텍스트:
"""
${rawText}
"""`;
}

async function callGemini(rawText: string, now: Date): Promise<NoticeCandidate[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(rawText, now) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                event_type: { type: "STRING", enum: [...EVENT_TYPES] },
                due_at: { type: "STRING", nullable: true },
                confidence: { type: "NUMBER" },
                snippet: { type: "STRING" },
              },
              required: ["title", "event_type", "due_at", "confidence", "snippet"],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("Gemini response has no text");

  const parsed = z.array(aiCandidateSchema).parse(JSON.parse(text));

  return parsed.slice(0, 10).map((item) => ({
    title: item.title,
    eventType: item.event_type,
    dueAt: item.due_at && !Number.isNaN(Date.parse(item.due_at)) ? new Date(item.due_at).toISOString() : null,
    confidence: Math.min(Math.max(item.confidence, 0), 0.99),
    snippet: item.snippet,
  }));
}

/** 공지 스크린샷/사진 → 이미지 속 텍스트를 그대로 옮겨 적기 */
export async function transcribeNoticeImage(base64Data: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: base64Data } },
              {
                text: "이 이미지는 대학교 공지(카톡 대화, LMS 공지, 이메일 등) 캡처입니다. 이미지에 보이는 본문 텍스트를 빠짐없이 그대로 옮겨 적으세요. 앱 UI 요소(시간표시, 버튼 이름, 상태바 등)는 제외하고, 공지 내용만 적으세요. 설명 없이 텍스트만 출력하세요.",
              },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim().length === 0) throw new Error("이미지에서 텍스트를 찾지 못했어요");
  return text.trim();
}

export async function parseNotice(rawText: string, now: Date = new Date()): Promise<ParseResult> {
  try {
    const candidates = await callGemini(rawText, now);
    if (candidates.length > 0) return { candidates, engine: "ai" };
  } catch (error) {
    console.error("AI 분석 실패, 기본 분석으로 대체:", error);
  }
  return { candidates: parseNoticeText(rawText, now), engine: "regex" };
}
