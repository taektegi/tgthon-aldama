import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { Database } from "../../src/lib/database.types.ts";

const REMINDER_WINDOW_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;

const handler = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!supabaseUrl || !secretKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error("send-due-reminders: missing required environment variables");
    return new Response("missing env", { status: 500 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const supabase = createClient<Database>(supabaseUrl, secretKey);

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * HOUR_MS);

  const { data: dueEvents, error: eventsError } = await supabase
    .from("events")
    .select("id, user_id, title, due_at")
    .eq("is_completed", false)
    .is("reminder_sent_at", null)
    .not("due_at", "is", null)
    .gte("due_at", now.toISOString())
    .lte("due_at", windowEnd.toISOString());

  if (eventsError) {
    console.error("send-due-reminders: failed to load due events", eventsError);
    return new Response("query failed", { status: 500 });
  }

  if (!dueEvents || dueEvents.length === 0) {
    return new Response("no due events", { status: 200 });
  }

  const userIds = [...new Set(dueEvents.map((event) => event.user_id))];
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth_key")
    .in("user_id", userIds);

  const subscriptionsByUser = new Map<string, NonNullable<typeof subscriptions>>();
  for (const subscription of subscriptions ?? []) {
    const list = subscriptionsByUser.get(subscription.user_id) ?? [];
    list.push(subscription);
    subscriptionsByUser.set(subscription.user_id, list);
  }

  const sentEventIds: string[] = [];

  for (const event of dueEvents) {
    const subs = subscriptionsByUser.get(event.user_id) ?? [];
    if (subs.length === 0) continue;

    const hoursLeft = Math.max(1, Math.round((new Date(event.due_at as string).getTime() - now.getTime()) / HOUR_MS));
    const payload = JSON.stringify({
      title: "⏰ 마감 임박!",
      body: `${event.title} · ${hoursLeft}시간 남았어요`,
      tag: `event-${event.id}`,
      url: "/dashboard",
    });

    let deliveredAtLeastOnce = false;

    for (const subscription of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
          payload,
        );
        deliveredAtLeastOnce = true;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        } else {
          console.error("send-due-reminders: push send failed", err);
        }
      }
    }

    if (deliveredAtLeastOnce) sentEventIds.push(event.id);
  }

  if (sentEventIds.length > 0) {
    await supabase.from("events").update({ reminder_sent_at: now.toISOString() }).in("id", sentEventIds);
  }

  return new Response(`sent ${sentEventIds.length} reminders`, { status: 200 });
};

export default handler;

export const config: Config = {
  schedule: "*/15 * * * *",
};
