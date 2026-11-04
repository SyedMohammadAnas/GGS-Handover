"use client";

import { useEffect } from "react";

type AssistToastProps = {
  message: string | null;
  onDismiss: () => void;
  /** Auto-hide after this many ms (default 3200). */
  durationMs?: number;
};

/** Lightweight bottom toast for expert-web call events. */
export function AssistToast({
  message,
  onDismiss,
  durationMs = 3200,
}: AssistToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, message, onDismiss]);

  if (!message) return null;

  return (
    <div className="assist-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
