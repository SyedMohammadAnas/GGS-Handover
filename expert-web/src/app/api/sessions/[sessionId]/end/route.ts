import { NextRequest } from "next/server";

import { requireApiAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
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

  if (session.status === "ended") {
    return Response.json({ sessionId: session.id, status: "ended" });
  }

  const { data: updated, error: updateError } = await admin
    .from("sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("id, status")
    .single();

  if (updateError || !updated) {
    return Response.json({ error: "Failed to end session" }, { status: 500 });
  }

  return Response.json({ sessionId: updated.id, status: updated.status });
}
