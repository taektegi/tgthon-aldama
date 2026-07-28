import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/AppNav";
import { EmptyState } from "@/app/components/States";
import { createClient } from "@/lib/supabase/server";
import { parseNotice } from "@/lib/ai-parser";
import { toKstInputValue } from "@/lib/datetime";
import { saveSharedCandidates } from "./actions";

const typeLabels: Record<string, string> = {
  assignment: "과제",
  exam: "시험",
  presentation: "발표",
  application: "신청",
  event: "행사",
  other: "기타",
};

export default async function SharePage({ searchParams }: { searchParams: Promise<{ title?: string; text?: string; url?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();
    redirect(`/login?next=${encodeURIComponent(query ? `/share?${query}` : "/share")}`);
  }

  const rawText = [params.title, params.text, params.url].filter(Boolean).join("\n");
  const { candidates, engine } = rawText.trim().length > 0 ? await parseNotice(rawText) : { candidates: [], engine: "regex" as const };

  return (
    <>
      <main className="page-shell share-page">
        <header className="page-header share-page__header">
          <div>
            <p className="page-header__eyebrow">공지 분석 결과</p>
            <h1>저장할 일정을 확인하세요</h1>
            <div className="share-page__analysis-meta">
              <span className={`badge ${engine === "ai" ? "badge--mint" : "badge--neutral"}`}>{engine === "ai" ? "AI 분석" : "기본 분석"}</span>
              <p className="page-description">잘못된 부분은 저장 전에 수정할 수 있어요.</p>
            </div>
          </div>
        </header>

        {candidates.length === 0 ? (
          <EmptyState
            title="일정 날짜를 찾지 못했어요"
            description="아래 원문을 확인한 뒤 직접 일정으로 추가해주세요."
            action={<><pre className="source-preview">{rawText || "(전달된 내용이 없어요)"}</pre><Link href="/dashboard?add=direct" className="button button-primary">직접 추가</Link></>}
          />
        ) : (
          <form action={saveSharedCandidates} className="form-stack share-form">
            <input type="hidden" name="total" value={candidates.length} />
            {candidates.map((candidate, index) => (
              <section key={index} className="card candidate-card">
                <label className="candidate-card__include">
                  <input type="checkbox" name={`include_${index}`} defaultChecked />
                  <span><strong>이 일정 저장</strong><small>분석 신뢰도 {Math.round(candidate.confidence * 100)}%</small></span>
                </label>
                <input type="hidden" name={`snippet_${index}`} value={candidate.snippet} />
                <input type="hidden" name={`confidence_${index}`} value={candidate.confidence} />
                <div className="candidate-card__fields">
                  <label className="label">제목<input className="field" name={`title_${index}`} defaultValue={candidate.title} required /></label>
                  <label className="label">유형<select className="field" name={`event_type_${index}`} defaultValue={candidate.eventType}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="label">마감<span className="field-help">{candidate.dueAt ? "분석된 날짜를 확인해주세요." : "날짜를 찾지 못했어요. 직접 정하거나 비워둘 수 있어요."}</span><input className="field" name={`due_at_${index}`} type="datetime-local" defaultValue={candidate.dueAt ? toKstInputValue(candidate.dueAt) : ""} /></label>
                </div>
                <details className="source-details"><summary>분석한 원문 보기</summary><p>“{candidate.snippet}”</p></details>
              </section>
            ))}
            <section className="card candidate-card">
              <label className="label">어떤 과목(작업)인가요?<input className="field" name="subject" placeholder="예: 컴퓨터 프로그래밍" required /></label>
              <p className="field-help">선택한 모든 일정에 같은 과목이 적용됩니다.</p>
            </section>
            <button className="button button-primary share-save" type="submit">선택한 일정 저장</button>
          </form>
        )}
      </main>
      <AppNav active="add" variant="wallet" />
    </>
  );
}
