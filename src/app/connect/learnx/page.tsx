import Link from "next/link";
import { connectLearnX } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "토큰이 올바르지 않아요. e-Campus에서 다시 복사해주세요.",
  network: "e-Campus에 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
  save: "저장 중 문제가 생겼어요. 다시 시도해주세요.",
};

export default async function ConnectLearnXPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const settingsUrl = `${process.env.NEXT_PUBLIC_CANVAS_BASE_URL}/profile/settings`;

  return (
    <main className="shell" style={{ padding: "38px 0 80px", maxWidth: 520 }}>
      <h1 style={{ margin: 0 }}>러닝엑스 연결</h1>
      <p className="muted" style={{ margin: "8px 0 24px", fontSize: 14 }}>
        한 번만 연결하면 러닝엑스 과제가 자동으로 카드에 들어와요. 제출하면 자동 완료!
      </p>

      <section className="card" style={{ padding: 18, display: "grid", gap: 18 }}>
        <div>
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>1. e-Campus 설정 열기</p>
          <a href={settingsUrl} target="_blank" rel="noreferrer" className="button button-primary" style={{ width: "100%" }}>
            e-Campus 설정 페이지 열기
          </a>
        </div>

        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>2. 토큰 만들기</p>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            아래로 스크롤 → <b>+ 새 액세스 토큰</b> 클릭 → 목적에 &ldquo;알다마&rdquo; 입력, 만료일은 비워두고 생성
          </p>
        </div>

        <form action={connectLearnX} style={{ display: "grid", gap: 10 }}>
          <label className="label">
            3. 토큰 붙여넣기 <span className="muted" style={{ fontWeight: 400 }}>(토큰은 지금 딱 한 번만 보여요)</span>
            <input
              className="field"
              name="token"
              type="password"
              required
              autoComplete="off"
              placeholder="토큰을 여기에 붙여넣기"
            />
          </label>
          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "#c0392b" }}>{ERROR_MESSAGES[error] ?? "문제가 생겼어요."}</p>
          )}
          <button type="submit" className="button button-accent">연결하기</button>
        </form>

        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          토큰은 암호화되어 저장되고, 과제를 읽어오는 데만 사용해요. e-Campus 설정에서 언제든 삭제할 수 있어요.
        </p>
      </section>

      <p style={{ textAlign: "center", marginTop: 18 }}>
        <Link href="/dashboard" className="muted" style={{ fontSize: 14 }}>나중에 할래요</Link>
      </p>
    </main>
  );
}
