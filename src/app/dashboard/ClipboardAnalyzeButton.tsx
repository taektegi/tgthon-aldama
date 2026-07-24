"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "idle" | "reading" | "empty" | "denied";

export function ClipboardAnalyzeButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");

  const handleClick = async () => {
    if (!("clipboard" in navigator) || !navigator.clipboard.readText) {
      setStatus("denied");
      return;
    }
    setStatus("reading");
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text.length < 5) {
        setStatus("empty");
        return;
      }
      router.push(`/share?text=${encodeURIComponent(text.slice(0, 3000))}`);
    } catch {
      setStatus("denied");
    }
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button
        type="button"
        className="button button-accent"
        onClick={handleClick}
        disabled={status === "reading"}
        style={{ justifySelf: "start" }}
      >
        {status === "reading" ? "읽는 중..." : "📋 복사한 공지 바로 분석"}
      </button>
      {status === "empty" && (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          클립보드가 비어 있어요. 공지를 복사한 뒤 다시 눌러주세요.
        </p>
      )}
      {status === "denied" && (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          클립보드를 읽을 수 없어요. 아래 칸에 직접 붙여넣기(Cmd+V) 해주세요.
        </p>
      )}
    </div>
  );
}
