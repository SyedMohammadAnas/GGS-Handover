import { createBrowserClient } from "@supabase/ssr";

/** Same cookie name in browser, middleware and server so sessions are shared. */
export const AUTH_COOKIE_NAME = "sb-ggs-auth-token";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required"
    );
  }

  return createBrowserClient(url, anon, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
  });
}
