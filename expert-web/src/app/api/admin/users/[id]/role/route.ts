import { NextRequest } from "next/server";

import { requireApiAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ROLES = new Set(["customer", "expert", "admin"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const role = String(body?.role ?? "");

  if (!ALLOWED_ROLES.has(role)) {
    return Response.json(
      { error: "Role must be customer, expert, or admin" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .select("id, email, display_name, role, public_id, created_at")
    .single();

  if (error || !data) {
    return Response.json({ error: "Failed to update role" }, { status: 500 });
  }

  return Response.json({ user: data });
}
