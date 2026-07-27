"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-shell page-shell--narrow page-center">
      <section className="card empty-state" role="alert">
        <div className="empty-state__symbol" aria-hidden="true">!</div>
        <div>
          <h1>화면을 불러오지 못했어요</h1>
          <p>잠시 후 다시 시도해주세요. 입력한 내용이 있다면 먼저 복사해두는 것이 안전해요.</p>
        </div>
        <button type="button" className="button button-primary" onClick={reset}>다시 시도</button>
      </section>
    </main>
  );
}
