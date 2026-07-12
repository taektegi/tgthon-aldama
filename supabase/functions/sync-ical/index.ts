import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { z } from "zod";
import { adminClient, requireUser } from "../_shared/auth.ts";
import { errorResponse, json } from "../_shared/http.ts";

const inputSchema = z.object({ source_id: z.uuid() });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const user = await requireUser(request);
    const input = inputSchema.parse(await request.json());
    const admin = adminClient();
    const { data: source, error } = await admin
      .from("sources")
      .select("id, user_id, type, status, feed_url_ciphertext")
      .eq("id", input.source_id)
      .eq("user_id", user.id)
      .eq("type", "ical")
      .single();

    if (error || !source) return json({ error: "SOURCE_NOT_FOUND" }, 404);

    // TODO: decrypt feed_url_ciphertext, fetch the iCal feed, parse VEVENT values,
    // and upsert by (source_id, external_uid) inside a short transaction.
    return json({ source_id: source.id, status: "not_implemented" }, 501);
  } catch (error) {
    return errorResponse(error);
  }
});
