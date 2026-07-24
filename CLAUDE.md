# 알다마 (ALDAMA) — 작업 인수인계

대학생 공지→할일 카드 앱. sun(초보, 학습 목적: 깃/Supabase/코드분리)과 친구 Taeksoo 협업.
sun에게는 모든 명령어/개념에 "왜"를 설명해줄 것. 코드는 같이 만들되 커밋/push는 sun이 직접.

## 스택/구조
- Next.js App Router + TS + Supabase(호스팅) + Gemini AI(공지 분석, `src/lib/ai-parser.ts`)
- 패턴: 페이지=서버 컴포넌트, 상호작용 조각만 "use client"
- 디자인: 민트+펭귄 마스코트(`public/mascot/*.png`), 테마변수 `globals.css`
- 시간대: KST 헬퍼 `src/lib/datetime.ts` 필수 사용

## 현재 상태 (feature/sun 브랜치)
완성: 인증(이메일 링크 확인 방식), /signup 마법사, /welcome 온보딩, 대시보드(펭귄 상태카드,
[+계획 추가]→선택→직접입력/텍스트/이미지 분석, 카드 편집/완료/삭제, 과목 필드),
/share AI 분석+과목 입력, 캘린더 탭(월간, 유형칩, 날짜 필터, 빈날짜→추가폼), 시작화면 쿠키 스위치.

## 다음 할 일
1. 캘린더 디자인 입히기 (sun이 이미지 제공 예정)
2. PR merge → Netlify 배포 반영 (https://tgthon-aldama.netlify.app, 현재 구버전)
3. Netlify 환경변수: GEMINI_API_KEY, NEXT_PUBLIC_SITE_URL / Supabase Redirect URLs에 배포주소
4. "오늘 할 일" 브리핑, AI 과목 추측, 아이폰 단축어 안내, Resend SMTP(인증번호 전환)
5. 출시 전: Gemini 키 재발급(채팅 노출됨), intern-dashboard 토큰 정리

## 주의
- Claude 샌드박스가 git 돌리면 .git/index.lock이 남음 → 작업 후 rm 해줄 것
- .env.local에 실키 있음(깃 제외됨). 이메일 인증은 회사메일 불가(보안스캐너), Gmail로 테스트
- 무료 인증메일 시간당 2~4통 제한
