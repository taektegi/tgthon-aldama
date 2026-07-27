import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/ai-parser", () => ({ transcribeNoticeImage: vi.fn() }));
vi.mock("@/lib/canvas/sync", () => ({
  canvasSyncErrorInfo: vi.fn(() => ({ code: "SYNC_ERROR" })),
  syncCanvasSource: vi.fn(),
}));
vi.mock("@/lib/canvas/mapping", () => ({ OVERRIDABLE_FIELDS: [] }));

import { toggleEvent, type ToggleEventState } from "./actions";

const initialToggleEventState: ToggleEventState = { status: "idle", message: "" };

const EVENT_ID = "2f1c3d7e-bc62-4c20-9563-2c364df9ec2d";

function mockSupabase(result: { data: { id: string; is_completed: boolean } | null; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  const supabase = {
    auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null }) },
    from,
  };
  mocks.createClient.mockResolvedValue(supabase);
  return { update, eq, select, maybeSingle };
}

function formData(completed: boolean) {
  const data = new FormData();
  data.set("id", EVENT_ID);
  data.set("completed", String(completed));
  return data;
}

describe("toggleEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("미완료 일정을 완료로 저장하고 변경된 값을 확인한다", async () => {
    const query = mockSupabase({ data: { id: EVENT_ID, is_completed: true }, error: null });

    await expect(toggleEvent(initialToggleEventState, formData(false))).resolves.toEqual({
      status: "success",
      message: "완료했어요.",
      isCompleted: true,
    });
    expect(query.update).toHaveBeenCalledWith({
      is_completed: true,
      completed_at: expect.any(String),
    });
    expect(query.eq).toHaveBeenCalledWith("id", EVENT_ID);
    expect(query.select).toHaveBeenCalledWith("id, is_completed");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("Supabase 업데이트 실패를 사용자에게 전달하고 화면을 재검증하지 않는다", async () => {
    mockSupabase({ data: null, error: { message: "RLS denied" } });

    await expect(toggleEvent(initialToggleEventState, formData(false))).resolves.toEqual({
      status: "error",
      message: "완료 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("잘못된 일정 ID는 DB 요청 전에 거절한다", async () => {
    const data = new FormData();
    data.set("id", "not-a-uuid");
    data.set("completed", "false");

    await expect(toggleEvent(initialToggleEventState, data)).resolves.toEqual({
      status: "error",
      message: "일정 정보를 확인하지 못했어요. 화면을 새로고침해주세요.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
