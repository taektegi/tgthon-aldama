import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut, syncLearnXNow } from "../dashboard/actions";
import { disconnectLearnX } from "../connect/learnx/actions";
import { StartViewToggle } from "../dashboard/StartViewButton";

function syncedLabel(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return "아직 동기화 전";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 60000));
  return `마지막 동기화 ${minutes}분 전`;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const cookieStore = await cookies();
  const savedView = cookieStore.get("aldama_view")?.value === "calendar" ? "calendar" : "list";

  const { data: canvasSource } = await supabase
    .from("sources")
    .select("id, name, status, last_synced_at")
    .eq("type", "canvas")
    .maybeSingle();

  return (
    <main className="shell" style={{ padding: "38px 0 80px", maxWidth: 560 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/dashboard" className="muted">← 대시보드</Link>
        <h1 style={{ margin: "10px 0 0" }}>설정</h1>
      </header>

      <section className="card" style={{ padding: 20, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800 }}>기본화면</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>앱을 열 때 처음 보여줄 화면이에요.</p>
        </div>
        <StartViewToggle initial={savedView} />
      </section>

      <section className="card" style={{ padding: 20, marginBottom: 16, display: "grid", gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800 }}>러닝엑스 연동</p>
          {canvasSource ? (
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              {canvasSource.status === "error"
                ? "⚠️ 연결이 끊겼어요. 다시 연결해주세요."
                : `연결됨 (${canvasSource.name}) · ${syncedLabel(canvasSource.last_synced_at)}`}
            </p>
          ) : (
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>아직 연결 안 됨 — 연결하면 과제가 자동으로 카드에 들어와요.</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canvasSource ? (
            <>
              {canvasSource.status === "error" ? (
                <Link href="/connect/learnx" className="button button-primary">다시 연결하기</Link>
              ) : (
                <form action={syncLearnXNow}><button className="button button-primary">지금 동기화</button></form>
              )}
              <form action={disconnectLearnX}><button className="button button-danger">연결 해제</button></form>
            </>
          ) : (
            <Link href="/connect/learnx" className="button button-primary">🔗 러닝엑스 연결</Link>
          )}
        </div>
        {canvasSource && (
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            연결을 해제해도 이미 만들어진 카드는 남아요. 완전히 끊으려면 e-Campus 설정에서 토큰도 삭제하세요.
          </p>
        )}
      </section>

      <section className="card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800 }}>계정</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>이 기기에서 로그아웃해요.</p>
        </div>
        <form action={signOut}><button className="button button-muted">로그아웃</button></form>
      </section>
    </main>
  );
}
