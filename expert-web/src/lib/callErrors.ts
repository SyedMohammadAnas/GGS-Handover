/** Human-readable call / LiveKit errors with timestamps for Assist AR debugging. */

export type CallLogLevel = "info" | "warn" | "error";

export type CallLogEntry = {
  at: string;
  level: CallLogLevel;
  phase: string;
  message: string;
  hint?: string;
};

function stamp(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Map raw LiveKit / network failures into expert-facing copy + fix hint. */
export function explainCallFailure(
  err: unknown,
  phase: string
): CallLogEntry {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  let message = raw;
  let hint: string | undefined;

  if (
    lower.includes("load failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("signal")
  ) {
    message = `Signal connection failed (${raw})`;
    hint =
      "Check the server is running (docker compose ps), and that NEXT_PUBLIC_LIVEKIT_URL uses wss:// — not ws:// — when this page is on HTTPS.";
  } else if (lower.includes("401") || lower.includes("unauthorized")) {
    message = `Auth failed during ${phase}`;
    hint = "Sign out and sign back in, then reconnect.";
  } else if (lower.includes("403") || lower.includes("forbidden")) {
    message = `Not allowed during ${phase}`;
    hint = "Confirm this account is expert/admin and owns this session.";
  } else if (lower.includes("409")) {
    message = `Session conflict during ${phase}`;
    hint = "Another expert may already be on this call, or the session ended.";
  } else if (lower.includes("404") || lower.includes("not found")) {
    message = `Session not found during ${phase}`;
    hint = "Ask the customer to open Instant again, then Connect with their ID.";
  } else if (lower.includes("timeout") || lower.includes("timed out")) {
    message = `Timed out during ${phase}`;
    hint =
      "Retry once; if it keeps failing, check that the LiveKit container is running and its media ports (7881/tcp, 7882/udp) are reachable.";
  } else if (lower.includes("ice") || lower.includes("webrtc")) {
    message = `Media path failed (${raw})`;
    hint =
      "Signaling may be up but the media ports are blocked. Open 7881/tcp and 7882/udp on the server firewall (see HANDOVER.md, Networking).";
  }

  return {
    at: stamp(),
    level: "error",
    phase,
    message,
    hint,
  };
}

export function callInfo(phase: string, message: string): CallLogEntry {
  return { at: stamp(), level: "info", phase, message };
}

export function callWarn(phase: string, message: string, hint?: string): CallLogEntry {
  return { at: stamp(), level: "warn", phase, message, hint };
}

export function formatCallLogLine(entry: CallLogEntry): string {
  const base = `[${entry.at}] ${entry.phase}: ${entry.message}`;
  return entry.hint ? `${base} — ${entry.hint}` : base;
}
