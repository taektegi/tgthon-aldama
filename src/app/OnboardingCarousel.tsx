"use client";

import Image from "next/image";
import { useState } from "react";

const slides = [
  {
    img: "/mascot/neutral.png",
    title: "공지를 붙여넣으세요",
    description:
      "카톡, LMS, 메일, 에브리타임… 어디서 온 공지든 복사해서 붙여넣기만 하면 돼요.",
  },
  {
    img: "/mascot/face.png",
    title: "할 일 카드로 자동 정리",
    description:
      "“7월 12일 23:59까지 제출” 같은 문장에서 날짜와 할 일을 찾아 카드로 만들어드려요.",
  },
  {
    img: "/mascot/alarm.png",
    title: "마감을 놓치지 않게",
    description:
      "D-day 표시와 마감 6시간 전 알림으로, 까먹으면 큰일 나는 일들을 지켜드려요.",
  },
];

export function OnboardingCarousel() {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  return (
    <div className="card" style={{ padding: 36, display: "grid", gap: 14, justifyItems: "center" }}>
      <Image
        src={slide.img}
        alt=""
        width={140}
        height={140}
        style={{ height: 120, width: "auto" }}
        aria-hidden
      />
      <h2 style={{ margin: 0 }}>{slide.title}</h2>
      <p className="muted" style={{ margin: 0, lineHeight: 1.7, maxWidth: 420 }}>{slide.description}</p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}번째 설명 보기`}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              border: "none",
              padding: 0,
              cursor: "pointer",
              background: i === index ? "var(--primary-deep)" : "#d9dbea",
            }}
          />
        ))}
      </div>

      {!isLast ? (
        <button
          type="button"
          className="button button-muted"
          onClick={() => setIndex(index + 1)}
          style={{ marginTop: 4 }}
        >
          다음 ↓
        </button>
      ) : (
        <p style={{ color: "var(--primary-deep)", fontWeight: 700, margin: "4px 0 0", fontSize: 14 }}>
          준비됐어요! 아래에서 시작하세요 👇
        </p>
      )}
    </div>
  );
}
