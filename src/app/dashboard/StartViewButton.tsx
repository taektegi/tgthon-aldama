"use client";

import { useState } from "react";

export function StartViewButton({ view }: { view: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      type="button"
      className="button button-muted"
      style={{ fontSize: 12, minHeight: 32, padding: "0 12px" }}
      onClick={() => {
        document.cookie = `aldama_view=${view};path=/;max-age=31536000`;
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }}
    >
      {saved ? "저장됨 ✓" : "이 화면을 시작으로"}
    </button>
  );
}
