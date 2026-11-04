import { NextRequest } from "next/server";

import { requireApiAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Lightweight status check so Instant can leave when the expert ends mid-join. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireApiAuth(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { session: authed } = auth;
  const { sessionId } = await context.params;
  const admin = createAdminClient();

  const { data: session, error } = await admin
    .from("sessions")
    .select("id, customer_id, technician_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Failed to look up session" }, { status: 500 });
  }

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const isParticipant =
    session.customer_id === authed.user.id ||
    session.technician_id === authed.user.id;

  if (!isParticipant) {
    return Response.json(
      { error: "Not a participant in this session" },
      { status: 403 }
    );
  }

  return Response.json({
    sessionId: session.id,
    status: session.status,
  });
}
