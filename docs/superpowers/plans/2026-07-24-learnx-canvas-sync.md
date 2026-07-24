# 러닝엑스(Canvas) 과제 자동 동기화 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 경희대 e-Campus(Canvas LMS)의 과제를 알다마 카드로 자동 동기화 — 새 과제 자동 추가, 제출 시 자동 완료.

**Architecture:** 사용자가 발급한 Canvas 액세스 토큰을 AES-GCM으로 암호화해 `sources`에 저장. 동기화 코어(`src/lib/canvas/`)를 서버 액션(연결/수동/접속 시)과 Netlify 예약 함수(1시간마다)가 공유. `events`에 `external_uid = "canvas:{id}"`로 upsert해 중복 방지.

**Tech Stack:** Next.js 16 App Router, TS, Supabase(호스팅), zod v4, vitest(신규 devDep), Netlify Scheduled Functions.

## Global Constraints

- 커밋/push는 **sun이 직접** 실행한다. 각 Task의 Commit 스텝은 sun에게 명령어를 보여주고 실행을 기다린다.
- 토큰 평문은 서버 메모리에서만 존재. 로그·클라이언트·DB에 평문 금지.
- 페이지=서버 컴포넌트, 상호작용 조각만 `"use client"`.
- 날짜 입력칸 값은 `src/lib/datetime.ts` 헬퍼 사용. 단, Canvas API의 `due_at`은 이미 UTC ISO 문자열이므로 변환 없이 그대로 저장한다(변환하면 오히려 시간이 틀어짐).
- UI 문구는 한국어. 기존 민트+펭귄 테마 변수(globals.css) 사용.
- 새 환경변수: `TOKEN_ENCRYPTION_KEY`(서버 전용), `CANVAS_BASE_URL`(서버 전용), `NEXT_PUBLIC_CANVAS_BASE_URL`(연결 안내 링크용). Netlify에도 등록 필요.
- Claude 샌드박스에서 git 명령 실행 시 작업 후 `.git/index.lock` 제거.

---

### Task 0: Canvas API 주소 확인 (코드 없음, 5분)

경희대는 e-campus.khu.ac.kr(포털)과 실제 Canvas 서버 주소가 다를 수 있다. sun의 토큰으로 어느 주소가 API에 응답하는지 확인한다.

- [ ] **Step 1: sun이 토큰 1개 발급** — e-Campus 설정 → "+ 새 액세스 토큰", 목적 "알다마 개발", 만료일 비움.
- [ ] **Step 2: 두 주소에 curl 테스트 (sun 터미널에서 — 토큰을 채팅에 붙여넣지 말 것)**

```bash
curl -s -H "Authorization: Bearer <토큰>" https://e-campus.khu.ac.kr/api/v1/users/self | head -c 300
curl -s -H "Authorization: Bearer <토큰>" https://canvas.khu.ac.kr/api/v1/users/self | head -c 300
```

JSON으로 `{"id":..., "name":"..."}`가 나오는 주소가 정답. 이후 모든 Task에서 그 주소를 `CANVAS_BASE_URL`로 사용.

- [ ] **Step 3: .env.local에 추가**

```bash
CANVAS_BASE_URL=https://<확인된 주소>
NEXT_PUBLIC_CANVAS_BASE_URL=https://<확인된 주소>
```

---

### Task 1: vitest 테스트 환경 구축

**Files:**
- Modify: `package.json` (devDep + script)
- Create: `vitest.config.ts`
- Test: `src/lib/datetime.test.ts` (러너 동작 확인용 스모크 테스트)

**Interfaces:**
- Produces: `npm test`로 `src/**/*.test.ts` 실행 가능. 이후 모든 Task가 사용.

- [ ] **Step 1: vitest 설치**

```bash
npm install -D vitest
```

- [ ] **Step 2: `vitest.config.ts` 작성**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 3: package.json scripts에 추가**

```json
"test": "vitest run"
```

- [ ] **Step 4: 스모크 테스트 작성** — `src/lib/datetime.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { parseKstLocal } from "./datetime";

describe("parseKstLocal", () => {
  it("KST 입력을 UTC로 변환한다", () => {
    expect(parseKstLocal("2026-07-30T15:00").toISOString()).toBe("2026-07-30T06:00:00.000Z");
  });
});
```

- [ ] **Step 5: 실행 확인** — Run: `npm test` / Expected: 1 passed
- [ ] **Step 6: Commit (sun 실행)**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/datetime.test.ts
git commit -m "chore: vitest 테스트 환경 추가"
```

---

### Task 2: DB 마이그레이션 — canvas 소스 타입, is_hidden

**Files:**
- Create: `supabase/migrations/20260724000000_canvas_source.sql`
- Modify: `src/lib/database.types.ts`
- Modify: `supabase/functions/sync-ical/index.ts` (컬럼명 변경 반영, 2곳)

**Interfaces:**
- Produces: `sources.type`에 `"canvas"` 허용, `sources.credential_ciphertext`(구 feed_url_ciphertext), `events.is_hidden: boolean`(default false). 이후 모든 Task가 이 스키마를 전제.

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- canvas 소스 타입 추가 + 토큰도 담을 수 있게 컬럼명 일반화
alter table public.sources rename column feed_url_ciphertext to credential_ciphertext;

alter table public.sources drop constraint sources_type_check;
alter table public.sources add constraint sources_type_check
  check (type in ('ical', 'school_notice', 'pasted_text', 'canvas'));

alter table public.sources drop constraint sources_feed_url_required_for_ical;
alter table public.sources add constraint sources_credential_required
  check (type not in ('ical', 'canvas') or credential_ciphertext is not null);

-- 동기화 카드는 삭제 대신 숨김 (삭제하면 다음 동기화 때 되살아나므로)
alter table public.events add column is_hidden boolean not null default false;
```

- [ ] **Step 2: `database.types.ts` 갱신** — sources의 `type`에 `"canvas"` 추가, `feed_url_ciphertext` → `credential_ciphertext` 이름 변경(Row/Insert 모두), events Row/Insert에 `is_hidden: boolean` / `is_hidden?: boolean` 추가.
- [ ] **Step 3: `sync-ical/index.ts`의 `feed_url_ciphertext` 참조 2곳을 `credential_ciphertext`로 변경.**
- [ ] **Step 4: 타입 확인** — Run: `npm run typecheck` / Expected: 에러 없음
- [ ] **Step 5: 호스팅 DB에 적용 (sun 실행)** — Run: `npx supabase db push` / Expected: 마이그레이션 1건 적용. (왜 push냐면: 우리는 로컬 DB가 아니라 호스팅 Supabase를 쓰므로, 마이그레이션 파일을 원격에 밀어 넣는 명령이 필요)
- [ ] **Step 6: Commit (sun 실행)**

```bash
git add supabase/migrations/20260724000000_canvas_source.sql src/lib/database.types.ts supabase/functions/sync-ical/index.ts
git commit -m "feat: canvas 소스 타입 및 events.is_hidden 마이그레이션"
```

---

### Task 3: 토큰 암호화 헬퍼

**Files:**
- Create: `src/lib/crypto.ts`
- Test: `src/lib/crypto.test.ts`

**Interfaces:**
- Produces: `encryptSecret(plain: string): string`, `decryptSecret(ciphertext: string): string`. 환경변수 `TOKEN_ENCRYPTION_KEY`(base64, 32바이트) 필요. Task 6·7이 사용.

- [ ] **Step 1: 키 생성 후 .env.local에 추가 (sun 실행)**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# 출력값을 .env.local에: TOKEN_ENCRYPTION_KEY=<출력값>
```

(왜 암호화하냐면: DB가 유출돼도 토큰 평문이 없으면 남의 e-Campus에 접근할 수 없다. 키는 DB 밖(환경변수)에 있으므로 둘 다 뚫려야 위험해짐.)

- [ ] **Step 2: 실패하는 테스트 작성** — `src/lib/crypto.test.ts`

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encryptSecret/decryptSecret", () => {
  it("암호화 후 복호화하면 원문이 나온다", async () => {
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const secret = "canvas-token-1234~ABC";
    const cipher = encryptSecret(secret);
    expect(cipher).not.toContain(secret);
    expect(decryptSecret(cipher)).toBe(secret);
  });

  it("같은 평문도 매번 다른 암호문 (IV 무작위)", async () => {
    const { encryptSecret } = await import("./crypto");
    expect(encryptSecret("a")).not.toBe(encryptSecret("a"));
  });

  it("변조된 암호문은 복호화가 실패한다", async () => {
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const cipher = encryptSecret("a");
    const tampered = Buffer.from(cipher, "base64");
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptSecret(tampered.toString("base64"))).toThrow();
  });
});
```

- [ ] **Step 3: 실패 확인** — Run: `npm test -- crypto` / Expected: FAIL (crypto.ts 없음)
- [ ] **Step 4: 구현** — `src/lib/crypto.ts`

```ts
// 토큰 등 비밀값을 DB에 넣기 전 AES-256-GCM으로 암호화한다.
// 저장 형식: base64( IV(12) | authTag(16) | ciphertext )
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64)");
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptSecret(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 5: 통과 확인** — Run: `npm test -- crypto` / Expected: 3 passed
- [ ] **Step 6: Commit (sun 실행)**

```bash
git add src/lib/crypto.ts src/lib/crypto.test.ts
git commit -m "feat: 토큰 AES-GCM 암호화 헬퍼"
```

---

### Task 4: Canvas API 클라이언트

**Files:**
- Create: `src/lib/canvas/api.ts`
- Test: `src/lib/canvas/api.test.ts`

**Interfaces:**
- Produces:
  - `class CanvasAuthError extends Error`
  - `fetchSelf(token: string): Promise<CanvasUser>` — `{ id: number; name: string }`
  - `fetchActiveCourses(token: string): Promise<CanvasCourse[]>` — `{ id: number; name: string }`
  - `fetchCourseAssignments(token: string, courseId: number): Promise<CanvasAssignment[]>` — `{ id: number; name: string; due_at: string | null; html_url: string; is_quiz_assignment?: boolean; submission?: { workflow_state: string } | null }`
- Consumes: 환경변수 `CANVAS_BASE_URL`.

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/canvas/api.test.ts` (실서버 대신 fetch를 가짜로 갈아끼워 테스트)

```ts
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => { process.env.CANVAS_BASE_URL = "https://canvas.example.com"; });
afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("canvas api", () => {
  it("fetchSelf는 사용자 정보를 반환한다", async () => {
    const mock = stubFetch(200, { id: 7, name: "Sun Min" });
    const { fetchSelf } = await import("./api");
    expect(await fetchSelf("tok")).toEqual({ id: 7, name: "Sun Min" });
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe("https://canvas.example.com/api/v1/users/self");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("401이면 CanvasAuthError를 던진다", async () => {
    stubFetch(401, { errors: [] });
    const { fetchSelf, CanvasAuthError } = await import("./api");
    await expect(fetchSelf("bad")).rejects.toBeInstanceOf(CanvasAuthError);
  });

  it("fetchCourseAssignments는 submission 포함 목록을 반환한다", async () => {
    stubFetch(200, [{ id: 1, name: "HW1", due_at: null, html_url: "u", submission: { workflow_state: "unsubmitted" } }]);
    const { fetchCourseAssignments } = await import("./api");
    const list = await fetchCourseAssignments("tok", 55);
    expect(list[0].name).toBe("HW1");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- canvas/api` / Expected: FAIL
- [ ] **Step 3: 구현** — `src/lib/canvas/api.ts`

```ts
// Canvas REST API 최소 클라이언트. 토큰은 호출자에게 받아 헤더로만 사용한다.
export class CanvasAuthError extends Error {}

export type CanvasUser = { id: number; name: string };
export type CanvasCourse = { id: number; name: string };
export type CanvasAssignment = {
  id: number;
  name: string;
  due_at: string | null; // UTC ISO — 그대로 저장하면 됨
  html_url: string;
  is_quiz_assignment?: boolean;
  submission?: { workflow_state: string } | null;
};

function baseUrl(): string {
  const url = process.env.CANVAS_BASE_URL;
  if (!url) throw new Error("CANVAS_BASE_URL is not set");
  return url.replace(/\/$/, "");
}

async function canvasFetch<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new CanvasAuthError("invalid canvas token");
  if (!response.ok) throw new Error(`canvas api ${response.status}: ${path}`);
  return (await response.json()) as T;
}

export function fetchSelf(token: string): Promise<CanvasUser> {
  return canvasFetch<CanvasUser>(token, "/api/v1/users/self");
}

export function fetchActiveCourses(token: string): Promise<CanvasCourse[]> {
  return canvasFetch<CanvasCourse[]>(token, "/api/v1/courses?enrollment_state=active&per_page=100");
}

export function fetchCourseAssignments(token: string, courseId: number): Promise<CanvasAssignment[]> {
  return canvasFetch<CanvasAssignment[]>(
    token,
    `/api/v1/courses/${courseId}/assignments?include[]=submission&per_page=100&order_by=due_at`,
  );
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- canvas/api` / Expected: 3 passed
- [ ] **Step 5: Commit (sun 실행)**

```bash
git add src/lib/canvas/api.ts src/lib/canvas/api.test.ts
git commit -m "feat: Canvas API 클라이언트"
```

---

### Task 5: 과제 → 카드 매핑 + 동기화 판단 (순수 함수)

**Files:**
- Create: `src/lib/canvas/mapping.ts`
- Test: `src/lib/canvas/mapping.test.ts`

**Interfaces:**
- Consumes: Task 4의 `CanvasAssignment`.
- Produces:
  - `isSubmitted(state: string | undefined | null): boolean` — submitted/graded/pending_review → true
  - `toEventRow(a: CanvasAssignment, courseName: string, userId: string, sourceId: string): EventUpsertRow | null` — `due_at` 없으면 null. `EventUpsertRow = { user_id; source_id; external_uid; title; subject; event_type: "assignment" | "exam"; due_at; source_url; is_completed; completed_at }` (퀴즈면 event_type "exam")
  - `planChanges(rows: EventUpsertRow[], existing: Map<string, { id: string; is_completed: boolean }>, now: Date): { toInsert: EventUpsertRow[]; toUpdate: Array<{ id: string; patch: Partial<EventUpsertRow> }> }`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/canvas/mapping.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { isSubmitted, planChanges, toEventRow } from "./mapping";
import type { CanvasAssignment } from "./api";

const base: CanvasAssignment = {
  id: 42, name: "3주차 과제", due_at: "2026-08-01T14:59:00Z",
  html_url: "https://c/a/42", submission: { workflow_state: "unsubmitted" },
};

describe("isSubmitted", () => {
  it.each([["submitted", true], ["graded", true], ["pending_review", true], ["unsubmitted", false], [undefined, false]])(
    "%s → %s", (state, expected) => expect(isSubmitted(state as string)).toBe(expected),
  );
});

describe("toEventRow", () => {
  it("과제를 events 행으로 매핑한다", () => {
    const row = toEventRow(base, "자료구조", "user-1", "src-1")!;
    expect(row).toMatchObject({
      external_uid: "canvas:42", title: "3주차 과제", subject: "자료구조",
      event_type: "assignment", due_at: "2026-08-01T14:59:00Z", is_completed: false,
    });
  });
  it("마감일 없으면 null", () => {
    expect(toEventRow({ ...base, due_at: null }, "c", "u", "s")).toBeNull();
  });
  it("제출됨 → is_completed true + completed_at 설정", () => {
    const row = toEventRow({ ...base, submission: { workflow_state: "graded" } }, "c", "u", "s")!;
    expect(row.is_completed).toBe(true);
    expect(row.completed_at).not.toBeNull();
  });
  it("퀴즈는 exam 유형으로", () => {
    expect(toEventRow({ ...base, is_quiz_assignment: true }, "c", "u", "s")!.event_type).toBe("exam");
  });
});

describe("planChanges", () => {
  const now = new Date("2026-07-24T00:00:00Z");
  const row = toEventRow(base, "자료구조", "u", "s")!;

  it("새 미래 과제 → insert", () => {
    const { toInsert } = planChanges([row], new Map(), now);
    expect(toInsert).toHaveLength(1);
  });
  it("새 과거 과제 → 무시", () => {
    const past = { ...row, due_at: "2026-07-01T00:00:00Z" };
    const plan = planChanges([past], new Map(), now);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
  });
  it("기존 카드 → update (과거 마감이어도 갱신)", () => {
    const past = { ...row, due_at: "2026-07-01T00:00:00Z" };
    const plan = planChanges([past], new Map([["canvas:42", { id: "e1", is_completed: false }]]), now);
    expect(plan.toUpdate[0].id).toBe("e1");
  });
  it("알다마에서 수동 완료한 카드를 미제출이라고 되돌리지 않는다", () => {
    const plan = planChanges([row], new Map([["canvas:42", { id: "e1", is_completed: true }]]), now);
    expect(plan.toUpdate[0].patch.is_completed).toBeUndefined();
  });
  it("제출됨이면 완료로 갱신한다", () => {
    const submitted = { ...row, is_completed: true, completed_at: "2026-07-20T00:00:00Z" };
    const plan = planChanges([submitted], new Map([["canvas:42", { id: "e1", is_completed: false }]]), now);
    expect(plan.toUpdate[0].patch.is_completed).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- mapping` / Expected: FAIL
- [ ] **Step 3: 구현** — `src/lib/canvas/mapping.ts`

```ts
import type { CanvasAssignment } from "./api";

const SUBMITTED_STATES = new Set(["submitted", "graded", "pending_review"]);

export function isSubmitted(state: string | undefined | null): boolean {
  return state != null && SUBMITTED_STATES.has(state);
}

export type EventUpsertRow = {
  user_id: string;
  source_id: string;
  external_uid: string;
  title: string;
  subject: string;
  event_type: "assignment" | "exam";
  due_at: string;
  source_url: string;
  is_completed: boolean;
  completed_at: string | null;
};

export function toEventRow(
  assignment: CanvasAssignment,
  courseName: string,
  userId: string,
  sourceId: string,
): EventUpsertRow | null {
  if (!assignment.due_at) return null; // 마감 없는 항목(출석 등)은 카드로 안 만든다
  const submitted = isSubmitted(assignment.submission?.workflow_state);
  return {
    user_id: userId,
    source_id: sourceId,
    external_uid: `canvas:${assignment.id}`,
    title: assignment.name,
    subject: courseName,
    event_type: assignment.is_quiz_assignment ? "exam" : "assignment",
    due_at: assignment.due_at,
    source_url: assignment.html_url,
    is_completed: submitted,
    completed_at: submitted ? new Date().toISOString() : null,
  };
}

export function planChanges(
  rows: EventUpsertRow[],
  existing: Map<string, { id: string; is_completed: boolean }>,
  now: Date,
): { toInsert: EventUpsertRow[]; toUpdate: Array<{ id: string; patch: Partial<EventUpsertRow> }> } {
  const toInsert: EventUpsertRow[] = [];
  const toUpdate: Array<{ id: string; patch: Partial<EventUpsertRow> }> = [];

  for (const row of rows) {
    const current = existing.get(row.external_uid);
    if (!current) {
      // 새 과제: 이미 마감 지난 건 굳이 추가하지 않는다
      if (new Date(row.due_at) >= now) toInsert.push(row);
      continue;
    }
    const patch: Partial<EventUpsertRow> = {
      title: row.title,
      subject: row.subject,
      event_type: row.event_type,
      due_at: row.due_at,
      source_url: row.source_url,
    };
    // 완료는 한 방향으로만: 제출됨 → 완료. (수동 완료를 미제출이라고 되돌리지 않는다)
    if (row.is_completed && !current.is_completed) {
      patch.is_completed = true;
      patch.completed_at = row.completed_at;
    }
    toUpdate.push({ id: current.id, patch });
  }
  return { toInsert, toUpdate };
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전체 passed
- [ ] **Step 5: Commit (sun 실행)**

```bash
git add src/lib/canvas/mapping.ts src/lib/canvas/mapping.test.ts
git commit -m "feat: Canvas 과제 매핑 및 동기화 판단 로직"
```

---

### Task 6: 동기화 코어

**Files:**
- Create: `src/lib/canvas/sync.ts`

**Interfaces:**
- Consumes: Task 3 `decryptSecret`, Task 4 API 함수들, Task 5 `toEventRow`/`planChanges`.
- Produces: `syncCanvasSource(supabase, source: { id: string; user_id: string; credential_ciphertext: string }): Promise<{ inserted: number; updated: number }>` — supabase는 사용자 세션 클라이언트(서버 액션)든 service role(예약 함수)이든 동작. `CanvasAuthError` 시 `sources.status='error'`로 바꾸고 재던짐.

순수 로직은 Task 5에서 이미 테스트했으므로 이 파일은 조립만 담당(테스트는 Task 10 통합 확인으로 검증).

- [ ] **Step 1: 구현** — `src/lib/canvas/sync.ts`

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { decryptSecret } from "@/lib/crypto";
import { CanvasAuthError, fetchActiveCourses, fetchCourseAssignments } from "./api";
import { planChanges, toEventRow, type EventUpsertRow } from "./mapping";

type Client = SupabaseClient<Database>;
type CanvasSource = { id: string; user_id: string; credential_ciphertext: string };

export async function syncCanvasSource(supabase: Client, source: CanvasSource) {
  const { data: run } = await supabase
    .from("sync_runs")
    .insert({ user_id: source.user_id, source_id: source.id })
    .select("id")
    .single();

  try {
    const token = decryptSecret(source.credential_ciphertext);
    const courses = await fetchActiveCourses(token);

    const rows: EventUpsertRow[] = [];
    for (const course of courses) {
      const assignments = await fetchCourseAssignments(token, course.id);
      for (const assignment of assignments) {
        const row = toEventRow(assignment, course.name, source.user_id, source.id);
        if (row) rows.push(row);
      }
    }

    const { data: existingRows } = await supabase
      .from("events")
      .select("id, external_uid, is_completed")
      .eq("source_id", source.id);
    const existing = new Map(
      (existingRows ?? [])
        .filter((row) => row.external_uid !== null)
        .map((row) => [row.external_uid as string, { id: row.id, is_completed: row.is_completed }]),
    );

    const plan = planChanges(rows, existing, new Date());
    if (plan.toInsert.length > 0) {
      const { error } = await supabase.from("events").insert(plan.toInsert);
      if (error) throw new Error(`insert failed: ${error.message}`);
    }
    for (const { id, patch } of plan.toUpdate) {
      const { error } = await supabase.from("events").update(patch).eq("id", id);
      if (error) throw new Error(`update failed: ${error.message}`);
    }

    await supabase.from("sources").update({ status: "active", last_synced_at: new Date().toISOString(), last_sync_error: null }).eq("id", source.id);
    if (run) {
      await supabase.from("sync_runs").update({
        status: "succeeded", finished_at: new Date().toISOString(),
        inserted_count: plan.toInsert.length, updated_count: plan.toUpdate.length,
      }).eq("id", run.id);
    }
    return { inserted: plan.toInsert.length, updated: plan.toUpdate.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (error instanceof CanvasAuthError) {
      await supabase.from("sources").update({ status: "error", last_sync_error: "TOKEN_INVALID" }).eq("id", source.id);
    } else {
      await supabase.from("sources").update({ last_sync_error: message }).eq("id", source.id);
    }
    if (run) {
      await supabase.from("sync_runs").update({
        status: "failed", finished_at: new Date().toISOString(), error_message: message,
      }).eq("id", run.id);
    }
    throw error;
  }
}
```

- [ ] **Step 2: 타입/린트 확인** — Run: `npm run typecheck && npm run lint` / Expected: 에러 없음
- [ ] **Step 3: Commit (sun 실행)**

```bash
git add src/lib/canvas/sync.ts
git commit -m "feat: Canvas 동기화 코어"
```

---

### Task 7: 러닝엑스 연결 페이지 + 서버 액션

**Files:**
- Create: `src/app/connect/learnx/page.tsx`
- Create: `src/app/connect/learnx/actions.ts`

**Interfaces:**
- Consumes: Task 3 `encryptSecret`, Task 4 `fetchSelf`/`CanvasAuthError`, Task 6 `syncCanvasSource`.
- Produces: `connectLearnX(formData)` 서버 액션(성공 시 `/dashboard?connected=<count>`로 redirect, 실패 시 `/connect/learnx?error=...`), `disconnectLearnX()` 서버 액션. 대시보드(Task 8)가 이 페이지로 링크.

- [ ] **Step 1: 서버 액션 작성** — `src/app/connect/learnx/actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { CanvasAuthError, fetchSelf } from "@/lib/canvas/api";
import { syncCanvasSource } from "@/lib/canvas/sync";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") redirect("/login");
  return { supabase, userId };
}

export async function connectLearnX(formData: FormData) {
  const token = z.string().trim().min(10).safeParse(formData.get("token"));
  if (!token.success) redirect("/connect/learnx?error=invalid");
  const { supabase, userId } = await authenticatedClient();

  let displayName = "";
  try {
    displayName = (await fetchSelf(token.data)).name;
  } catch (error) {
    redirect(error instanceof CanvasAuthError ? "/connect/learnx?error=invalid" : "/connect/learnx?error=network");
  }

  // 기존 canvas 소스가 있으면 토큰 교체(재연결), 없으면 생성
  const { data: existing } = await supabase.from("sources").select("id").eq("user_id", userId).eq("type", "canvas").maybeSingle();
  const credential = encryptSecret(token.data);
  let sourceId: string;
  if (existing) {
    await supabase.from("sources").update({ credential_ciphertext: credential, status: "active", last_sync_error: null }).eq("id", existing.id);
    sourceId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("sources")
      .insert({ user_id: userId, type: "canvas", name: `러닝엑스 (${displayName})`, credential_ciphertext: credential })
      .select("id")
      .single();
    if (error || !created) redirect("/connect/learnx?error=save");
    sourceId = created.id;
  }

  let inserted = 0;
  try {
    const result = await syncCanvasSource(supabase, { id: sourceId, user_id: userId, credential_ciphertext: credential });
    inserted = result.inserted;
  } catch {
    // 첫 동기화 실패해도 연결 자체는 저장됨 — 대시보드 배너/수동 동기화로 복구
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard?connected=${inserted}`);
}

export async function disconnectLearnX() {
  const { supabase, userId } = await authenticatedClient();
  // 소스만 삭제. events.source_id는 FK on delete 정책에 따름 — Step 3에서 확인
  await supabase.from("sources").delete().eq("user_id", userId).eq("type", "canvas");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
```

- [ ] **Step 2: 페이지 작성** — `src/app/connect/learnx/page.tsx` (서버 컴포넌트, 기존 테마 변수 사용)

```tsx
import Link from "next/link";
import { connectLearnX } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "토큰이 올바르지 않아요. e-Campus에서 다시 복사해주세요.",
  network: "e-Campus에 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
  save: "저장 중 문제가 생겼어요. 다시 시도해주세요.",
};

export default async function ConnectLearnXPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const settingsUrl = `${process.env.NEXT_PUBLIC_CANVAS_BASE_URL}/profile/settings`;

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-xl font-bold">러닝엑스 연결</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        한 번만 연결하면 러닝엑스 과제가 자동으로 카드에 들어와요. 제출하면 자동 완료!
      </p>
      <ol className="mt-6 space-y-4 text-sm">
        <li>
          <span className="font-semibold">1. e-Campus 설정 열기</span>
          <a href={settingsUrl} target="_blank" rel="noreferrer" className="mt-1 block rounded-lg bg-[var(--accent)] px-4 py-2 text-center font-semibold text-white">
            e-Campus 설정 페이지 열기
          </a>
        </li>
        <li>
          <span className="font-semibold">2. 토큰 만들기</span>
          <p className="mt-1 text-[var(--muted)]">
            아래로 스크롤 → <b>+ 새 액세스 토큰</b> 클릭 → 목적에 &ldquo;알다마&rdquo; 입력, 만료일은 비워두고 생성
          </p>
        </li>
        <li>
          <span className="font-semibold">3. 토큰 붙여넣기</span> <span className="text-[var(--muted)]">(토큰은 지금 딱 한 번만 보여요)</span>
        </li>
      </ol>
      <form action={connectLearnX} className="mt-4 space-y-3">
        <input
          name="token" type="password" required autoComplete="off"
          placeholder="토큰을 여기에 붙여넣기"
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{ERROR_MESSAGES[error] ?? "문제가 생겼어요."}</p>}
        <button type="submit" className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white">연결하기</button>
      </form>
      <p className="mt-4 text-xs text-[var(--muted)]">
        토큰은 암호화되어 저장되고, 과제 조회에만 사용해요. e-Campus 설정에서 언제든 삭제할 수 있어요.
      </p>
      <Link href="/dashboard" className="mt-6 block text-center text-sm text-[var(--muted)]">나중에 할래요</Link>
    </main>
  );
}
```

(참고: `--accent` 등 변수명은 globals.css의 실제 테마 변수명에 맞춰 조정. 스크린샷 안내 이미지는 sun이 제공하면 `public/guide/`에 추가 — 없어도 텍스트 안내로 동작.)

- [ ] **Step 3: FK 정책 확인** — `supabase/migrations/20260712062821_aldama_initial_schema.sql`에서 `events.source_id` FK의 on delete가 `set null`인지 확인. `cascade`라면 연결 해제 시 카드가 다 지워지므로, Task 2 마이그레이션에 `alter table public.events drop constraint events_source_id_fkey; alter table public.events add constraint events_source_id_fkey foreign key (source_id) references public.sources(id) on delete set null;` 추가.
- [ ] **Step 4: 수동 확인** — Run: `npm run dev` → `/connect/learnx` 접속 → 잘못된 토큰 입력 → "토큰이 올바르지 않아요" 표시 → sun의 실제 토큰 입력 → 대시보드로 이동하며 과제 카드 생성 확인. **여기서 퀴즈가 assignments에 포함되는지 확인해서 sun에게 보고.**
- [ ] **Step 5: Commit (sun 실행)**

```bash
git add src/app/connect/learnx/
git commit -m "feat: 러닝엑스 연결 페이지 및 연결/해제 액션"
```

---

### Task 8: 대시보드 통합 (배지·숨김·자동/수동 동기화·오류 배너)

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/actions.ts`
- Create: `src/app/dashboard/LearnXSync.tsx` (client 조각)

**Interfaces:**
- Consumes: Task 6 `syncCanvasSource`, Task 7 연결 페이지 경로 `/connect/learnx`.
- Produces: `syncLearnXNow()` 서버 액션 (actions.ts에 추가).

- [ ] **Step 1: actions.ts에 동기화 액션 + 삭제→숨김 변경**

```ts
// actions.ts에 추가
import { syncCanvasSource } from "@/lib/canvas/sync";

export async function syncLearnXNow() {
  const { supabase, userId } = await authenticatedClient();
  const { data: source } = await supabase
    .from("sources")
    .select("id, user_id, credential_ciphertext")
    .eq("user_id", userId).eq("type", "canvas").eq("status", "active")
    .maybeSingle();
  if (source?.credential_ciphertext) {
    try {
      await syncCanvasSource(supabase, { id: source.id, user_id: source.user_id, credential_ciphertext: source.credential_ciphertext });
    } catch { /* 실패는 sources.status/배너로 표시됨 */ }
  }
  revalidatePath("/dashboard");
}
```

기존 `deleteEvent`를 수정: 삭제 전에 `source_id`를 조회해서, 연동 카드면 delete 대신 `update({ is_hidden: true })`.

```ts
export async function deleteEvent(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await authenticatedClient();
  const { data: event } = await supabase.from("events").select("source_id").eq("id", id.data).single();
  if (event?.source_id) {
    // 연동 카드는 지우면 다음 동기화 때 되살아나므로 숨김 처리한다
    await supabase.from("events").update({ is_hidden: true }).eq("id", id.data);
  } else {
    await supabase.from("events").delete().eq("id", id.data);
  }
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: page.tsx 수정**
  - 이벤트 쿼리에 `.eq("is_hidden", false)` 추가 (66행 부근).
  - canvas 소스 조회: `const { data: canvasSource } = await supabase.from("sources").select("id, status, last_synced_at").eq("type", "canvas").maybeSingle();`
  - `canvasSource`가 없으면 [+계획 추가] 근처에 `/connect/learnx` 링크 버튼 "러닝엑스 연결" 노출.
  - `canvasSource.status === "error"`면 상단 배너: "러닝엑스 연결이 끊겼어요. <Link href="/connect/learnx">다시 연결하기</Link>".
  - 카드 렌더링에서 `event.source_id === canvasSource?.id`면 작은 배지 "러닝엑스" 표시.
  - `<LearnXSync lastSyncedAt={canvasSource?.last_synced_at ?? null} active={canvasSource?.status === "active"} />` 삽입.
- [ ] **Step 3: LearnXSync.tsx 작성** — 접속 시 자동 동기화(10분 경과 시) + 수동 버튼

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { syncLearnXNow } from "./actions";

const STALE_MS = 10 * 60 * 1000;

export default function LearnXSync({ lastSyncedAt, active }: { lastSyncedAt: string | null; active: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const ranOnce = useRef(false);

  useEffect(() => {
    if (!active || ranOnce.current) return;
    ranOnce.current = true; // StrictMode 이중 실행 방지
    const stale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > STALE_MS;
    if (stale) startTransition(() => syncLearnXNow());
  }, [active, lastSyncedAt]);

  if (!active) return null;
  const minutesAgo = lastSyncedAt ? Math.max(0, Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 60000)) : null;

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
      <span>{isPending ? "러닝엑스 동기화 중..." : minutesAgo !== null ? `러닝엑스 · ${minutesAgo}분 전 동기화` : "러닝엑스 연결됨"}</span>
      <button
        type="button" disabled={isPending}
        onClick={() => startTransition(async () => { await syncLearnXNow(); setMessage("완료!"); setTimeout(() => setMessage(""), 2000); })}
        className="underline"
      >지금 동기화</button>
      {message && <span>{message}</span>}
    </div>
  );
}
```

- [ ] **Step 4: 수동 확인** — Run: `npm run dev` → 대시보드에서 ① 러닝엑스 배지 표시 ② 연동 카드 삭제 → 사라짐 → [지금 동기화] → 되살아나지 않음(숨김 유지) ③ e-Campus에서 토큰 삭제 → [지금 동기화] → 오류 배너 표시.
- [ ] **Step 5: 타입/린트** — Run: `npm run typecheck && npm run lint` / Expected: 에러 없음
- [ ] **Step 6: Commit (sun 실행)**

```bash
git add src/app/dashboard/
git commit -m "feat: 대시보드 러닝엑스 동기화 통합 (배지·숨김·자동/수동 동기화·오류 배너)"
```

---

### Task 9: Netlify 예약 함수 — 1시간마다 전체 동기화

**Files:**
- Create: `netlify/functions/sync-canvas.mts`

**Interfaces:**
- Consumes: Task 6 `syncCanvasSource` (service role 클라이언트로 호출 — RLS 우회해 전체 사용자 처리. `send-due-reminders.mts`와 같은 패턴).
- Produces: 매시 정각 자동 동기화. 필요 env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TOKEN_ENCRYPTION_KEY`, `CANVAS_BASE_URL`.

- [ ] **Step 1: 구현** — `netlify/functions/sync-canvas.mts`

```ts
import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types.ts";
import { syncCanvasSource } from "../../src/lib/canvas/sync.ts";

const handler = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey || !process.env.TOKEN_ENCRYPTION_KEY || !process.env.CANVAS_BASE_URL) {
    console.error("sync-canvas: missing required environment variables");
    return new Response("missing env", { status: 500 });
  }
  const supabase = createClient<Database>(supabaseUrl, secretKey);

  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, user_id, credential_ciphertext")
    .eq("type", "canvas")
    .eq("status", "active");
  if (error) return new Response("query failed", { status: 500 });

  let succeeded = 0;
  for (const source of sources ?? []) {
    if (!source.credential_ciphertext) continue;
    try {
      await syncCanvasSource(supabase, { id: source.id, user_id: source.user_id, credential_ciphertext: source.credential_ciphertext });
      succeeded += 1;
    } catch (err) {
      console.error(`sync-canvas: source ${source.id} failed`, err); // 한 명 실패해도 나머지는 계속
    }
  }
  return new Response(`synced ${succeeded}/${sources?.length ?? 0}`, { status: 200 });
};

export default handler;
export const config: Config = { schedule: "@hourly" };
```

(주의: `@/` alias는 Netlify 함수 번들러가 모르므로 상대 경로로 import. `src/lib/canvas/sync.ts` 내부의 `@/lib/...` import가 번들에서 깨지면 sync.ts의 import를 상대 경로로 바꾼다 — `send-due-reminders.mts`가 이미 같은 방식으로 동작 중인지 `netlify dev`로 확인.)

- [ ] **Step 2: 로컬 확인** — Run: `npx netlify dev` 후 `curl http://localhost:8888/.netlify/functions/sync-canvas` / Expected: `synced 1/1`
- [ ] **Step 3: Commit (sun 실행)**

```bash
git add netlify/functions/sync-canvas.mts
git commit -m "feat: 1시간마다 Canvas 동기화하는 Netlify 예약 함수"
```

---

### Task 10: 환경변수 문서화 + 통합 확인 + 인수인계 갱신

**Files:**
- Modify: `CLAUDE.md` (현재 상태/다음 할 일 갱신, Netlify env 목록에 3개 추가)

- [ ] **Step 1: Netlify 환경변수 등록 (sun이 Netlify 대시보드에서)** — `TOKEN_ENCRYPTION_KEY`(로컬과 같은 값이어야 기존 암호문 복호화 가능), `CANVAS_BASE_URL`, `NEXT_PUBLIC_CANVAS_BASE_URL`.
- [ ] **Step 2: 통합 확인 체크리스트 (sun 실계정)**
  - 연결 → "과제 N개를 가져왔어요" → 카드 생성, 과목명/마감일 정확(KST 표시 확인)
  - 러닝엑스 앱에서 과제 1개 제출 → [지금 동기화] → 카드 자동 완료
  - 알다마에서 다른 카드 수동 완료 → [지금 동기화] → 완료 유지(되돌아가지 않음)
  - 퀴즈가 카드로 들어오는지 확인 → 결과를 sun에게 보고
  - 연동 카드 삭제(숨김) → 동기화 후에도 안 되살아남
- [ ] **Step 3: 전체 검증** — Run: `npm test && npm run typecheck && npm run lint && npm run build` / Expected: 모두 통과
- [ ] **Step 4: CLAUDE.md 갱신** — 현재 상태에 "러닝엑스(Canvas) 동기화" 추가, 다음 할 일에서 관련 항목 정리, Netlify env 목록 갱신.
- [ ] **Step 5: Commit (sun 실행)**

```bash
git add CLAUDE.md
git commit -m "docs: 러닝엑스 동기화 완료 반영"
```

---

## 남은 열린 항목 (실행 중 결정)

- Task 0: 실제 Canvas API 주소 (e-campus.khu.ac.kr vs canvas.khu.ac.kr)
- Task 7 Step 4: 퀴즈 포함 여부 확인 → sun에게 보고 (스펙 합의사항)
- Task 9: Netlify 번들러의 `@/` alias 처리 — 깨지면 sync.ts import를 상대 경로로 전환
