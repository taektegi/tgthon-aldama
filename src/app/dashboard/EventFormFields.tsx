import type { Database } from "@/lib/database.types";
import { toKstInputValue } from "@/lib/datetime";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventFormValue = Pick<EventRow, "subject" | "event_type" | "title" | "d_day_basis" | "starts_at" | "due_at">;

const typeLabels: Record<EventRow["event_type"], string> = {
  assignment: "과제",
  exam: "시험",
  presentation: "발표",
  application: "신청",
  event: "행사",
  other: "기타",
};

export function EventFormFields({ event, defaultDate }: { event?: EventFormValue; defaultDate?: string }) {
  return (
    <div className="form-grid">
      <div className="subject-type-row form-grid__full">
        <label className="label">과목(작업)<input className="field" name="subject" defaultValue={event?.subject ?? ""} placeholder="예: 컴퓨터 프로그래밍" /></label>
        <label className="label">유형<select className="field" name="event_type" defaultValue={event?.event_type ?? "assignment"}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <label className="label form-grid__full">제목<input className="field" name="title" defaultValue={event?.title ?? ""} placeholder="예: 보고서 제출" required /></label>
      <div className="time-basis-control form-grid__full">
        <p>D-day와 카드 색상은 선택한 기준 시간까지 남은 시간으로 계산돼요.</p>
        <label><input name="use_start_time_for_d_day" type="checkbox" defaultChecked={event?.d_day_basis === "starts_at"} />시작 시간을 D-day 기준으로 사용</label>
      </div>
      <div className="time-fields form-grid__full">
        <label className="label">시작<input className="field" name="starts_at" type="datetime-local" defaultValue={event ? toKstInputValue(event.starts_at) : defaultDate ? `${defaultDate}T09:00` : undefined} /></label>
        <label className="label">마감<input className="field" name="due_at" type="datetime-local" defaultValue={event ? toKstInputValue(event.due_at) : defaultDate ? `${defaultDate}T23:59` : undefined} /></label>
      </div>
    </div>
  );
}
