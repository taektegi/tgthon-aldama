"use client";

// 대시보드에 접속하면 자동으로(10분 지났을 때만) 러닝엑스 동기화를 돌리고,
// [지금 동기화] 수동 버튼과 "N분 전 동기화" 상태를 보여주는 조각.
import { useEffect, useRef, useState, useTransition } from "react";
import { syncLearnXNow } from "./actions";

const STALE_MS = 10 * 60 * 1000;

const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_INVALID: "토큰을 다시 연결해주세요.",
  RATE_LIMITED: "요청이 많아요. 잠시 후 다시 시도해주세요.",
  CANVAS_TEMPORARY: "e-Campus가 일시적으로 불안정해요.",
  NETWORK_ERROR: "e-Campus에 연결하지 못했어요.",
  CANVAS_ERROR: "e-Campus 응답을 처리하지 못했어요.",
  SYNC_DATABASE_ERROR: "일정 저장 중 문제가 생겼어요.",
  SYNC_ERROR: "동기화하지 못했어요.",
  NOT_CONNECTED: "러닝엑스 연결을 확인해주세요.",
};

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
    if (stale) startTransition(async () => {
      await syncLearnXNow();
    });
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
            const result = await syncLearnXNow();
            setMessage(result.ok ? `완료! 새 일정 ${result.inserted}개` : ERROR_MESSAGES[result.code] ?? "동기화하지 못했어요.");
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
