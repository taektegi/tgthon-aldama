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
      .select("id, user_id, type, status")
      .eq("id", input.source_id)
      .eq("user_id", user.id)
      .eq("type", "school_notice")
      .single();

    if (error || !source) return json({ error: "SOURCE_NOT_FOUND" }, 404);

    // TODO: call a site-specific adapter, parse only unseen notices, and save
    // extraction candidates after validating dates and source URLs.
    return json({ source_id: source.id, status: "not_implemented" }, 501);
  } catch (error) {
    return errorResponse(error);
  }
});
