// 날짜 입력칸(datetime-local)과 DB(UTC ISO) 사이 변환.
// 서버가 어느 시간대에서 돌아도 한국 시간 기준으로 일관되게 동작하도록 한다.

/** "2026-07-30T15:00" (입력칸 값, KST 의미) → Date */
export function parseKstLocal(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value}:00+09:00`);
  }
  return new Date(value);
}

/** ISO 문자열 → 입력칸(datetime-local)에 넣을 KST 값 "2026-07-30T15:00" */
export function toKstInputValue(iso: string | null): string {
  if (!iso) return "";
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return formatted.replace(" ", "T");
}
