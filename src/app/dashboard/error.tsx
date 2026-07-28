"use client";

import { useEffect } from "react";
import { AppNav } from "@/app/components/AppNav";

export default function DashboardError({
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
    <div className="dashboard-page dashboard-page--list">
      <AppNav active="list" variant="wallet" />
      <main className="page-shell dashboard-shell dashboard-error">
        <section className="dashboard-error__card" role="alert">
          <span className="dashboard-error__mark" aria-hidden="true">!</span>
          <div>
            <p className="eyebrow">일시적인 오류</p>
            <h1>일정을 불러오지 못했어요</h1>
            <p>잠시 후 다시 시도해주세요. 저장된 일정은 그대로 유지됩니다.</p>
          </div>
          <button type="button" className="button button-primary" onClick={reset}>다시 시도</button>
        </section>
      </main>
    </div>
  );
}
