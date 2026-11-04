import { Suspense } from "react";

import LoginInner from "./LoginInner";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
