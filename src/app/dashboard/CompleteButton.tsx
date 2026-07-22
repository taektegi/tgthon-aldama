"use client";

import { useTransition } from "react";
import { toggleEvent } from "./actions";

export function CompleteButton({ id, isCompleted }: { id: string; isCompleted: boolean }) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("completed", String(isCompleted));
      await toggleEvent(formData);

      if (!isCompleted && "serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          const notifications = await registration?.getNotifications({ tag: `event-${id}` });
          notifications?.forEach((notification) => notification.close());
        } catch {
          // best-effort only; notification cleanup is not critical
        }
      }
    });
  };

  return (
    <button
      type="button"
      className={isCompleted ? "button button-muted" : "button button-primary"}
      onClick={handleClick}
      disabled={isPending}
      aria-label={isCompleted ? "미완료로 변경" : "완료 처리"}
    >
      {isCompleted ? "되돌리기" : "완료"}
    </button>
  );
}
