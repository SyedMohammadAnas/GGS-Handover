"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type ExpertFooterProps = {
  name: string;
  email: string;
  roleLabel?: string;
  avatarUrl?: string | null;
  showAdmin?: boolean;
};

/** Bottom rail: signed-in expert identity + settings / sign-out. */
export function ExpertFooter({
  name,
  email,
  roleLabel = "Expert",
  avatarUrl,
  showAdmin = false,
}: ExpertFooterProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="expert-footer">
      <div className="h-10 w-10 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] grid place-items-center overflow-hidden shrink-0 font-semibold text-sm">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials || "E"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text)] truncate">{name}</p>
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[11px] text-[var(--muted)] truncate">{email}</p>
          <span className="role-pill role-pill-expert shrink-0">{roleLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {showAdmin ? (
          <Link
            href="/admin"
            className="tool-icon-btn"
            title="Admin"
            aria-label="Admin"
          >
            <AdminIcon />
          </Link>
        ) : null}
        <button
          type="button"
          className="tool-icon-btn"
          title="Sign out"
          aria-label="Sign out"
          onClick={() => void signOut()}
        >
          <GearIcon />
        </button>
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13a7.6 7.6 0 0 0 .1-2l2-1.2-2-3.4-2.3.6a7.7 7.7 0 0 0-1.7-1L15 3h-6l-.5 2.8a7.7 7.7 0 0 0-1.7 1L4.5 6.4l-2 3.4 2 1.2a7.6 7.6 0 0 0 0 2l-2 1.2 2 3.4 2.3-.6a7.7 7.7 0 0 0 1.7 1L9 21h6l.5-2.8a7.7 7.7 0 0 0 1.7-1l2.3.6 2-3.4-2-1.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4v5c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V7l8-4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
