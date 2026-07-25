// 1시간마다 울리는 알람시계: 앱을 안 열어도 러닝엑스 새 과제가 카드로 들어오게 한다.
// service role(관리자 열쇠)로 전체 사용자의 canvas 소스를 순회 동기화.
import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types.ts";
import { canvasSyncErrorInfo, syncCanvasSource } from "../../src/lib/canvas/sync.ts";

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
  if (error) {
    console.error("sync-canvas: failed to load sources", error);
    return new Response("query failed", { status: 500 });
  }

  let succeeded = 0;
  for (const source of sources ?? []) {
    if (!source.credential_ciphertext) continue;
    try {
      await syncCanvasSource(supabase, {
        id: source.id,
        user_id: source.user_id,
        credential_ciphertext: source.credential_ciphertext,
      });
      succeeded += 1;
    } catch (error) {
      // 한 명이 실패해도 나머지 사용자는 계속 동기화한다
      console.error(`sync-canvas: source ${source.id} failed (${canvasSyncErrorInfo(error).code})`);
    }
  }
  return new Response(`synced ${succeeded}/${sources?.length ?? 0}`, { status: 200 });
};

export default handler;
export const config: Config = { schedule: "@hourly" };
