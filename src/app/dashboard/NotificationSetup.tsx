"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { saveSubscription } from "./notifications-actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function subscribeToSupport() {
  return () => {};
}

function getSupportSnapshot() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

function getServerSupportSnapshot() {
  return false;
}

type Status = "idle" | "denied" | "subscribing" | "subscribed" | "error";

export function NotificationSetup() {
  const isSupported = useSyncExternalStore(subscribeToSupport, getSupportSnapshot, getServerSupportSnapshot);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!isSupported) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (subscription && Notification.permission === "granted") setStatus("subscribed");
      })
      .catch(() => {
        // registration can fail on unsupported browsers; button stays available to retry
      });
  }, [isSupported]);

  const handleEnable = async () => {
    setStatus("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) throw new Error("VAPID 공개키가 설정되지 않았어요.");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const result = await saveSubscription(subscription.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } });
      if (!result.ok) throw new Error(result.error);

      setStatus("subscribed");
    } catch {
      setStatus("error");
    }
  };

  if (!isSupported) return null;

  if (status === "subscribed") {
    return <p className="muted" style={{ fontSize: 13, margin: 0 }}>🔔 마감 6시간 전 알림이 켜져 있어요.</p>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button type="button" className="button button-muted" onClick={handleEnable} disabled={status === "subscribing"}>
        🔔 마감 알림 받기
      </button>
      {status === "denied" && (
        <span className="muted" style={{ fontSize: 13 }}>알림 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.</span>
      )}
      {status === "error" && <span className="muted" style={{ fontSize: 13 }}>알림 설정 중 문제가 발생했어요.</span>}
    </div>
  );
}
