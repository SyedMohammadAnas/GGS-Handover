"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatPublicId } from "@/lib/publicId";

type RecentSession = {
  id: string;
  joinCode: string;
  status: string;
  createdAt: string;
  endedAt: string | null;
  customer: {
    email: string;
    displayName: string | null;
    publicId: string | null;
  } | null;
};

const PREVIEW_LIMIT = 3;

/** Real previous sessions for this expert (from Supabase via /api/sessions/recent). */
export function PreviousSessions() {
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewAllOpen, setViewAllOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions/recent");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load sessions");
      }
      setSessions((data.sessions ?? []) as RecentSession[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Close modal on Escape.
  useEffect(() => {
    if (!viewAllOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewAllOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewAllOpen]);

  const preview = sessions.slice(0, PREVIEW_LIMIT);
  const hasMore = sessions.length > PREVIEW_LIMIT;

  return (
    <section className="assist-section">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="assist-section-title mb-0">Previous AR sessions</h2>
        <button
          type="button"
          className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
          onClick={() => void load()}
          title="Refresh"
        >
          {loading ? "loading…" : "refresh"}
        </button>
      </div>

      {error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : null}

      {!loading && !error && preview.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          No sessions yet. Connect with a customer ID.
        </p>
      ) : null}

      <div className="session-accordion">
        {preview.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            expanded={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
          />
        ))}
      </div>

      {hasMore ? (
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            className="btn-link"
            onClick={() => setViewAllOpen(true)}
          >
            View all ({sessions.length})
          </button>
        </div>
      ) : null}

      {viewAllOpen ? (
        <div
          className="assist-modal-backdrop"
          role="presentation"
          onClick={() => setViewAllOpen(false)}
        >
          <div
            className="assist-modal"
            role="dialog"
            aria-modal="true"
            aria-label="All previous AR sessions"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                All previous AR sessions
              </h3>
              <button
                type="button"
                className="btn-ghost text-xs py-1.5 px-2.5"
                onClick={() => setViewAllOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="session-accordion border-0 rounded-none shadow-none">
                {sessions.map((s) => (
                  <SessionRow
                    key={`all-${s.id}`}
                    session={s}
                    expanded={openId === s.id}
                    onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SessionRow({
  session: s,
  expanded,
  onToggle,
}: {
  session: RecentSession;
  expanded: boolean;
  onToggle: () => void;
}) {
  const name =
    s.customer?.displayName?.trim() || s.customer?.email || "Customer";
  const when = formatWhen(s.createdAt);

  return (
    <div className="border-b border-[var(--line)] last:border-b-0">
      <button
        type="button"
        className="session-accordion-row border-b-0"
        onClick={onToggle}
      >
        <span className="min-w-0 text-left">
          <span className="block truncate font-medium">{name}</span>
          <span className="block text-[11px] text-[var(--muted)] truncate">
            {when} · {s.joinCode} · {s.status}
          </span>
        </span>
        <ChevronIcon open={expanded} />
      </button>
      {expanded ? (
        <div className="px-3 pb-3 text-[11px] text-[var(--muted)] space-y-1">
          {s.customer?.publicId ? (
            <p>ID {formatPublicId(s.customer.publicId)}</p>
          ) : null}
          {s.customer?.email ? (
            <p className="truncate">{s.customer.email}</p>
          ) : null}
          {s.status === "active" ? (
            <Link
              href={`/s/${s.id}`}
              className="inline-block mt-1 text-[var(--connect)] font-semibold"
            >
              Rejoin call →
            </Link>
          ) : (
            <p className="pt-0.5">Ended session (read-only)</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
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
