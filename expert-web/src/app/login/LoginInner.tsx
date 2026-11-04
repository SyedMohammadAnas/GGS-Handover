"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginInner() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError("Wrong email or password.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--bg)]">
      <form
        onSubmit={(e) => void signIn(e)}
        className="w-full max-w-md panel p-8 flex flex-col gap-5"
      >
        <div>
          <p className="text-[1.35rem] font-extrabold tracking-tight text-[var(--brand)]">
            Assist AR
          </p>
          <p className="text-sm text-[var(--muted)] mt-2">
            Sign in to join customer assist sessions.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Username (email)</span>
          <input
            className="input-field"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Password</span>
          <input
            className="input-field"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <button type="submit" disabled={busy} className="btn-connect w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-xs text-[var(--muted)] text-center">
          Customer?{" "}
          <Link href="/signup" className="text-[var(--brand)] font-medium">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
