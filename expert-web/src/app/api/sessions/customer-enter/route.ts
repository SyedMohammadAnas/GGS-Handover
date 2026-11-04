import { NextRequest } from "next/server";

import { requireApiAuth } from "@/lib/auth";
import { createLiveKitToken, getLiveKitPublicUrl } from "@/lib/livekit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Customer claims LiveKit token for their active session (after expert joins). */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { session: authed } = auth;
  const admin = createAdminClient();

  // Prefer latest active session with an expert assigned.
  const { data: sessions, error } = await admin
    .from("sessions")
    .select(
      "id, join_code, room_name, customer_id, technician_id, status, created_at"
    )
    .eq("customer_id", authed.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[customer-enter] lookup", error.message);
    return Response.json({ error: "Failed to look up session" }, { status: 500 });
  }

  const session =
    (sessions ?? []).find((row) => row.technician_id) ?? (sessions ?? [])[0] ?? null;

  if (!session) {
    return Response.json(
      { error: "No active session. Wait for an expert to join your ID." },
      { status: 404 }
    );
  }

  if (!session.technician_id) {
    return Response.json(
      { error: "No active session. Wait for an expert to join your ID." },
      { status: 404 }
    );
  }

  const livekitUrl = getLiveKitPublicUrl();
  console.log(
    `[customer-enter] user=${authed.user.id} session=${session.id} livekit=${livekitUrl}`
  );

  const token = await createLiveKitToken({
    roomName: session.room_name,
    identity: authed.user.id,
    name: authed.profile.display_name ?? authed.profile.email,
  });

  return Response.json({
    sessionId: session.id,
    roomName: session.room_name,
    joinCode: session.join_code,
    status: session.status,
    token,
    livekitUrl,
  });
}
