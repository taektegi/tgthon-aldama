# 갈피

> 흩어진 대학 공지를 놓치지 않을 일정으로.

갈피는 LearningX, 학교 공지, 이메일과 단체 채팅방 등에 흩어진 날짜와 할 일을 일정 카드로 정리해 주는 대학생 일정 관리 서비스입니다.

학생이 공지마다 날짜를 찾아 캘린더에 다시 입력하는 번거로움을 줄이고, 중요한 일정을 D-day와 마감 알림으로 끝까지 관리할 수 있도록 돕습니다.

## 핵심 기능

- **다양한 일정 추가**: 직접 입력, 공지 복사·붙여넣기, 이미지 분석, LearningX 연동을 지원합니다.
- **공지 분석과 확인**: Gemini가 공지에서 날짜와 할 일을 찾고, 사용자가 결과를 확인·수정한 뒤 저장합니다. 텍스트 AI 분석이 실패하면 기본 분석기로 전환합니다.
- **일정 카드와 D-day**: 시작 시간과 마감 시간 중 기준을 선택해 D-day, 긴급도 색상과 우선 일정을 표시합니다.
- **일정 관리**: 목록과 월간 캘린더에서 일정을 확인하고 수정, 완료, 되돌리기, 삭제할 수 있습니다.
- **LearningX 동기화**: Canvas 기반 LearningX의 과제와 캘린더 일정을 가져오고 변경 내용을 동기화합니다.
- **마감 알림**: 마감 24시간·6시간·3시간·1시간 전에 Web Push 알림을 제공합니다.

## 주요 화면과 사용 흐름

1. **일정 추가**에서 직접 입력하거나 공지 텍스트·이미지를 분석합니다.
2. 분석된 제목과 시작·마감 시간을 확인하고 필요한 내용을 수정합니다.
3. 저장된 일정은 **오늘의 일정**에서 카드와 D-day로 관리합니다.
4. **캘린더**에서 날짜별 일정과 일정 유형을 확인합니다.
5. 알림을 허용하면 마감이 가까워졌을 때 푸시 알림을 받습니다.

## 차별점

| 서비스 | 일정을 다루는 방식 |
| --- | --- |
| 일반 캘린더 | 사용자가 이미 알고 있는 일정을 직접 입력하고 관리합니다. |
| LearningX | LMS 안의 수업과 과제 일정을 확인합니다. |
| 갈피 | 여러 경로의 공지를 가져와 행동할 수 있는 하나의 일정 카드로 통합합니다. |

## 기술 스택

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js Server Actions, Supabase Auth, PostgreSQL, Row Level Security
- **AI**: Google Gemini Flash Lite, 정규식 기반 기본 분석기
- **Integration**: LearningX Canvas API
- **Notification**: Service Worker, Web Push, VAPID
- **Deployment**: Netlify, Supabase Cloud
- **Test**: Vitest, ESLint, TypeScript

## 실행 방법

### 준비 사항

- Node.js 22 이상
- Supabase 프로젝트 또는 Docker Desktop을 이용한 로컬 Supabase

### 프론트엔드 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에 사용할 Supabase 프로젝트의 URL과 publishable key를 설정한 뒤 [http://localhost:3000](http://localhost:3000)으로 접속합니다.

AI 기반 텍스트·이미지 분석을 사용하려면 `.env.local`에 `GEMINI_API_KEY`를 추가해야 합니다. LearningX 연동과 푸시 알림에 필요한 나머지 환경변수는 `.env.example`을 참고하세요. 실제 비밀키는 저장소에 커밋하지 않습니다.

### Supabase까지 로컬에서 실행

Docker Desktop을 실행한 뒤 다음 명령을 사용합니다.

```bash
npm run supabase:start
npm run supabase:reset
npm run dev
```

`supabase:start`가 출력하는 로컬 URL과 publishable key를 `.env.local`에 입력합니다. Netlify 예약 함수로 동작하는 LearningX 자동 동기화와 푸시 발송은 `npm run dev`만으로 자동 실행되지 않습니다.

### 검증

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

---
