"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { CheckIcon, UndoIcon } from "@/app/components/UiIcons";
import { toggleEvent, type ToggleEventState } from "./actions";

const initialToggleEventState: ToggleEventState = { status: "idle", message: "" };

export function CompleteButton({ id, title, isCompleted }: { id: string; title: string; isCompleted: boolean }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(toggleEvent, initialToggleEventState);

  useEffect(() => {
    if (state.status !== "success") return;

    if (state.isCompleted && "serviceWorker" in navigator) {
      void (async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          const notifications = await registration?.getNotifications({ tag: `event-${id}` });
          notifications?.forEach((notification) => notification.close());
        } catch {
          // best-effort only; notification cleanup is not critical
        }
      })();
    }

    router.refresh();
  }, [id, router, state.isCompleted, state.status]);

  return (
    <form action={formAction} className="complete-action">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="completed" value={String(isCompleted)} />
      <button
        type="submit"
        className={isCompleted ? "button button-muted" : "button button-primary"}
        disabled={isPending}
        aria-label={`${title} ${isCompleted ? "미완료로 변경" : "완료 처리"}`}
      >
        {!isPending && (isCompleted ? <UndoIcon /> : <CheckIcon />)}
        {isPending ? "처리 중..." : isCompleted ? "되돌리기" : "완료"}
      </button>
      {state.message && (
        <span
          className={state.status === "error" ? "complete-action__error" : "complete-action__success"}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
