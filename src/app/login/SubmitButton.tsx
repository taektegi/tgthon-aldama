"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  className,
  pendingLabel,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} {...props}>
      {pending ? (pendingLabel ?? "처리 중...") : children}
    </button>
  );
}
