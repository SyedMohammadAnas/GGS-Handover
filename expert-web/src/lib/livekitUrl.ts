/**
 * The LiveKit URL comes straight from NEXT_PUBLIC_LIVEKIT_URL (set by the installer).
 * HTTPS pages cannot dial cleartext ws:// (mixed content), so warn loudly if the
 * configuration is wrong instead of silently rewriting it.
 */
export function normalizeLiveKitClientUrl(url: string): string {
  const trimmed = url.trim();

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    trimmed.startsWith("ws://")
  ) {
    console.warn(
      "[LiveKit] Page is HTTPS but NEXT_PUBLIC_LIVEKIT_URL is ws:// — use wss:// (domain mode)."
    );
  }

  return trimmed;
}
