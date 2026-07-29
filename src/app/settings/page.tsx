import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/AppNav";
import { StatusAlert } from "@/app/components/States";
import { createClient } from "@/lib/supabase/server";
import { signOut, syncLearnXFromForm } from "../dashboard/actions";
import { disconnectLearnX } from "../connect/learnx/actions";
import { StartViewToggle } from "../dashboard/StartViewButton";

function syncedLabel(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return "아직 동기화 전";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 60000));
  return `마지막 동기화 ${minutes}분 전`;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ learnxError?: string }> }) {
  const { learnxError } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const cookieStore = await cookies();
  const savedView = cookieStore.get("aldama_view")?.value === "calendar" ? "calendar" : "list";
  const { data: canvasSource } = await supabase
    .from("sources")
    .select("id, name, status, last_synced_at, last_sync_error")
    .eq("type", "canvas")
    .maybeSingle();

  return (
    <>
      <main className="page-shell page-shell--narrow settings-page">
        <header className="page-header">
          <div><p className="page-header__eyebrow">갈피</p><h1>설정</h1></div>
        </header>

        {learnxError === "disconnect" && <StatusAlert tone="danger">연결을 해제하지 못했어요. 잠시 후 다시 시도해주세요.</StatusAlert>}

        <div className="settings-list">
          <section className="card settings-card">
            <div>
              <h2>기본화면</h2>
              <p>앱을 열 때 처음 보여줄 화면이에요.</p>
            </div>
            <StartViewToggle initial={savedView} />
          </section>

          <section className="card settings-card settings-card--stack">
            <div>
              <div className="settings-card__title-row">
                <h2>LearningX 연동</h2>
                <span className={`badge ${canvasSource?.status === "error" ? "badge--danger" : canvasSource?.last_sync_error ? "badge--warning" : canvasSource ? "badge--success" : "badge--neutral"}`}>
                  {canvasSource?.status === "error" ? "연결 오류" : canvasSource?.last_sync_error ? "동기화 필요" : canvasSource ? "연결됨" : "미연결"}
                </span>
              </div>
              {canvasSource ? (
                <p>
                  {canvasSource.status === "error"
                    ? "연결이 끊겼어요. 다시 연결해주세요."
                    : `${canvasSource.last_sync_error ? "최근 동기화 실패 · " : ""}연결됨 (${canvasSource.name}) · ${syncedLabel(canvasSource.last_synced_at)}`}
                </p>
              ) : <p>아직 연결되지 않았어요. 연결하면 과제가 일정에 자동으로 들어와요.</p>}
            </div>
            <div className="form-actions">
              {canvasSource ? (
                <>
                  {canvasSource.status === "error"
                    ? <Link href="/connect/learnx" className="button button-primary">다시 연결</Link>
                    : <form action={syncLearnXFromForm}><button className="button button-primary">지금 동기화</button></form>}
                  <form action={disconnectLearnX}><button className="button button-danger">연결 해제</button></form>
                </>
              ) : <Link href="/connect/learnx" className="button button-primary">LearningX 연결</Link>}
            </div>
            {canvasSource && <p className="field-help">연결을 해제해도 이미 만든 일정은 남습니다. e-Campus 설정에서 토큰도 삭제할 수 있어요.</p>}
          </section>

          <section className="card settings-card">
            <div><h2>계정</h2><p>현재 기기에서 안전하게 로그아웃합니다.</p></div>
            <form action={signOut}><button className="button button-muted">로그아웃</button></form>
          </section>
        </div>
      </main>
      <AppNav variant="wallet" />
    </>
  );
}
