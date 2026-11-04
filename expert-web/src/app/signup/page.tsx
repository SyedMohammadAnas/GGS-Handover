"use client";

import Link from "next/link";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** Customer sign-up. Every account created here is a customer; experts are created by the admin. */
export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function signUp(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      // Customers use the phone app, not this console.
      await supabase.auth.signOut();
      setDone(true);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--bg)]">
      <form
        onSubmit={(e) => void signUp(e)}
        className="w-full max-w-md panel p-8 flex flex-col gap-5"
      >
        <div>
          <p className="text-[1.35rem] font-extrabold tracking-tight text-[var(--brand)]">
            Assist AR
          </p>
          <p className="text-sm text-[var(--muted)] mt-2">
            Create a customer account, then sign in on the Instant iPhone app.
          </p>
        </div>

        {done ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--text)]">
              Account created. Open the Instant app and sign in with this email
              and password.
            </p>
            <Link href="/login" className="btn-ghost text-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Name</span>
              <input
                className="input-field"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Email</span>
              <input
                className="input-field"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Password (8+ characters)</span>
              <input
                className="input-field"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : null}

            <button type="submit" disabled={busy} className="btn-connect w-full">
              {busy ? "Creating…" : "Create account"}
            </button>

            <p className="text-xs text-[var(--muted)] text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-[var(--brand)] font-medium">
                Sign in
              </Link>
            </p>
          </>
        )}
      </form>
    </div>
  );
}
