import Link from "next/link";
import { StatusAlert } from "@/app/components/States";
import { canvasSettingsUrl } from "@/lib/canvas/config";
import { SubmitButton } from "@/app/login/SubmitButton";
import { connectLearnX } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "토큰이 올바르지 않아요. e-Campus에서 다시 복사해주세요.",
  network: "e-Campus에 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
  rateLimited: "e-Campus 요청이 많아요. 잠시 후 다시 시도해주세요.",
  unavailable: "e-Campus가 일시적으로 불안정해요. 잠시 후 다시 시도해주세요.",
  save: "저장 중 문제가 생겼어요. 다시 시도해주세요.",
  config: "러닝엑스 서버 설정이 완료되지 않았어요. 관리자에게 문의해주세요.",
};

export default async function ConnectLearnXPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const settingsUrl = canvasSettingsUrl(process.env.NEXT_PUBLIC_CANVAS_BASE_URL, process.env.CANVAS_BASE_URL);
  const serverConfigured = Boolean(process.env.CANVAS_BASE_URL && process.env.TOKEN_ENCRYPTION_KEY);

  return (
    <main className="page-shell page-shell--narrow connect-page">
      <header className="page-header">
        <div><p className="page-header__eyebrow">일정 자동 불러오기</p><h1>러닝엑스 연결</h1><p className="page-description">한 번 연결하면 과제가 자동으로 들어오고, 제출한 과제는 완료 상태로 바뀝니다.</p></div>
      </header>

      {error && <StatusAlert tone="danger">{ERROR_MESSAGES[error] ?? "문제가 생겼어요."}</StatusAlert>}

      <ol className="connect-steps">
        <li className="card connect-step">
          <span className="connect-step__number">1</span>
          <div><h2>e-Campus 설정 열기</h2><p>새 액세스 토큰을 만들 수 있는 설정 페이지로 이동합니다.</p></div>
          {settingsUrl
            ? <a href={settingsUrl} target="_blank" rel="noreferrer" className="button button-primary button-block">e-Campus 설정 열기</a>
            : <StatusAlert tone="danger">e-Campus 주소가 설정되지 않았어요. 관리자에게 문의해주세요.</StatusAlert>}
        </li>
        <li className="card connect-step">
          <span className="connect-step__number">2</span>
          <div><h2>토큰 만들기</h2><p><b>+ 새 액세스 토큰</b>을 누르고 목적에 “알다마”를 입력하세요. 만료일은 비워두면 됩니다.</p></div>
        </li>
        <li className="card connect-step">
          <span className="connect-step__number">3</span>
          <form action={connectLearnX} className="form-stack">
            <label className="label">토큰 붙여넣기<span className="field-help">토큰은 생성 직후 한 번만 표시됩니다.</span><input className="field" name="token" type="password" required autoComplete="off" placeholder="토큰을 여기에 붙여넣기" /></label>
            {serverConfigured
              ? <SubmitButton type="submit" className="button button-accent button-block" pendingLabel="연결하는 중... 최대 1분 정도 걸릴 수 있어요">연결하기</SubmitButton>
              : <button type="submit" className="button button-accent button-block" disabled>연결하기</button>}
            {!serverConfigured && <StatusAlert tone="danger">서버 환경 설정이 완료되지 않아 지금은 연결할 수 없어요.</StatusAlert>}
          </form>
        </li>
      </ol>

      <section className="privacy-note"><strong>토큰은 안전하게 보관됩니다</strong><p>암호화해 저장하고 과제를 읽어오는 데만 사용합니다. e-Campus 설정에서 언제든 삭제할 수 있어요.</p></section>
      <Link href="/dashboard" className="button button-ghost button-block">나중에 하기</Link>
    </main>
  );
}
