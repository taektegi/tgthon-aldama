# 갈피 (구 알다마) — 작업 인수인계

대학생 공지→할일 카드 앱. sun(초보, 학습 목적: 깃/Supabase/코드분리)과 친구 Taeksoo 협업.
sun에게는 모든 명령어/개념에 "왜"를 비유로 쉽게 설명해줄 것. 코드는 같이 만들되 커밋/push는 sun이 직접.
**로컬 확인(npm run dev) → npm test → 커밋 → PR → merge 순서 엄수. merge 전에 항상 `git fetch origin`으로 main 새 커밋 확인** (Taeksoo와 같은 걸 고치는 일 방지 — 2026-07-29 배너 수정 중복 사건).

## 2026-07-29 앱 이름 개명: 알다마 → 갈피
- 사용자 노출 텍스트 전부 갈피 (layout title, manifest, sw.js 푸시 제목, reminders, 로그인/가입/설정/환영/시작 화면, 러닝엑스 안내)
- 대시보드 h1은 "갈 피" 워드마크 (.page-title--wordmark, 굵기 480/자간 .14em), ALDAMA eyebrow 삭제
- repo명·쿠키명(aldama_view, aldama_range)·코드 주석은 알다마 유지 (기능에 영향 없음)
- 폰 홈 화면 아이콘 이름은 지웠다 다시 추가해야 갈피로 뜸

## 스택/구조
- Next.js App Router + TS + Supabase(호스팅) + Gemini AI(공지 분석, `src/lib/ai-parser.ts`, 모델 `gemini-flash-lite-latest`)
- 패턴: 페이지=서버 컴포넌트, 상호작용 조각만 "use client". 테스트: vitest (`npm test`) — Claude 샌드박스(리눅스)에선 vitest 실행 불가(rolldown 바이너리), tsc만 가능. 테스트는 sun 맥에서
- 디자인: 민트+펭귄 마스코트(`public/mascot/*.png`), 테마변수 `globals.css`, 클래스 shell/card/button/field
- 시간대: KST 헬퍼 `src/lib/datetime.ts`. 단 Canvas due_at은 UTC ISO 그대로 저장

## 제품 방향 (2026-07-27 sun이 확정)
- 핵심 미션: **"아 맞다!"를 없애는 앱** — 안 열어도 계속 상기시켜줌
- 울리는 층(푸시 4단계: 24/6/3/1h) + 조용한 층(앱 아이콘 배지) 구분. 반복알림은 과해서 안 함
- 캘린더 구독(.ics)은 보류, 네이티브 앱(위젯)은 출시 후 장기 과제 (Capacitor+WidgetKit 경로 논의됨)

## 러닝엑스(Canvas) 연동
- 경희대 e-Campus = Canvas LMS. **진짜 API: https://khcanvas.khu.ac.kr** (e-campus.khu.ac.kr 아님!)
- 학생 발급 액세스 토큰 방식 (OAuth는 출시 후 학교에 제안 예정)
- 구조: `src/lib/canvas/{api,mapping,sync}.ts` + `src/lib/crypto.ts`(AES-GCM)
- Taeksoo의 PR #2(안정화)가 merge됨: 에러 세분화(TOKEN_INVALID/RATE_LIMITED/CANVAS_TEMPORARY/NETWORK_ERROR 등), 캘린더 이벤트도 동기화(-30d~+365d), **override_fields**(사용자가 고친 칸은 동기화가 안 덮음), sync_runs 기록, RLS, 테스트 대량 추가
- 규칙: 제출→자동완료(역방향 없음), 연동카드 삭제=is_hidden, 마감 지난 새 과제 무시, 퀴즈→exam

## 알림/배지 (2026-07-27 완성, 배포됨)
- **4단계 푸시**: `src/lib/reminders.ts`(computeReminderStage, 테스트 있음) + `netlify/functions/send-due-reminders.mts`(15분마다). events.reminder_stage(0~4)로 중복 방지, 밀려도 최신 단계 1개만. 알림 태그는 `event-{id}` 재사용 → 알림센터에 카드당 1개, 완료 시 제거
- **앱 배지**: 24h 내 미완료 개수. 대시보드 열 때/완료 시(`AppBadge.tsx`) + 푸시 수신 시(`public/sw.js`, payload.badgeCount)
- 아이폰 조건: 홈 화면에 추가한 PWA만 푸시/배지 가능
- 폰 실전 시험 완료 (2026-07-27 sun이 확인: 푸시+배지 정상)

## 대시보드 개편 (2026-07-29, PR #9 배포됨 + 일부 미배포)
- **놓친 일정**: 검은 히어로 배너("마감이 지난 일정 N개 · 지금이라도 확인해볼까요?") + [펼쳐보기] 버튼(`?overdue=1`) → 배너 아래 패널. 패널에 [전체 완료] 버튼(`completeAllOverdue` 서버액션, RLS로 내 것만)
- **칭찬 배너**: 놓친 일정 0개면 밝은 회색(#c9cacc) + CircleCheckIcon + "놓친 일정 0개". 배너류는 목록 화면 전용(Taeksoo PR #10이 view==="list" 제한)
- **구역 규칙 분리**: `src/lib/schedule-sections.ts`(+테스트) — 마감임박=당일~D-2(KST 날짜), 다가오는 일정=기간 필터(1주/2주/1달/전체, 기본 1주, 쿠키 aldama_range, `UpcomingRangeFilter.tsx`), 마감 없는 일정은 항상 표시. "전체 일정→캘린더" 줄 삭제
- **저장 확인**: 직접 입력 저장 → 같은 화면 유지(`?add=direct&saved=<ts>`), 카드 위 가운데 연한 글씨 4초 후 페이드(`SaveConfirm.tsx`). 수정 저장 → 목록 위 초록 알림(`?saved=1`)
- **공지 분석 starts_at**: ai-parser 프롬프트+스키마에 시작/마감 구분 규칙(행사·회의=시작만, 과제·신청=마감만, 기간=둘 다). /share에 시작 입력칸. DB 마이그레이션 불필요(starts_at 원래 있음)
- **캘린더**: 기간 일정(시작~마감)을 사이 모든 날에 표시(`eventOccupiesDay`), 날짜 칸 66px·글자 확대

## 오늘의 기타 변경 (2026-07-27)
- 러닝엑스 연결 버튼: SubmitButton 재활용, "연결하는 중... 최대 1분" 진행 표시 (이모지 넣지 말 것 — sun이 뺌)
- 마감 지난 카드: "마감기한 끝. 놓쳤어요!!" + 우는펭귄 `overdue-sign-v2.png`(카드)/`overdue-run-v2.png`(히어로). 6h 이내 라벨 "긴급! N시간 남음"
- 모바일: 카드 버튼들 아래 줄로(.event-card 미디어쿼리 600px), 확대 잠금(viewport), .field 16px(아이폰 자동확대 방지)
- 마스코트 이미지에 여백 필수 (꽉 차면 잘려 보임). 원본 시트에서 자를 땐 배경 체크무늬가 가짜 투명일 수 있음

## 중요 교훈 (동기 계정 42시간 동기화 실패 사건)
- 원인: **코드 배포와 DB 마이그레이션 시차** — 새 코드는 배포됐는데 마이그레이션은 오늘에야 db push됨
- 규칙: 코드 배포와 `npx supabase db push`는 세트로. merge 전에 마이그레이션 먼저 적용
- 디버깅 경로: 대시보드 배너 → sources.last_sync_error 코드(Supabase Table Editor) → Netlify 함수 로그

## 워크플로 (sun이 익힘)
- feature/sun에서 작업 → push → GitHub PR → merge → **Netlify가 main만 자동 배포**
- 시작 전 `git fetch origin` + `git merge origin/main`. vim 뜨면 영어 모드 → Esc → :wq
- 폰 미리보기: `npm run dev -- -H 0.0.0.0` → 같은 와이파이 아이폰에서 Network 주소 접속
- PWA는 자동 갱신되지만 캐시 잔상 있음 → 완전 종료 후 재실행, 이미지 교체는 파일명 바꾸는 게 확실

## 환경변수 (.env.local + Netlify 동일하게 — Netlify에 CANVAS 3종 등록 완료)
SUPABASE 3종, VAPID 3종, NEXT_PUBLIC_SITE_URL, GEMINI_API_KEY, TOKEN_ENCRYPTION_KEY(로컬=Netlify 동일 필수), CANVAS_BASE_URL, NEXT_PUBLIC_CANVAS_BASE_URL (= https://khcanvas.khu.ac.kr)
- Gemini 키는 `AQ.` 형식이 정상. 429면 무료 한도 — flash-lite 유지

## 계정/인프라
- GitHub 조직 `aldama-team/tgthon-aldama` (remote 새 주소로 변경 완료. gh CLI 설치됨, sunmimn으로 로그인됨 — PR은 `gh pr create`, merge는 `gh pr merge --merge`)
- sun 계정 2개: sunmimn(Owner), Sunkim1234(Member) — 통일 권장
- Supabase(bnrxfrerbvkcqgfgyhwe)는 Taeksoo 소유. CLI: `npx supabase login`(브라우저 계정 주의) → link → db push
- Netlify: GitHub 연결로 main 자동 배포 작동 확인됨. PR엔 deploy-preview 체크가 붙음

## 다음 할 일
0. **(대화 시작점) 미배포 작업 마무리**: 갈피 개명 + 캘린더 기간 표시/확대가 커밋 전 상태. sun이 로컬 확인 중이었음 → 확인 끝나면 add/commit/push → `gh pr create` → `gh pr merge --merge`(gh CLI 설치·sunmimn 로그인 완료). 배포 후 폰 PWA 완전종료 재실행 + 공지분석 시작/마감 실전 시험("8/5 오후 3시 회의 + 8/7까지 보고서" 붙여넣기)
1. ~~Supabase Redirect URLs~~ 해결됨(2026-07-29 sun 확인). sun은 여전히 Developer 등급(Owner=Taeksoo) — 설정 바꿀 일 있으면 Taeksoo 경유
2. **퀴즈가 exam 카드로 들어오는지 확인** (진행 중 — 대시보드에 퀴즈 카드 뜨는 것까지 확인)
3. `.agents/`(임페커블 4만 줄)·루트 penguins.png 정리 PR — Taeksoo에게 요청했으나 아직 안 됨
4. 동기 계정 동기화 재확인 (마이그레이션 적용 후 성공했는지)
5. AI 과목 추측, "오늘 할 일" 브리핑, Resend SMTP, /share AI 캐시
6. 학교에 OAuth 개발자 키 제안 (완성품 들고)

## 출시 전 보안 정리 (채팅에 노출된 키들!)
- 재발급: SUPABASE_SECRET_KEY(최우선), GEMINI_API_KEY, VAPID 키들, sun Canvas 토큰(개발 끝나면 e-Campus에서 삭제)
- 규칙: .env.local 내용 채팅/캡처 금지, 토큰은 터미널→서비스로만

## 주의
- Claude 샌드박스가 git 돌리면 .git/index.lock 남을 수 있음 → 작업 후 확인
- 프로젝트 루트에 임시 이미지(penguins.png 등) 넣고 작업했으면 커밋 전 삭제
- 이메일 인증은 회사메일 불가, Gmail로. 무료 인증메일 시간당 2~4통
- 새 터미널은 `cd ~/projects/tgthon-aldama` 먼저
- Gemini 429 디버깅은 에러 본문 확인 (ai-parser가 사유 전문 남김)
