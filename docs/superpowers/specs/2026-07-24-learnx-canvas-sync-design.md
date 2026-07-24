# 러닝엑스(Canvas) 과제 자동 동기화 — 설계

날짜: 2026-07-24 / 승인: sun

## 목적

경희대 LearningX(`khcanvas.khu.ac.kr`, Canvas LMS 기반)의 과제와 캘린더 일정을 알다마 카드로
자동 동기화한다. 새 항목은 자동 추가, 러닝엑스에서 과제를 제출하면 카드 자동 완료.
읽기 전용 연동 — 알다마에서의 변경은 Canvas로 역반영하지 않는다.

## 인증 방식

Canvas 개인 액세스 토큰 (사용자가 LearningX 설정에서 직접 발급, 30초 1회).
- 학교 협조 없이 가능한 유일한 정식 방법. OAuth는 학교 개발자 키 승인 필요 →
  v1 출시 후 학교에 제안. 승인 시 연결 페이지만 교체하면 됨(동기화 로직 재사용).
- 토큰은 서버에서만 취급. AES-GCM으로 암호화해 저장(키: 환경변수
  `TOKEN_ENCRYPTION_KEY`). 브라우저에는 절대 전달하지 않는다.
- 아이디/비밀번호 수집 방식은 보안상 금지.

## 데이터 모델 (기존 스키마 재사용)

- `sources`: type enum에 `"canvas"` 추가. 토큰 암호문은 `feed_url_ciphertext`
  컬럼 재사용(이름이 안 맞으므로 마이그레이션에서 `credential_ciphertext`로
  rename). `last_synced_at`, `status`("error" = 토큰 무효) 그대로 사용.
- `events`: 과제는 `external_uid = "canvas:{assignment_id}"`, 캘린더 일정은
  `external_uid = "canvas:event:{event_id}"`로 구분해 중복 방지 upsert.
  캘린더 일정의 `start_at`은 `starts_at`, `end_at`은 `due_at`에 저장한다.
  `subject` = 과목명, `due_at` = 마감일(KST 헬퍼 `src/lib/datetime.ts` 경유),
  `event_type` = "assignment", `is_completed` = 제출 여부.
- `events`에 `is_hidden boolean` 컬럼 추가: 동기화 카드는 삭제 대신 숨김
  (삭제하면 다음 동기화 때 되살아나므로).
- `events.override_fields text[]`: 알다마에서 사용자가 직접 바꾼 `title`, `subject`,
  `event_type`, `starts_at`, `due_at`을 기록해 이후 동기화에서 보호한다.
- `sync_runs`: 동기화 결과 기록(기존 그대로).

## 동기화 로직 (Next.js Route Handler `/api/canvas/sync`)

1. 사용자의 canvas source 조회 → 토큰 복호화
2. `GET /api/v1/courses?enrollment_state=active` 수강 과목 목록
3. 과목별 `GET /api/v1/courses/{id}/assignments?include[]=submission&bucket=future`
   (+ 최근 마감 포함 위해 `bucket` 대신 due_at 필터 검토는 구현 단계에서)
4. 개인 캘린더와 활성 과목 캘린더를 `GET /api/v1/calendar_events?type=event`로 조회
   (Canvas 제한에 맞춰 과목 context는 10개씩 분할, 조회 범위는 과거 30일~미래 365일)
5. Canvas ID 기반 `external_uid`로 기존 카드를 찾고, 실제 값이 달라진 필드만 갱신한다.
   `override_fields`에 기록된 사용자 수정 필드는 건너뛴다. `submission.workflow_state`가
   submitted/graded면 `is_completed = true`
6. 마감일 없는 과제와 시작 시간이 없는 캘린더 일정은 제외. 지난 항목은 신규 추가하지 않음
   (이미 있는 카드는 갱신)
7. `sync_runs` 기록, `sources.last_synced_at` 갱신
8. 401 응답(토큰 무효) → `sources.status = "error"`
9. 조회 범위 안의 기존 `canvas:event:*` 카드가 목록에서 사라지면 ID 단건 API로 재확인한다.
   404 또는 `workflow_state=deleted`일 때만 `is_hidden = true`로 숨기고, 범위 밖으로
   이동한 일정은 새 시간으로 갱신한다. 단건 확인이 일시 실패하면 기존 카드를 유지한다.
10. `starts_at`과 `due_at`은 ISO 문자열이 아니라 실제 UTC 시각으로 비교해 `Z`와
    `+00:00`처럼 표기만 다른 동일 시간을 불필요하게 갱신하지 않는다.

## 실행 트리거 (하이브리드)

- 대시보드 로드 시: 마지막 동기화 10분 경과 시 자동 호출
- 수동 [지금 동기화] 버튼
- Netlify Scheduled Function(1시간마다): 연결된 전체 사용자 순회 동기화
  (기존 `send-due-reminders.mts` 패턴 재사용, service role 사용)

## UI

- 설정/대시보드에 [러닝엑스 연결] → 연결 페이지:
  [e-Campus 설정 열기] 딥링크 버튼 + 스크린샷 3단계 안내 + 토큰 입력칸 →
  [연결하기] → 서버 검증(`GET /api/v1/users/self`) → 성공 시 이름 표시,
  즉시 첫 동기화 → "일정 N개를 가져왔어요" → 대시보드
- 연결 후 설정: "연결됨 · 마지막 동기화 N분 전" + [지금 동기화] + [연결 해제]
- 카드에 러닝엑스 출처 배지. 동기화 카드는 삭제 → 숨김으로 동작
- 사용자가 연동 카드를 수정하면 해당 필드를 보호하고 `사용자 수정됨` 배지를 표시한다.
  [원본으로 되돌리기]는 보호 목록을 비운 뒤 즉시 다시 동기화한다.
- 연결 오류 시 대시보드 배너: "러닝엑스 연결이 끊겼어요, 다시 연결해주세요"

## 에러 처리

- 토큰 검증 실패: "토큰이 올바르지 않아요" 인라인 표시
- 동기화 중 Canvas 다운/타임아웃: sync_runs failed 기록, 기존 카드 유지
- Rate limit: 과목 수만큼 순차 호출(경희대 학생 5~8과목이라 문제 없음)

## 테스트

- 매핑 함수(과제·캘린더 JSON → events row) 단위 테스트: 시간 및 유형 변환,
  제출 상태 매핑, 날짜 없음/과거 필터
- 토큰 암복호화 round-trip 테스트
- 실계정 통합 확인: sun 계정으로 연결 → 카드 생성 → 러닝엑스 제출 → 완료 반영

## 범위 제외 (v1)

- OAuth 로그인(학교 승인 후), 푸시 알림, Canvas로의 역반영(제출/완료), 공지 동기화.
  퀴즈는 assignments API에 포함되는 경우 시험 카드로 동기화한다.
