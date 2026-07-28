"use client";

// 저장 확인 문구: 4초 보여준 뒤 스르륵 사라진다.
import { useEffect, useState } from "react";

const SHOW_MS = 4000;
const FADE_MS = 400;

export function SaveConfirm() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase("fading"), SHOW_MS);
    const goneTimer = setTimeout(() => setPhase("gone"), SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <p className={`save-confirm ${phase === "fading" ? "save-confirm--fade" : ""}`} role="status">
      일정이 저장되었습니다!
    </p>
  );
}
