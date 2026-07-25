# 러닝엑스 배포 및 실제 계정 확인

## 배포 환경변수

- `CANVAS_BASE_URL=https://khcanvas.khu.ac.kr`: 서버의 Canvas API 주소
- `NEXT_PUBLIC_CANVAS_BASE_URL=https://khcanvas.khu.ac.kr`: 토큰 발급 안내 링크 주소
- `TOKEN_ENCRYPTION_KEY`: `openssl rand -base64 32`로 생성한 32바이트 키. 서버와 Netlify 함수에 동일한 값을 등록
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: 브라우저용 publishable key
- `SUPABASE_SECRET_KEY`: Netlify 예약 함수에서만 사용하는 서버용 Secret Key

실제 키는 `.env.local`, 로그, URL, 이슈 또는 채팅에 붙여넣지 않는다.

## 실제 계정 통합 테스트

1. `https://khcanvas.khu.ac.kr/profile/settings`에서 테스트용 개인 액세스 토큰을 만든다.
2. 알다마 `/connect/learnx`에서 토큰을 붙여넣고 사용자 검증 및 첫 동기화 성공을 확인한다.
3. 미래 마감 과제와 퀴즈가 각각 과제/시험 카드로 생성되는지 확인한다.
4. 개인 캘린더와 활성 강좌 캘린더에 미래 일정을 직접 추가한 뒤 시작·마감시간이 분리된 일반 일정 카드로 생성되는지 확인한다.
5. 같은 계정으로 `지금 동기화`를 두 번 실행해 카드 수가 증가하지 않는지 확인한다.
6. 값이 바뀌지 않은 두 번째 동기화의 `updated_count`가 0인지 확인한다.
7. Canvas에서 과제 또는 캘린더 일정의 제목·시간을 바꾼 뒤 기존 카드가 갱신되는지 확인한다.
8. 알다마에서 러닝엑스 카드의 제목·과목·유형·시작·마감을 수정하고 동기화해도 수정값이 유지되는지 확인한다.
9. `원본으로 되돌리기`를 누르면 Canvas 원본 값으로 복원되는지 확인한다.
10. Canvas에서 캘린더 일정을 삭제한 뒤 동기화하면 해당 카드만 숨겨지는지 확인한다.
11. 조회 범위 안의 일정을 미래 365일 밖으로 옮긴 뒤 동기화해도 숨겨지지 않고 새 시간으로 갱신되는지 확인한다.
12. 누락 일정의 단건 확인이 429/5xx/네트워크 오류로 실패하면 기존 카드가 유지되는지 확인한다.
13. 알다마에서 카드를 수동 완료한 뒤 Canvas가 미제출 상태여도 완료가 유지되는지 확인한다.
14. Canvas에서 제출한 과제가 `submitted`, `graded`, `pending_review` 상태일 때 완료되는지 확인한다.
15. 러닝엑스 카드를 삭제(숨김)한 뒤 다시 동기화해도 나타나지 않는지 확인한다.
16. 유효하지 않은 토큰은 재연결 안내, 네트워크/429/5xx는 기존 카드를 유지하는 일시 오류 안내로 구분되는지 확인한다.
17. 연결 해제 뒤 기존 일정 카드가 남고, Canvas source와 암호문만 삭제되는지 확인한다.
18. Netlify 함수 로그에서 `sync-canvas`가 한 시간마다 실행되고 한 source 실패 후에도 다른 source를 계속 처리하는지 확인한다.

개인 액세스 토큰이 제공되지 않은 개발 환경에서는 위 항목 대신 모킹 단위 테스트까지만 수행한다.
