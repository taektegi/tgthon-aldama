"use client";

import { useEffect } from "react";

// 앱 아이콘 배지: 24시간 내 마감(미완료) 개수를 홈 화면 아이콘에 빨간 숫자로 표시.
// 대시보드가 열리거나 완료 처리로 다시 그려질 때마다 숫자를 갱신한다.
// (앱이 닫혀 있을 때는 서비스 워커가 푸시를 받으면서 갱신)
type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function AppBadge({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge !== "function") return; // 지원 안 하는 브라우저는 조용히 무시
    if (count > 0) {
      nav.setAppBadge(count).catch(() => {});
    } else {
      nav.clearAppBadge?.().catch(() => {});
    }
  }, [count]);

  return null;
}
