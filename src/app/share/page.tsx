import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseNoticeText } from "@/lib/notice-parser";
import { saveSharedCandidates } from "./actions";

const typeLabels: Record<string, string> = {
  assignment: "과제", exam: "시험", presentation: "발표", application: "신청", event: "행사", other: "기타",
};

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    const query = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    redirect(`/login?next=${encodeURIComponent(query ? `/share?${query}` : "/share")}`);
  }

  const rawText = [params.title, params.text, params.url].filter(Boolean).join("\n");
  const candidates = rawText.trim().length > 0 ? parseNoticeText(rawText) : [];

  return (
    <main className="shell" style={{ padding: "38px 0 80px" }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/dashboard" className="muted">← 대시보드</Link>
        <h1 style={{ margin: "10px 0 0" }}>공유받은 공지 확인</h1>
        <p className="muted" style={{ marginTop: 6 }}>자동으로 뽑은 내용이에요. 틀린 부분은 고쳐서 저장하세요.</p>
      </header>

      {candidates.length === 0 ? (
        <section className="card" style={{ padding: 24 }}>
          <p>날짜를 찾지 못했어요. 아래 원문을 참고해서 대시보드에서 직접 추가해주세요.</p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f6f6fb", padding: 16, borderRadius: 10, marginTop: 12 }}>
            {rawText || "(전달된 내용이 없어요)"}
          </pre>
          <Link href="/dashboard" className="button button-primary" style={{ display: "inline-block", marginTop: 16 }}>
            대시보드로 이동
          </Link>
        </section>
      ) : (
        <form action={saveSharedCandidates} style={{ display: "grid", gap: 16 }}>
          <input type="hidden" name="total" value={candidates.length} />
          {candidates.map((candidate, index) => (
            <section key={index} className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name={`include_${index}`} defaultChecked />
                <span className="muted" style={{ fontSize: 13 }}>
                  신뢰도 {Math.round(candidate.confidence * 100)}% · 원문: “{candidate.snippet}”
                </span>
              </label>
              <input type="hidden" name={`snippet_${index}`} value={candidate.snippet} />
              <input type="hidden" name={`confidence_${index}`} value={candidate.confidence} />
              <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 2fr) 1fr minmax(190px, 1fr)", gap: 12 }}>
                <label className="label">
                  제목<input className="field" name={`title_${index}`} defaultValue={candidate.title} required />
                </label>
                <label className="label">
                  유형
                  <select className="field" name={`event_type_${index}`} defaultValue={candidate.eventType}>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  마감
                  <input
                    className="field"
                    name={`due_at_${index}`}
                    type="datetime-local"
                    defaultValue={toLocalInputValue(candidate.dueAt as string)}
                    required
                  />
                </label>
              </div>
            </section>
          ))}
          <button className="button button-primary" type="submit">선택한 항목 저장</button>
        </form>
      )}
    </main>
  );
}
