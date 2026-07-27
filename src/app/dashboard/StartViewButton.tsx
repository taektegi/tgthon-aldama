"use client";

// "기본화면" 토글 스위치: 앱을 열 때 어떤 화면으로 시작할지 정한다.
// 흰 손잡이가 선택된 쪽으로 미끄러지는 ON/OFF 스위치 느낌.
import { useState } from "react";
import { CalendarIcon, ListIcon } from "@/app/components/UiIcons";

const OPTIONS = [
  { value: "calendar", label: "캘린더", icon: CalendarIcon },
  { value: "list", label: "일정", icon: ListIcon },
] as const;

function saveStartView(value: "calendar" | "list") {
  document.cookie = `aldama_view=${value};path=/;max-age=31536000`;
}

export function StartViewToggle({ initial }: { initial: "calendar" | "list" }) {
  const [selected, setSelected] = useState<"calendar" | "list">(initial);
  const [saved, setSaved] = useState(false);

  function choose(value: "calendar" | "list") {
    setSelected(value);
    saveStartView(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="start-view-toggle">
      <span className="start-view-toggle__status" aria-live="polite">
        {saved ? "저장됨 ✓" : "기본화면"}
      </span>
      <div
        role="group"
        aria-label="기본화면 선택"
        className="start-view-toggle__group"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={selected === option.value}
          >
            <option.icon />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
