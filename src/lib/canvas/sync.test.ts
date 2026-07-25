import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../database.types";
import { toCalendarEventRow, toEventRow, type EventUpsertRow, type OverrideField } from "./mapping";

const calendarWindow = {
  startDate: "2026-06-25T00:00:00.000Z",
  endDate: "2100-07-25T00:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  decryptSecret: vi.fn(() => "plain-token"),
  fetchActiveCourses: vi.fn(),
  fetchCalendarEvent: vi.fn(),
  fetchCalendarEvents: vi.fn(),
  fetchCourseAssignments: vi.fn(),
  canvasCalendarWindow: vi.fn(() => ({
    startDate: "2026-06-25T00:00:00.000Z",
    endDate: "2100-07-25T00:00:00.000Z",
  })),
}));

vi.mock("../crypto", () => ({ decryptSecret: mocks.decryptSecret }));
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  fetchActiveCourses: mocks.fetchActiveCourses,
  fetchCalendarEvent: mocks.fetchCalendarEvent,
  fetchCalendarEvents: mocks.fetchCalendarEvents,
  fetchCourseAssignments: mocks.fetchCourseAssignments,
  canvasCalendarWindow: mocks.canvasCalendarWindow,
}));

type QueryResult = { data: unknown; error: { message: string } | null };
type EventPatch = Partial<EventUpsertRow> & { is_hidden?: boolean };
type ExistingEvent = {
  id: string;
  external_uid: string;
  is_completed: boolean;
  is_hidden?: boolean;
  override_fields?: OverrideField[];
} & Partial<EventUpsertRow>;

class FakeSupabase {
  events: ExistingEvent[] = [];
  eventInsertBatches: EventUpsertRow[][] = [];
  eventUpdates: Array<{ id: string; patch: EventPatch }> = [];
  sourceUpdates: Array<Record<string, unknown>> = [];
  runUpdates: Array<Record<string, unknown>> = [];
  runCreated = false;

  from(table: string) {
    return new FakeQuery(this, table);
  }
}

class FakeQuery implements PromiseLike<QueryResult> {
  private operation: "select" | "insert" | "update" = "select";
  private payload: unknown;
  private filters = new Map<string, unknown>();

  constructor(private readonly db: FakeSupabase, private readonly table: string) {}

  select() {
    return this;
  }

  insert(payload: unknown) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.set(column, values);
    return this;
  }

  single() {
    return this.execute(true);
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute(false).then(onfulfilled, onrejected);
  }

  private async execute(single: boolean): Promise<QueryResult> {
    if (this.table === "sync_runs" && this.operation === "insert") {
      this.db.runCreated = true;
      return { data: single ? { id: "run-1" } : [{ id: "run-1" }], error: null };
    }
    if (this.table === "sync_runs" && this.operation === "update") {
      this.db.runUpdates.push(this.payload as Record<string, unknown>);
      return { data: null, error: null };
    }
    if (this.table === "sources" && this.operation === "update") {
      this.db.sourceUpdates.push(this.payload as Record<string, unknown>);
      return { data: null, error: null };
    }
    if (this.table === "events" && this.operation === "select") {
      return {
        data: this.db.events.map((event) => ({
          id: event.id,
          external_uid: event.external_uid,
          title: event.title ?? "",
          subject: event.subject ?? null,
          event_type: event.event_type ?? "event",
          starts_at: event.starts_at ?? null,
          due_at: event.due_at ?? null,
          is_all_day: event.is_all_day ?? false,
          location: event.location ?? null,
          source_url: event.source_url ?? null,
          is_completed: event.is_completed,
          is_hidden: event.is_hidden ?? false,
          override_fields: event.override_fields ?? [],
        })),
        error: null,
      };
    }
    if (this.table === "events" && this.operation === "insert") {
      const rows = this.payload as EventUpsertRow[];
      this.db.eventInsertBatches.push(rows);
      for (const row of rows) {
        this.db.events.push({ id: `event-${this.db.events.length + 1}`, override_fields: [], is_hidden: false, ...row });
      }
      return { data: null, error: null };
    }
    if (this.table === "events" && this.operation === "update") {
      const idFilter = this.filters.get("id");
      const ids = Array.isArray(idFilter) ? idFilter as string[] : [idFilter as string];
      const patch = this.payload as EventPatch;
      for (const id of ids) {
        this.db.eventUpdates.push({ id, patch });
        const event = this.db.events.find((candidate) => candidate.id === id);
        if (event) Object.assign(event, patch);
      }
      return { data: null, error: null };
    }
    return { data: null, error: { message: "unexpected fake query" } };
  }
}

const source = { id: "source-1", user_id: "user-1", credential_ciphertext: "encrypted-value" };
const assignment = {
  id: 42,
  name: "3주차 과제",
  due_at: "2099-08-01T14:59:00Z",
  html_url: "https://canvas.example/a/42",
  submission: { workflow_state: "unsubmitted" },
};

function client(db: FakeSupabase) {
  return db as unknown as SupabaseClient<Database>;
}

function existingFromRow(id: string, row: EventUpsertRow, overrides: OverrideField[] = []): ExistingEvent {
  return { id, ...row, is_hidden: false, override_fields: overrides };
}

describe("syncCanvasSource", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { CanvasNotFoundError } = await import("./api");
    mocks.fetchActiveCourses.mockResolvedValue([{ id: 10, name: "자료구조" }]);
    mocks.fetchCalendarEvent.mockRejectedValue(new CanvasNotFoundError("not found"));
    mocks.fetchCalendarEvents.mockResolvedValue([]);
    mocks.fetchCourseAssignments.mockResolvedValue([assignment]);
  });

  it("Canvas 캘린더에 직접 추가한 일정을 카드로 저장한다", async () => {
    const db = new FakeSupabase();
    mocks.fetchCalendarEvents.mockResolvedValue([{
      id: 77,
      title: "캘린더에 추가한 과제 일정",
      start_at: "2099-08-02T01:00:00Z",
      end_at: "2099-08-02T03:00:00Z",
      html_url: "https://canvas.example/calendar?event_id=77",
      context_name: "개인",
      workflow_state: "active",
    }]);
    const { syncCanvasSource } = await import("./sync");

    await expect(syncCanvasSource(client(db), source)).resolves.toMatchObject({ inserted: 2, updated: 0 });
    expect(mocks.fetchCalendarEvents).toHaveBeenCalledWith("plain-token", [10], calendarWindow);
    expect(db.eventInsertBatches.flat()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        external_uid: "canvas:event:77",
        event_type: "event",
        starts_at: "2099-08-02T01:00:00Z",
        due_at: "2099-08-02T03:00:00Z",
      }),
    ]));
  });

  it("Canvas 응답에서 사라진 캘린더 카드는 숨긴다", async () => {
    const db = new FakeSupabase();
    db.events.push({ id: "calendar-1", external_uid: "canvas:event:77", is_completed: false, is_hidden: false, starts_at: "2099-08-02T01:00:00Z" });
    const { syncCanvasSource } = await import("./sync");

    await expect(syncCanvasSource(client(db), source)).resolves.toMatchObject({ inserted: 1, updated: 1 });

    expect(db.events[0].is_hidden).toBe(true);
    expect(mocks.fetchCalendarEvent).toHaveBeenCalledWith("plain-token", 77);
    expect(db.runUpdates.at(-1)).toMatchObject({ status: "succeeded", updated_count: 1 });
  });

  it("Canvas가 deleted 상태로 반환한 캘린더 카드도 숨긴다", async () => {
    const db = new FakeSupabase();
    db.events.push({ id: "calendar-1", external_uid: "canvas:event:77", is_completed: false, is_hidden: false, starts_at: "2099-08-02T01:00:00Z" });
    mocks.fetchCalendarEvents.mockResolvedValue([{
      id: 77,
      title: "삭제된 일정",
      start_at: "2099-08-02T01:00:00Z",
      end_at: "2099-08-02T03:00:00Z",
      html_url: "https://canvas.example/calendar?event_id=77",
      workflow_state: "deleted",
    }]);
    const { syncCanvasSource } = await import("./sync");

    await syncCanvasSource(client(db), source);

    expect(db.events[0].is_hidden).toBe(true);
  });

  it("조회 범위 밖의 캘린더 카드는 응답에 없어도 숨기지 않는다", async () => {
    const db = new FakeSupabase();
    db.events.push({
      id: "calendar-old",
      external_uid: "canvas:event:70",
      is_completed: false,
      is_hidden: false,
      starts_at: "2026-01-01T01:00:00Z",
    });
    const { syncCanvasSource } = await import("./sync");

    await syncCanvasSource(client(db), source);

    expect(db.events[0].is_hidden).toBe(false);
    expect(mocks.fetchCalendarEvent).not.toHaveBeenCalled();
  });

  it("목록에서 사라졌지만 조회 범위 밖으로 이동한 일정은 숨기지 않고 갱신한다", async () => {
    const db = new FakeSupabase();
    const original = toCalendarEventRow({
      id: 77,
      title: "이동 전 일정",
      start_at: "2099-08-02T01:00:00Z",
      end_at: "2099-08-02T03:00:00Z",
      html_url: "https://canvas.example/calendar?event_id=77",
      workflow_state: "active",
    }, "user-1", "source-1")!;
    db.events.push(existingFromRow("calendar-1", original));
    mocks.fetchCalendarEvent.mockResolvedValue({
      id: 77,
      title: "이동 후 일정",
      start_at: "2101-08-02T01:00:00Z",
      end_at: "2101-08-02T03:00:00Z",
      html_url: "https://canvas.example/calendar?event_id=77",
      workflow_state: "active",
    });
    const { syncCanvasSource } = await import("./sync");

    await expect(syncCanvasSource(client(db), source)).resolves.toMatchObject({ inserted: 1, updated: 1 });

    expect(db.events[0]).toMatchObject({
      is_hidden: false,
      title: "이동 후 일정",
      starts_at: "2101-08-02T01:00:00Z",
      due_at: "2101-08-02T03:00:00Z",
    });
  });

  it("Canvas 과제 카드와 직접 입력한 일정은 응답에 없어도 숨기지 않는다", async () => {
    const db = new FakeSupabase();
    db.events.push(
      { id: "assignment-1", external_uid: "canvas:999", is_completed: false, is_hidden: false },
      { id: "manual-1", external_uid: "manual:1", is_completed: false, is_hidden: false },
    );
    mocks.fetchCourseAssignments.mockResolvedValue([]);
    const { syncCanvasSource } = await import("./sync");

    await expect(syncCanvasSource(client(db), source)).resolves.toMatchObject({ inserted: 0, updated: 0 });

    expect(db.events.every((event) => event.is_hidden === false)).toBe(true);
  });

  it("Canvas 캘린더 조회가 실패하면 기존 카드를 숨기지 않는다", async () => {
    const db = new FakeSupabase();
    db.events.push({ id: "calendar-1", external_uid: "canvas:event:77", is_completed: false, is_hidden: false, starts_at: "2099-08-02T01:00:00Z" });
    const { CanvasTemporaryError } = await import("./api");
    mocks.fetchCalendarEvents.mockRejectedValue(new CanvasTemporaryError("temporary"));
    const { syncCanvasSource } = await import("./sync");

    await expect(syncCanvasSource(client(db), source)).rejects.toBeInstanceOf(CanvasTemporaryError);

    expect(db.events[0].is_hidden).toBe(false);
    expect(db.eventUpdates.some(({ patch }) => patch.is_hidden === true)).toBe(false);
  });

  it("누락 일정 단건 확인이 일시 실패하면 기존 카드를 유지하고 동기화를 중단한다", async () => {
    const db = new FakeSupabase();
    db.events.push({ id: "calendar-1", external_uid: "canvas:event:77", is_completed: false, is_hidden: false, starts_at: "2099-08-02T01:00:00Z" });
    const { CanvasTemporaryError } = await import("./api");
    mocks.fetchCalendarEvent.mockRejectedValue(new CanvasTemporaryError("temporary"));
    const { syncCanvasSource } = await import("./sync");

    await expect(syncCanvasSource(client(db), source)).rejects.toBeInstanceOf(CanvasTemporaryError);

    expect(db.events[0].is_hidden).toBe(false);
    expect(db.eventUpdates.some(({ patch }) => patch.is_hidden === true)).toBe(false);
  });

  it("첫 동기화 후 다시 실행해도 같은 Canvas ID를 추가하거나 갱신하지 않는다", async () => {
    const db = new FakeSupabase();
    mocks.fetchCourseAssignments.mockResolvedValue([assignment, assignment]);
    const { syncCanvasSource } = await import("./sync");

    await expect(syncCanvasSource(client(db), source)).resolves.toMatchObject({ inserted: 1, updated: 0 });
    await expect(syncCanvasSource(client(db), source)).resolves.toMatchObject({ inserted: 0, updated: 0 });

    expect(db.eventInsertBatches.flat()).toHaveLength(1);
    expect(db.eventUpdates).toHaveLength(0);
    expect(db.runUpdates.at(-1)).toMatchObject({ status: "succeeded", inserted_count: 0, updated_count: 0 });
    expect(mocks.decryptSecret).toHaveBeenCalledWith("encrypted-value");
  });

  it("사용자가 완료한 기존 카드를 Canvas 미제출 상태로 되돌리지 않는다", async () => {
    const db = new FakeSupabase();
    const current = toEventRow(assignment, "자료구조", "user-1", "source-1")!;
    db.events.push(existingFromRow("event-1", { ...current, is_completed: true }));
    const { syncCanvasSource } = await import("./sync");

    await syncCanvasSource(client(db), source);

    expect(db.eventUpdates).toHaveLength(0);
    expect(db.events[0].is_completed).toBe(true);
  });

  it("사용자가 수정한 필드는 보존하고 바뀐 원본 필드만 갱신한다", async () => {
    const db = new FakeSupabase();
    const original = toEventRow(assignment, "이전 과목명", "user-1", "source-1")!;
    db.events.push(existingFromRow("event-1", {
      ...original,
      title: "내가 정한 제목",
      due_at: "2099-09-01T10:00:00Z",
    }, ["title", "due_at"]));
    const { syncCanvasSource } = await import("./sync");

    await expect(syncCanvasSource(client(db), source)).resolves.toMatchObject({ inserted: 0, updated: 1 });

    expect(db.eventUpdates).toEqual([{ id: "event-1", patch: { subject: "자료구조" } }]);
    expect(db.events[0]).toMatchObject({ title: "내가 정한 제목", due_at: "2099-09-01T10:00:00Z" });
  });

  it("401 실패는 source와 sync_runs에 안전한 코드로 기록한다", async () => {
    const db = new FakeSupabase();
    const { CanvasAuthError } = await import("./api");
    mocks.fetchActiveCourses.mockRejectedValue(new CanvasAuthError("secret token must not be stored"));
    const { syncCanvasSource } = await import("./sync");

    await expect(syncCanvasSource(client(db), source)).rejects.toBeInstanceOf(CanvasAuthError);

    expect(db.runCreated).toBe(true);
    expect(db.sourceUpdates.at(-1)).toEqual({ status: "error", last_sync_error: "TOKEN_INVALID" });
    expect(db.runUpdates.at(-1)).toMatchObject({
      status: "failed",
      error_code: "TOKEN_INVALID",
      error_message: "Canvas token is invalid",
    });
    expect(JSON.stringify(db.runUpdates)).not.toContain("secret token");
  });
});
