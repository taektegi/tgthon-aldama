# 알다마

흩어진 대학 공지와 과제 마감을 일정 카드로 정리하는 T.G.Thon MVP입니다.

## 포함된 스캐폴드

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase SSR Auth (publishable key, cookie session, `proxy.ts`)
- `profiles`, `sources`, `events`, `sync_runs` 테이블
- 명시적 Data API 권한과 사용자 소유권 기반 RLS
- FK/부분/중복 방지 인덱스
- 로그인, 회원가입, 일정 생성·완료·삭제 화면
- 인증이 필요한 `sync-ical`, `sync-notices` Edge Function 뼈대

## 시작하기

```bash
npm install
cp .env.example .env.local
npm run supabase:start
npm run supabase:reset
npm run dev
```

로컬 Supabase가 출력하는 URL과 publishable key를 `.env.local`에 넣습니다. 현재 `.env.local`은 호스팅된 알다마 프로젝트 값으로 설정되어 있으며 Git에서 제외됩니다.

## 데이터베이스 변경

마이그레이션은 `supabase/migrations`에서 관리합니다. 새 변경은 다음처럼 만듭니다.

```bash
npx supabase migration new descriptive_name
```

원격 반영 전에는 로컬 reset, 앱 타입 검사, Supabase Security/Performance Advisor를 모두 통과해야 합니다.

## 보안 메모

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 브라우저에 노출합니다.
- Secret Key는 `NEXT_PUBLIC_` 환경변수에 두지 않습니다.
- iCal URL은 평문 저장을 전제로 하지 않습니다. `feed_url_ciphertext`의 암복호화 방식은 동기화 구현 시 확정합니다.
- Edge Functions는 JWT 검증을 켜고 배포하는 것을 전제로 합니다.
