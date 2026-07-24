"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") throw new Error("UNAUTHENTICATED");
  return { supabase, userId };
}

export async function saveSubscription(subscription: { endpoint: string; keys?: { p256dh?: string; auth?: string } }) {
  const parsed = subscriptionSchema.safeParse({
    endpoint: subscription.endpoint,
    p256dh: subscription.keys?.p256dh,
    auth: subscription.keys?.auth,
  });
  if (!parsed.success) return { ok: false as const, error: "잘못된 구독 정보예요." };

  const { supabase, userId } = await authenticatedClient();
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.p256dh,
    auth_key: parsed.data.auth,
  });

  if (error && error.code !== "23505") return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function removeSubscription(endpoint: string) {
  const { supabase } = await authenticatedClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true as const };
}
