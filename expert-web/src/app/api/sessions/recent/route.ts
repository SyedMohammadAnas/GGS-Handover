import { NextRequest } from "next/server";

import { requireApiExpert } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type SessionRow = {
  id: string;
  join_code: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  customer_id: string;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  public_id: string | null;
};

/** Recent sessions this expert joined — for Assist AR sidebar history. */
export async function GET(request: NextRequest) {
  const auth = await requireApiExpert(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { session: authed } = auth;
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("sessions")
    .select("id, join_code, status, created_at, ended_at, customer_id")
    .eq("technician_id", authed.user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[sessions/recent]", error.message);
    return Response.json({ error: "Failed to load sessions" }, { status: 500 });
  }

  const sessions = (rows ?? []) as SessionRow[];
  const customerIds = [...new Set(sessions.map((s) => s.customer_id))];

  const profilesById: Record<string, ProfileRow> = {};
  if (customerIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, display_name, public_id")
      .in("id", customerIds);
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profilesById[p.id] = p;
    }
  }

  return Response.json({
    sessions: sessions.map((s) => {
      const customer = profilesById[s.customer_id];
      return {
        id: s.id,
        joinCode: s.join_code,
        status: s.status,
        createdAt: s.created_at,
        endedAt: s.ended_at,
        customer: customer
          ? {
              email: customer.email,
              displayName: customer.display_name,
              publicId: customer.public_id,
            }
          : null,
      };
    }),
  });
}
