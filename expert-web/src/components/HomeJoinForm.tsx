"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  formatCallLogLine,
  explainCallFailure,
} from "@/lib/callErrors";
import {
  formatPublicId,
  isValidPublicId,
  normalizePublicId,
} from "@/lib/publicId";
import {
  loadRecentConnections,
  rememberRecentConnection,
  type RecentConnection,
} from "@/lib/recentConnections";

/** Sidebar join control — Assist AR "Provide support using ID". */
export function HomeJoinForm() {
  const router = useRouter();
  const [publicId, setPublicId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recent, setRecent] = useState<RecentConnection[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecent(loadRecentConnections());
  }, []);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function handleJoin(rawId?: string) {
    const candidate = rawId ?? publicId;
    if (!isValidPublicId(candidate)) {
      setIsError(true);
      setStatus(
        formatCallLogLine({
          at: new Date().toLocaleTimeString(),
          level: "error",
          phase: "Connect",
          message: "Enter a valid 11-digit customer ID.",
        })
      );
      return;
    }

    setBusy(true);
    setIsError(false);
    setMenuOpen(false);
    setStatus(
      formatCallLogLine({
        at: new Date().toLocaleTimeString(),
        level: "info",
        phase: "Connect",
        message: "Joining session…",
      })
    );

    try {
      const normalized = normalizePublicId(candidate);
      const res = await fetch("/api/sessions/join-by-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPublicId: normalized }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Join failed (${res.status})`);
      }

      const customerLabel =
        data.customer?.displayName ||
        data.customer?.email ||
        formatPublicId(normalized);
      setRecent(
        rememberRecentConnection({
          publicId: normalized,
          label: customerLabel,
        })
      );

      const params = new URLSearchParams();
      if (data.token) {
        params.set("token", data.token);
      }
      const qs = params.toString();
      router.push(`/s/${data.sessionId}${qs ? `?${qs}` : ""}`);
    } catch (err) {
      const entry = explainCallFailure(err, "Connect");
      setIsError(true);
      setStatus(formatCallLogLine(entry));
      console.error("[Connect]", formatCallLogLine(entry), err);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-[var(--muted)] flex flex-col gap-1.5">
        End user&apos;s ID
        <div ref={wrapRef} className="relative">
          <input
            className="input-field pr-10"
            inputMode="numeric"
            placeholder="Enter end user's ID"
            value={publicId}
            onChange={(e) => setPublicId(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleJoin();
              }
            }}
            aria-autocomplete="list"
          />
          <button
            type="button"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-md text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--text)]"
            aria-label="Recent connections"
            title="Recent connections"
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            disabled={busy}
            onClick={() => {
              setRecent(loadRecentConnections());
              setMenuOpen((open) => !open);
            }}
          >
            <ChevronIcon open={menuOpen} />
          </button>

          {menuOpen ? (
            <div className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] rounded-lg border border-[var(--line)] bg-white shadow-lg overflow-hidden">
              <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] border-b border-[var(--line)]">
                Recent connections
              </p>
              {recent.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[var(--muted)]">
                  No recent connections yet.
                </p>
              ) : (
                <ul className="max-h-56 overflow-y-auto">
                  {recent.map((item) => (
                    <li key={item.publicId}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-black/[0.03] border-b border-[var(--line)] last:border-b-0"
                        onClick={() => {
                          setPublicId(formatPublicId(item.publicId));
                          setMenuOpen(false);
                          void handleJoin(item.publicId);
                        }}
                      >
                        <span className="block text-sm font-medium text-[var(--text)] truncate">
                          {item.label}
                        </span>
                        <span className="block text-[11px] text-[var(--muted)] truncate">
                          {formatPublicId(item.publicId)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          className="btn-connect"
          disabled={busy}
          onClick={() => {
            void handleJoin();
          }}
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
      </div>
      {status ? (
        <p
          className={`text-xs whitespace-pre-wrap pt-1 ${
            isError ? "text-[var(--danger)]" : "text-[var(--muted)]"
          }`}
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
