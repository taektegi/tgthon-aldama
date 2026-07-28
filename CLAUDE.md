# 알다마 (ALDAMA) — 작업 인수인계

대학생 공지→할일 카드 앱. sun(초보, 학습 목적: 깃/Supabase/코드분리)과 친구 Taeksoo 협업.
sun에게는 모든 명령어/개념에 "왜"를 비유로 쉽게 설명해줄 것. 코드는 같이 만들되 커밋/push는 sun이 직접.

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
- GitHub 조직 `aldama-team/tgthon-aldama` (sun 로컬 remote는 구주소지만 리다이렉트로 작동 중 — `git remote set-url origin https://github.com/aldama-team/tgthon-aldama.git` 권장)
- sun 계정 2개: sunmimn(Owner), Sunkim1234(Member) — 통일 권장
- Supabase(bnrxfrerbvkcqgfgyhwe)는 Taeksoo 소유. CLI: `npx supabase login`(브라우저 계정 주의) → link → db push
- Netlify: GitHub 연결로 main 자동 배포 작동 확인됨. PR엔 deploy-preview 체크가 붙음

## 다음 할 일
1. **Supabase Redirect URLs 수정 — Taeksoo 대기 중**: Site URL이 localhost로 확인됨(2026-07-27). sun은 Developer 등급이라 못 바꿈 → Taeksoo(Owner)에게 승격 or 직접 수정 요청함. Site URL=`https://tgthon-aldama.netlify.app`, Redirect URLs에 `https://tgthon-aldama.netlify.app/**`+`http://localhost:3000/**`
2. **퀴즈가 exam 카드로 들어오는지 확인** (진행 중 — 대시보드에 퀴즈 카드 뜨는 것까지 확인)
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
