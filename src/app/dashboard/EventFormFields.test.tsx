import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventFormFields } from "./EventFormFields";

describe("EventFormFields", () => {
  it("수정 화면에서 저장된 시작 시간 기준을 체크 상태로 복원한다", () => {
    const html = renderToStaticMarkup(<EventFormFields event={{
      subject: "자료구조",
      event_type: "assignment",
      title: "중간고사",
      d_day_basis: "starts_at",
      starts_at: "2026-07-30T00:00:00.000Z",
      due_at: null,
    }} />);
    expect(html).toMatch(/name="use_start_time_for_d_day"[^>]*checked=""/);
  });

  it("제목만 required이고 마감 시간은 required가 아니다", () => {
    const html = renderToStaticMarkup(<EventFormFields />);
    expect(html).toMatch(/<input(?=[^>]*name="title")(?=[^>]*required="")[^>]*>/);
    expect(html).not.toMatch(/<input(?=[^>]*name="due_at")(?=[^>]*required)[^>]*>/);
  });

  it("시작 기준이 시작 후 마감 기준으로 자동 전환됨을 안내한다", () => {
    const html = renderToStaticMarkup(<EventFormFields />);
    expect(html).toContain("시작 전에는 시작 시간까지 계산");
    expect(html).toContain("시작 시간이 지나면 마감 시간 기준으로 자동 전환돼요.");
  });
});
