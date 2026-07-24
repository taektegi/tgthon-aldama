"use client";

// "기본화면" 토글 스위치: 앱을 열 때 어떤 화면으로 시작할지 정한다.
// 흰 손잡이가 선택된 쪽으로 미끄러지는 ON/OFF 스위치 느낌.
import { useState } from "react";

const OPTIONS = [
  { value: "calendar", label: "📅 캘린더" },
  { value: "list", label: "📋 할 일" },
] as const;

function saveStartView(value: "calendar" | "list") {
  document.cookie = `aldama_view=${value};path=/;max-age=31536000`;
}

export function StartViewToggle({ initial }: { initial: "calendar" | "list" }) {
  const [selected, setSelected] = useState<"calendar" | "list">(initial);
  const [saved, setSaved] = useState(false);
  const index = selected === "calendar" ? 0 : 1;

  function choose(value: "calendar" | "list") {
    setSelected(value);
    saveStartView(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div style={{ display: "grid", gap: 3, justifyItems: "center" }}>
      <span className="muted" style={{ fontSize: 11, fontWeight: 700 }}>
        {saved ? "저장됨 ✓" : "기본화면"}
      </span>
      <div
        role="group"
        aria-label="기본화면 선택"
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          background: "var(--primary-pale)",
          border: "1px solid var(--border)",
          borderRadius: 999,
          padding: 3,
          cursor: "pointer",
          minWidth: 150,
        }}
      >
        {/* 미끄러지는 민트색 손잡이 */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 3,
            left: 3,
            width: "calc(50% - 3px)",
            height: "calc(100% - 6px)",
            background: "var(--primary)",
            borderRadius: 999,
            transform: `translateX(${index * 100}%)`,
            transition: "transform 0.2s ease",
          }}
        />
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={selected === option.value}
            style={{
              position: "relative",
              zIndex: 1,
              background: "none",
              border: "none",
              borderRadius: 999,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              color: selected === option.value ? "white" : "var(--muted)",
              opacity: selected === option.value ? 1 : 0.35,
              filter: selected === option.value ? "none" : "grayscale(1)",
              transition: "color 0.2s ease, opacity 0.2s ease, filter 0.2s ease",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
