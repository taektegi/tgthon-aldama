import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../database.types";
import type { EventUpsertRow } from "./mapping";

const mocks = vi.hoisted(() => ({
  decryptSecret: vi.fn(() => "plain-token"),
  fetchActiveCourses: vi.fn(),
  fetchCourseAssignments: vi.fn(),
}));

vi.mock("../crypto", () => ({ decryptSecret: mocks.decryptSecret }));
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  fetchActiveCourses: mocks.fetchActiveCourses,
  fetchCourseAssignments: mocks.fetchCourseAssignments,
}));

type QueryResult = { data: unknown; error: { message: string } | null };
type ExistingEvent = { id: string; external_uid: string; is_completed: boolean } & Partial<EventUpsertRow>;

class FakeSupabase {
  events: ExistingEvent[] = [];
  eventInsertBatches: EventUpsertRow[][] = [];
  eventUpdates: Array<{ id: string; patch: Partial<EventUpsertRow> }> = [];
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
        data: this.db.events.map(({ id, external_uid, is_completed }) => ({ id, external_uid, is_completed })),
        error: null,
      };
    }
    if (this.table === "events" && this.operation === "insert") {
      const rows = this.payload as EventUpsertRow[];
      this.db.eventInsertBatches.push(rows);
      for (const row of rows) {
        this.db.events.push({ id: `event-${this.db.events.length + 1}`, ...row });
      }
      return { data: null, error: null };
    }
    if (this.table === "events" && this.operation === "update") {
      const id = this.filters.get("id") as string;
      const patch = this.payload as Partial<EventUpsertRow>;
      this.db.eventUpdates.push({ id, patch });
      const event = this.db.events.find((candidate) => candidate.id === id);
      if (event) Object.assign(event, patch);
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

describe("syncCanvasSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchActiveCourses.mockResolvedValue([{ id: 10, name: "자료구조" }]);
    mocks.fetchCourseAssignments.mockResolvedValue([assignment]);
  });

  it("첫 동기화 후 다시 실행해도 같은 과제를 추가하지 않고 기존 카드를 갱신한다", async () => {
    const db = new FakeSupabase();
    mocks.fetchCourseAssignments.mockResolvedValue([assignment, assignment]);
    const { syncCanvasSource } = await import("./sync");

    await expect(syncCanvasSource(client(db), source)).resolves.toMatchObject({ inserted: 1, updated: 0 });
    await expect(syncCanvasSource(client(db), source)).resolves.toMatchObject({ inserted: 0, updated: 1 });

    expect(db.eventInsertBatches.flat()).toHaveLength(1);
    expect(db.eventUpdates[0]).toMatchObject({ id: "event-1", patch: { title: "3주차 과제", subject: "자료구조" } });
    expect(db.runUpdates.at(-1)).toMatchObject({ status: "succeeded", inserted_count: 0, updated_count: 1 });
    expect(mocks.decryptSecret).toHaveBeenCalledWith("encrypted-value");
  });

  it("사용자가 완료한 기존 카드를 Canvas 미제출 상태로 되돌리지 않는다", async () => {
    const db = new FakeSupabase();
    db.events.push({ id: "event-1", external_uid: "canvas:42", is_completed: true });
    const { syncCanvasSource } = await import("./sync");

    await syncCanvasSource(client(db), source);

    expect(db.eventUpdates[0].patch.is_completed).toBeUndefined();
    expect(db.events[0].is_completed).toBe(true);
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
