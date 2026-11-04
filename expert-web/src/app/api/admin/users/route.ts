import { NextRequest } from "next/server";

import { requireApiAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PROFILE_COLUMNS = "id, email, display_name, role, public_id, created_at";

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to list users" }, { status: 500 });
  }

  return Response.json({ users: data ?? [] });
}

/** Admin creates an expert (or another admin) with an email and password. */
export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim();
  const role = body?.role === "admin" ? "admin" : "expert";

  if (!email || !email.includes("@")) {
    return Response.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: displayName ? { full_name: displayName } : {},
    });

  if (createError || !created.user) {
    return Response.json(
      { error: createError?.message ?? "Failed to create user" },
      { status: 400 }
    );
  }

  // A database trigger creates the profile as "customer"; promote it here.
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", created.user.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (profileError || !profile) {
    return Response.json(
      { error: "User created but role update failed" },
      { status: 500 }
    );
  }

  return Response.json({ user: profile }, { status: 201 });
}
