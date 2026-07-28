"use client";

// "다가오는 일정" 표시 기간 선택 칩 (1주/2주/1달/전체).
// 선택은 쿠키(aldama_range)에 기억해서 다음에 앱을 열어도 유지된다.
import { useRouter } from "next/navigation";
import { UPCOMING_RANGES, type UpcomingRange } from "@/lib/schedule-sections";

function saveRange(value: UpcomingRange) {
  document.cookie = `aldama_range=${value};path=/;max-age=31536000`;
}

export function UpcomingRangeFilter({ selected }: { selected: UpcomingRange }) {
  const router = useRouter();

  function choose(value: UpcomingRange) {
    saveRange(value);
    router.push(`/dashboard?range=${value}`);
  }

  return (
    <div className="range-filter" role="group" aria-label="다가오는 일정 표시 기간">
      {UPCOMING_RANGES.map((range) => (
        <button
          key={range.value}
          type="button"
          className="range-filter__chip"
          aria-pressed={selected === range.value}
          onClick={() => choose(range.value)}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
