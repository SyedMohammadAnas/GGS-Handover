import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** App roles — `technician` kept for legacy rows in Supabase. */
export type AppRole = "customer" | "expert" | "admin" | "technician";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  role: AppRole | null;
  public_id: string | null;
  created_at?: string;
  avatar_url?: string | null;
};

export type SessionUser = {
  user: User;
  profile: Profile;
};

const PROFILE_SELECT =
  "id, email, display_name, role, public_id, created_at, avatar_url";

export function isExpertRole(role: string | null | undefined): boolean {
  return role === "expert" || role === "admin" || role === "technician";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  return profile as Profile;
}

/** Cookie session for Server Components / layouts. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profile = await loadProfile(user.id);
  if (!profile) {
    return null;
  }

  return { user, profile };
}

/** Bearer token or cookie session for Route Handlers. */
export async function getApiSessionUser(
  request: NextRequest
): Promise<SessionUser | null> {
  const header = request.headers.get("authorization");
  const admin = createAdminClient();

  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    const profile = await loadProfile(data.user.id);
    if (!profile) {
      return null;
    }
    return { user: data.user, profile };
  }

  return getSessionUser();
}

export async function requireExpert(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isExpertRole(session.profile.role)) {
    redirect("/");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isAdminRole(session.profile.role)) {
    redirect("/");
  }
  return session;
}

export function jsonAuthError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function requireApiExpert(request: NextRequest) {
  const session = await getApiSessionUser(request);
  if (!session) {
    return { error: jsonAuthError("Unauthorized", 401) as Response };
  }
  if (!isExpertRole(session.profile.role)) {
    return {
      error: jsonAuthError("Expert or admin role required", 403) as Response,
    };
  }
  return { session };
}

export async function requireApiAdmin(request: NextRequest) {
  const session = await getApiSessionUser(request);
  if (!session) {
    return { error: jsonAuthError("Unauthorized", 401) as Response };
  }
  if (!isAdminRole(session.profile.role)) {
    return { error: jsonAuthError("Admin role required", 403) as Response };
  }
  return { session };
}

export async function requireApiAuth(request: NextRequest) {
  const session = await getApiSessionUser(request);
  if (!session) {
    return { error: jsonAuthError("Unauthorized", 401) as Response };
  }
  return { session };
}
