import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { Database } from "../../src/lib/database.types.ts";
import { computeReminderStage, stageLabel, REMINDER_WINDOW_HOURS } from "../../src/lib/reminders.ts";

const HOUR_MS = 60 * 60 * 1000;

function buildBody(title: string, dueAt: string, now: Date): string {
  const diff = new Date(dueAt).getTime() - now.getTime();
  if (diff <= HOUR_MS) {
    const minutes = Math.max(1, Math.round(diff / 60000));
    return `${title} · ${minutes}분 남았어요`;
  }
  const hours = Math.max(1, Math.round(diff / HOUR_MS));
  return `${title} · ${hours}시간 남았어요`;
}

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

  // 24시간 안에 마감인 미완료 카드 전부 (배지 개수 계산 + 알림 대상 선별에 함께 사용)
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, user_id, title, due_at, reminder_stage")
    .eq("is_completed", false)
    .eq("is_hidden", false)
    .not("due_at", "is", null)
    .gte("due_at", now.toISOString())
    .lte("due_at", windowEnd.toISOString());

  if (eventsError) {
    console.error("send-due-reminders: failed to load due events", eventsError);
    return new Response("query failed", { status: 500 });
  }

  if (!events || events.length === 0) {
    return new Response("no due events", { status: 200 });
  }

  // 사용자별 배지 숫자 = 24시간 내 미완료 카드 개수
  const badgeCountByUser = new Map<string, number>();
  for (const event of events) {
    badgeCountByUser.set(event.user_id, (badgeCountByUser.get(event.user_id) ?? 0) + 1);
  }

  // 알림이 필요한 카드: 남은 시간으로 계산한 단계 > 이미 보낸 단계
  const pending = events
    .map((event) => ({ ...event, targetStage: computeReminderStage(event.due_at, now) }))
    .filter((event) => event.targetStage > (event.reminder_stage ?? 0));

  if (pending.length === 0) {
    return new Response("no reminders needed", { status: 200 });
  }

  const userIds = [...new Set(pending.map((event) => event.user_id))];
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

  let sentCount = 0;

  for (const event of pending) {
    const subs = subscriptionsByUser.get(event.user_id) ?? [];
    if (subs.length === 0) continue;

    const payload = JSON.stringify({
      title: stageLabel(event.targetStage),
      body: buildBody(event.title, event.due_at as string, now),
      tag: `event-${event.id}`, // 같은 태그 재사용 → 알림 센터에 카드당 최신 1개만 남는다
      url: "/dashboard",
      badgeCount: badgeCountByUser.get(event.user_id) ?? 0,
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
          // 사라진 구독(알림 껐거나 앱 삭제)은 정리
          await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        } else {
          console.error("send-due-reminders: push send failed", err);
        }
      }
    }

    if (deliveredAtLeastOnce) {
      await supabase.from("events").update({ reminder_stage: event.targetStage }).eq("id", event.id);
      sentCount += 1;
    }
  }

  return new Response(`sent ${sentCount} reminders`, { status: 200 });
};

export default handler;

export const config: Config = {
  schedule: "*/15 * * * *",
};
