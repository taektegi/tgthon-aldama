# 알다마 (ALDAMA) — 작업 인수인계

대학생 공지→할일 카드 앱. sun(초보, 학습 목적: 깃/Supabase/코드분리)과 친구 Taeksoo 협업.
sun에게는 모든 명령어/개념에 "왜"를 비유로 쉽게 설명해줄 것. 코드는 같이 만들되 커밋/push는 sun이 직접.

## 스택/구조
- Next.js App Router + TS + Supabase(호스팅) + Gemini AI(공지 분석, `src/lib/ai-parser.ts`, 모델 `gemini-flash-lite-latest`)
- 패턴: 페이지=서버 컴포넌트, 상호작용 조각만 "use client". 테스트: vitest (`npm test`)
- 디자인: 민트+펭귄 마스코트(`public/mascot/*.png`), 테마변수 `globals.css`, 클래스 shell/card/button/field
- 시간대: KST 헬퍼 `src/lib/datetime.ts`. 단 Canvas due_at은 UTC ISO 그대로 저장

## 러닝엑스(Canvas) 연동 — 2026-07-24 완성
- 경희대 e-Campus = Canvas LMS. **진짜 API 주소: https://khcanvas.khu.ac.kr** (e-campus.khu.ac.kr 아님!)
- 방식: 학생이 발급한 액세스 토큰 (OAuth는 학교 승인 필요 → 출시 후 제안 예정)
- 구조: `src/lib/canvas/{api,mapping,sync}.ts` + `src/lib/crypto.ts`(AES-GCM 토큰 암호화)
  - 연결: `/connect/learnx` (검증→암호화 저장→첫 동기화)
  - 동기화: 앱 열 때(10분 경과 시, `LearnXSync.tsx`) + 수동 버튼 + `netlify/functions/sync-canvas.mts`(1시간마다)
  - 규칙: 제출→자동완료(역방향 없음), 연동카드 삭제=is_hidden(부활 방지), 마감 지난 새 과제 무시, 퀴즈→exam
- 설계/계획 문서: `docs/superpowers/specs/`, `docs/superpowers/plans/`

## 오늘 추가된 것들
- `/settings` 페이지: 기본화면 토글(캘린더/할일 스위치), 러닝엑스 관리, 로그아웃(대시보드에서 이사)
- 대시보드: [⚙️ 설정] 버튼, 러닝엑스 배지, 연결 끊김 배너, 동기화 상태
- DB: sources.type에 'canvas', feed_url_ciphertext→credential_ciphertext 리네임, events.is_hidden (마이그레이션 20260724000000, 원격 적용됨)

## 환경변수 (.env.local + Netlify 동일하게)
기존: SUPABASE 3종, VAPID 3종, NEXT_PUBLIC_SITE_URL, GEMINI_API_KEY
신규: TOKEN_ENCRYPTION_KEY(로컬=Netlify 동일 필수!), CANVAS_BASE_URL, NEXT_PUBLIC_CANVAS_BASE_URL (= https://khcanvas.khu.ac.kr)
- Gemini 키는 2026년부터 `AQ.` 형식이 정상 (AIza 아님!). 429 나면 무료 한도 — flash-lite 유지할 것

## 계정/인프라 (중요, 헷갈림 주의)
- **GitHub 조직 `aldama-team`으로 저장소 이전 완료** (구 taektegi/tgthon-aldama)
- sun의 GitHub 계정 2개: sunmimn(조직 Owner, Install 가능), Sunkim1234(Member, 커밋용) — 통일 권장
- 로컬 remote 갱신 필요했음: `git remote set-url origin https://github.com/aldama-team/tgthon-aldama.git` (확인: `git remote -v`)
- Supabase 프로젝트(bnrxfrerbvkcqgfgyhwe)는 Taeksoo 소유, sun의 "다른 계정"이 멤버. CLI: `npx supabase login`(브라우저 계정 주의!) → link → db push
- Netlify: GitHub 연결로 전환 중이었음 (기존엔 CLI 수동배포)

## 다음 할 일 (마지막 세션이 여기서 끊김)
1. **Netlify 배포 확인**: Deploys에서 Published 뜨는지, https://tgthon-aldama.netlify.app 에서 [⚙️ 설정] 보이면 신버전. 실패 시 빌드 로그 확인
2. Supabase Redirect URLs에 `https://tgthon-aldama.netlify.app/**` + Site URL 설정 (확인 필요)
3. 배포판에서 최종 시험: 로그인 → 러닝엑스 연결 → 카드 생성/자동완료
4. 퀴즈가 카드로 들어오는지 확인해서 sun에게 보고하기로 약속함 (아직 미확인)
5. "오늘 할 일" 브리핑, AI 과목 추측, 아이폰 단축어 안내, Resend SMTP, /share AI 결과 캐시(무료 한도 절약)
6. 학교에 OAuth 개발자 키 제안 (완성품 들고, 공식 채널로)

## 출시 전 보안 정리 (전부 채팅에 노출됨!)
- 재발급 필요: GEMINI_API_KEY, SUPABASE_SECRET_KEY(최우선), VAPID 키들, sun의 Canvas 토큰(개발 끝나면 e-Campus에서 삭제)
- intern-dashboard 토큰 정리(기존 항목)
- 규칙: .env.local 내용은 채팅/캡처 금지, 토큰은 터미널→서비스로만 이동

## 주의
- Claude 샌드박스가 git 돌리면 .git/index.lock 남음 → 작업 후 rm
- 이메일 인증은 회사메일 불가(보안스캐너), Gmail로 테스트. 무료 인증메일 시간당 2~4통
- 새 터미널은 홈에서 시작 → `cd ~/projects/tgthon-aldama` 먼저
- Gemini 429 디버깅 시 에러 본문 확인 (ai-parser가 이제 사유 전문을 남김)
