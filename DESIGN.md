---
version: "alpha"
name: "Aldama Mint Pocket Planner"
description: "A mobile-first planning system for university notices, assignments, exams, and events."
colors:
  background: "#edf6f3"
  surface: "#ffffff"
  surface-soft: "#f6faf8"
  foreground: "#1f2e2b"
  foreground-soft: "#40534d"
  primary: "#4f9e8f"
  primary-deep: "#347568"
  primary-pale: "#d8ece6"
  primary-soft: "#eaf5f1"
  on-primary: "#ffffff"
  accent: "#eb9c43"
  on-accent: "#2f2417"
  danger: "#c93434"
  danger-pale: "#fff0f0"
  warning: "#9a6400"
  warning-pale: "#fff7e5"
  success: "#18794e"
  success-pale: "#e9f8f0"
  muted: "#5f706a"
  border: "#d3e5df"
  border-strong: "#b9d3ca"
  disabled-surface: "#e6efec"
  disabled-text: "#7d8b87"
  placeholder: "#87958f"
  label-text: "#33463f"
  danger-border: "#f3caca"
  warning-border: "#f0ddb6"
  success-border: "#c8ead7"
  neutral-badge: "#eef2f0"
  neutral-badge-text: "#58645f"
  urgency-text: "#905500"
  inactive-dot: "#c9d4d0"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  heading-lg:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 800
    lineHeight: 1.2
  heading-md:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 800
    lineHeight: 1.3
  body-md:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  body-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
  micro:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "9px"
  caption-xs:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "10px"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "11px"
  meta:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "12px"
  eyebrow:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "13px"
  body-emphasis:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "17px"
  heading-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "18px"
  heading-base:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "20px"
  icon-md:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "22px"
  title-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "28px"
  icon-lg:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "30px"
  title-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "31px"
  display-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "32px"
  display-md:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "34px"
  icon-xl:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "44px"
  hero:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, Apple SD Gothic Neo, sans-serif"
    fontSize: "52px"
    fontWeight: 800
    lineHeight: 1.15
rounded:
  xs: "6px"
  sm: "12px"
  control: "14px"
  md: "16px"
  lg: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 18px"
  button-secondary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 18px"
  button-danger:
    backgroundColor: "{colors.danger-pale}"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 18px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

## Overview

알다마는 대학생이 흩어진 공지, 과제, 시험, 신청 및 행사 일정을 빠르게 모으고 마감 상태를 파악하는 모바일 중심 PWA다. 디자인 콘셉트는 **민트 포켓 플래너**다. 친근하지만 유아적으로 보이지 않고, 한 손으로 필요한 일정에 도달할 수 있어야 한다.

화면의 주인공은 일정과 마감 상태다. 장식은 정보 이해를 방해하지 않아야 하며, 펭귄 마스코트는 빈 화면, 오류, 동기화, 마감 임박처럼 사용자의 다음 행동을 안내하는 상태 요소로 사용한다.

## Brand principles

- 민트색은 안정감과 브랜드 인지를 담당하고, 주황색은 오늘 또는 임박한 일정에 제한적으로 사용한다.
- 위험, 마감 초과, 실패 상태에는 빨간색을 사용하되 반드시 문구나 아이콘을 함께 제공한다.
- 둥근 카드와 부드러운 그림자를 사용하되 카드 안에 불필요하게 카드를 중첩하지 않는다.
- 짧고 친근한 한국어 문구를 사용한다. 오류 원인과 사용자가 할 수 있는 다음 행동을 숨기지 않는다.
- 펭귄 이미지는 장식적으로 반복하지 않는다. 한 화면에서 하나의 주요 상태 메시지에 우선 배치한다.

## Information hierarchy

1. 마감 상태와 날짜
2. 일정 제목
3. 과목 또는 출처
4. 완료, 수정, 삭제와 같은 행동

일정 카드는 제목이 길거나 과목명이 길어도 폭을 넘지 않아야 한다. 제목과 과목명은 임의로 잘라 의미를 숨기기보다 줄바꿈을 허용하고, 행동 버튼은 별도 행으로 내려갈 수 있어야 한다.

완료된 일정은 흐림과 취소선만 사용하지 않는다. `완료`라는 문구 또는 완료 상태 배지를 함께 제공한다. 마감 초과와 마감 임박도 색상 외에 명시적 텍스트로 표시한다.

## Navigation

- 모바일의 기본 탐색은 화면 하단의 일정, 추가, 캘린더 세 항목이다. 추가는 중앙에 배치한다.
- 설정은 대시보드 헤더의 오른쪽 상단에 배치하고, 알림 상태가 함께 있을 때는 설정이 가장 오른쪽에 위치한다.
- 목록과 캘린더 전환을 화면 상단에 중복 배치하지 않는다.
- 주요 터치 영역은 최소 44px이다.
- 하단 내비게이션과 고정 저장 버튼은 `env(safe-area-inset-bottom)`을 고려한다.
- 주요 기능은 현재 화면에서 2~3번 이내의 조작으로 도달할 수 있어야 한다.

## Layout and responsive behavior

- 최소 지원 폭은 320px이며 핵심 검증 폭은 360px, 390px, 768px, 1024px 이상이다.
- 페이지 좌우 여백은 모바일에서 11px 이상, 넓은 화면에서 16px 이상 유지한다.
- 기본 대시보드 콘텐츠 폭은 760px을 넘지 않는다. 일반 페이지의 최대 폭은 1080px이다.
- 760px 이하에서는 양열 폼을 한 열로 바꾸고, 일정 카드의 행동 영역을 내용 아래로 이동한다.
- 390px 이하에서는 추가 방식 선택 카드와 설정 버튼을 한 열로 배치한다.
- 가로 스크롤을 만들지 않는다. 긴 단어, URL, 과목명은 `overflow-wrap`으로 안전하게 줄바꿈한다.
- 모바일 키보드가 열린 상태에서도 입력 중인 필드와 저장 버튼에 도달할 수 있어야 한다.

## Components

### Buttons

- 기본 높이는 44px 이상이다.
- 주요 행동은 짙은 민트 배경과 흰색 텍스트를 사용한다.
- 보조 행동은 옅은 민트 배경과 짙은 민트 텍스트를 사용한다.
- 삭제 같은 파괴적 행동은 위험 색상과 명확한 동사를 사용한다.
- 처리 중에는 버튼을 비활성화하고 `처리 중`, `저장 중`, `동기화 중`처럼 현재 상태를 표시한다.
- 아이콘만 있는 버튼에는 접근 가능한 이름을 제공한다.

### Cards

- 기본 카드는 흰색 표면, 1px 테두리, 22px 모서리를 사용한다.
- 일정 카드의 왼쪽 상태 레일은 보조 신호이며 상태 텍스트를 대체하지 않는다.
- 많은 일정이 있을 때도 카드 간격과 제목 줄바꿈이 안정적으로 유지되어야 한다.

### Fields

- 모든 입력에는 화면에 보이는 label을 제공한다.
- 필드 높이는 최소 44px이며, 포커스 상태는 굵은 외곽선 또는 명확한 링으로 표시한다.
- placeholder는 label을 대신하지 않는다.
- 오류 문구는 필드 가까이에 표시하고 해결 방법을 포함한다.

### Badges and status

- 배지는 색상과 짧은 텍스트를 함께 사용한다.
- 일정 카드의 마감 상태 배지는 34px 높이와 15px 굵은 글자를 사용해 제목보다 먼저 인식되게 한다. 마감 초과·긴급은 채운 위험색, 오늘·임박은 채운 강조색, 여유 있는 D-day는 옅은 민트색으로 강약을 구분한다.
- `마감 초과`, `마감 임박`, `오늘`, `완료`, `러닝엑스` 상태는 서로 구분되는 문구를 유지한다.
- 성공, 경고, 실패 메시지는 `role="status"` 또는 `role="alert"`를 상황에 맞게 사용한다.

## Mascot usage

- 빈 일정: 차분한 펭귄과 첫 일정 추가 안내
- 마감 임박: 긴장하거나 달리는 펭귄과 구체적인 남은 시간
- 완료: 기쁜 펭귄과 짧은 성공 메시지
- 오류: 당황한 펭귄과 재시도 또는 로그인 안내
- 로딩: 큰 이미지를 반복 로드하지 않고 스피너와 짧은 문구를 우선 사용한다.

마스코트는 일반적으로 62~88px 범위에서 사용한다. 핵심 정보를 밀어내거나 모바일 화면의 절반 이상을 차지하지 않는다.

## Accessibility

- 일반 텍스트는 WCAG AA 명암비를 목표로 한다.
- 키보드 포커스를 항상 볼 수 있어야 한다.
- 색상만으로 상태를 표현하지 않는다.
- 네이티브 버튼, 링크, 폼 제출 동작을 우선해 자바스크립트 초기화가 늦어도 기본 행동이 가능하도록 한다.
- 애니메이션은 `prefers-reduced-motion`을 존중한다.
- 비활성화, 로딩, 성공, 실패 상태를 스크린 리더가 인식할 수 있도록 한다.

## Product constraints

- 기존 URL과 search parameter를 유지한다.
- Server Action의 form 필드 이름과 인증 리디렉션을 유지한다.
- Supabase 스키마, RLS, 쿠키, Canvas 동기화 계약은 디자인 작업만으로 변경하지 않는다.
- 서버 컴포넌트 구조를 우선하고 불필요하게 `use client` 범위를 확대하지 않는다.
- 새로운 대형 UI 라이브러리나 다크 모드는 별도 승인 없이 추가하지 않는다.

## Definition of done

- 360px, 390px, 768px, 1024px 이상에서 가로 스크롤이 없다.
- 주요 터치 영역이 44px 이상이다.
- 로딩, 처리 중, 데이터 없음, 로그인 만료, API 오류, 러닝엑스 미연결·동기화·실패, 마감 임박·초과, 완료, 긴 제목, 이미지 분석 실패 상태를 확인한다.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`를 통과한다.
- 브라우저 콘솔 오류, 잘못된 링크, 접근할 수 없는 버튼과 기능 회귀가 없다.
