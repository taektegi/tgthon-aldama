"use client";

// 대시보드에 접속하면 자동으로(10분 지났을 때만) 러닝엑스 동기화를 돌리고,
// [지금 동기화] 수동 버튼과 "N분 전 동기화" 상태를 보여주는 조각.
import { useEffect, useRef, useState, useTransition } from "react";
import { syncLearnXNow } from "./actions";

const STALE_MS = 10 * 60 * 1000;

export default function LearnXSync({
  lastSyncedAt,
  syncedLabel,
  active,
}: {
  lastSyncedAt: string | null;
  syncedLabel: string | null; // "N분 전 동기화" 문구는 서버에서 만들어 내려준다
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const ranOnce = useRef(false);

  useEffect(() => {
    if (!active || ranOnce.current) return;
    ranOnce.current = true; // React StrictMode의 이중 실행 방지
    const stale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > STALE_MS;
    if (stale) startTransition(() => syncLearnXNow());
  }, [active, lastSyncedAt]);

  if (!active) return null;

  return (
    <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span>{isPending ? "러닝엑스 동기화 중..." : syncedLabel ?? "러닝엑스 연결됨"}</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await syncLearnXNow();
            setMessage("완료!");
            setTimeout(() => setMessage(""), 2000);
          })
        }
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", color: "var(--primary-deep)", fontSize: 13, fontWeight: 700 }}
      >
        지금 동기화
      </button>
      {message && <span>{message}</span>}
    </span>
  );
}
