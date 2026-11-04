import { NextRequest } from "next/server";

import { requireApiExpert } from "@/lib/auth";
import { createLiveKitToken, getLiveKitPublicUrl } from "@/lib/livekit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Expert rejoin — fresh LiveKit token when already assigned as technician. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireApiExpert(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { session: authed } = auth;
  const { sessionId } = await context.params;
  const admin = createAdminClient();

  const { data: session, error } = await admin
    .from("sessions")
    .select(
      "id, join_code, room_name, customer_id, technician_id, status"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Failed to look up session" }, { status: 500 });
  }

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "active") {
    return Response.json(
      { error: "Session is not active" },
      { status: 409 }
    );
  }

  if (session.technician_id !== authed.user.id) {
    return Response.json(
      { error: "You are not the expert on this session" },
      { status: 403 }
    );
  }

  // Load customer card fields for the Assist AR sidebar.
  const { data: customerProfile } = await admin
    .from("profiles")
    .select("id, email, display_name, public_id, avatar_url")
    .eq("id", session.customer_id)
    .maybeSingle();

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
    livekitUrl: getLiveKitPublicUrl(),
    customer: customerProfile
      ? {
          id: customerProfile.id,
          email: customerProfile.email,
          displayName: customerProfile.display_name,
          publicId: customerProfile.public_id,
          avatarUrl: customerProfile.avatar_url,
        }
      : null,
  });
}
