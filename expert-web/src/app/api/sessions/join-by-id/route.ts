import { NextRequest } from "next/server";

import { requireApiExpert } from "@/lib/auth";
import { generateJoinCode } from "@/lib/joinCode";
import { createLiveKitToken, getLiveKitPublicUrl } from "@/lib/livekit";
import { isValidPublicId, normalizePublicId } from "@/lib/publicId";
import { createAdminClient } from "@/lib/supabase/admin";

type SessionRow = {
  id: string;
  join_code: string;
  room_name: string;
  customer_id: string;
  technician_id: string | null;
  status: string;
};

type CustomerCard = {
  id: string;
  email: string;
  displayName: string | null;
  publicId: string | null;
  avatarUrl: string | null;
};

async function joinSessionAsTechnician(
  session: SessionRow,
  userId: string,
  displayName: string,
  email: string,
  customer: CustomerCard
) {
  if (session.customer_id === userId) {
    return Response.json(
      { error: "You cannot join your own session" },
      { status: 400 }
    );
  }

  if (session.technician_id && session.technician_id !== userId) {
    return Response.json(
      { error: "Session already has an expert" },
      { status: 409 }
    );
  }

  const admin = createAdminClient();
  const { data: updated, error: updateError } = await admin
    .from("sessions")
    .update({
      technician_id: userId,
      status: "active",
    })
    .eq("id", session.id)
    .select("id, join_code, room_name, status")
    .single();

  if (updateError || !updated) {
    return Response.json({ error: "Failed to join session" }, { status: 500 });
  }

  const token = await createLiveKitToken({
    roomName: updated.room_name,
    identity: userId,
    name: displayName ?? email,
  });

  return Response.json({
    sessionId: updated.id,
    roomName: updated.room_name,
    joinCode: updated.join_code,
    status: updated.status,
    token,
    livekitUrl: getLiveKitPublicUrl(),
    customer,
  });
}

/** Expert joins (or creates) a session for a customer public ID. */
export async function POST(request: NextRequest) {
  const auth = await requireApiExpert(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { session: authed } = auth;
  const body = await request.json().catch(() => ({}));
  const rawId = String(body?.targetPublicId ?? "");

  console.log(
    `[join-by-id] expert=${authed.user.id} targetPublicId=${rawId} livekit=${getLiveKitPublicUrl()}`
  );

  if (!isValidPublicId(rawId)) {
    return Response.json(
      { error: "Invalid ID. Enter an 11-digit customer ID." },
      { status: 400 }
    );
  }

  const publicId = normalizePublicId(rawId);
  const admin = createAdminClient();

  // Include display fields so the Assist AR active-session card can render.
  const { data: customerProfile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, display_name, public_id, avatar_url")
    .eq("public_id", publicId)
    .maybeSingle();

  if (profileError) {
    return Response.json({ error: "Failed to look up customer" }, { status: 500 });
  }

  if (!customerProfile) {
    return Response.json(
      { error: "Customer not found. Check the ID." },
      { status: 404 }
    );
  }

  if (customerProfile.id === authed.user.id) {
    return Response.json(
      { error: "You cannot join your own session" },
      { status: 400 }
    );
  }

  const { data: session, error } = await admin
    .from("sessions")
    .select(
      "id, join_code, room_name, customer_id, technician_id, status"
    )
    .eq("customer_id", customerProfile.id)
    .eq("status", "waiting")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Failed to look up session" }, { status: 500 });
  }

  let sessionToJoin = session as SessionRow | null;

  if (!sessionToJoin) {
    const { data: activeSession } = await admin
      .from("sessions")
      .select("id, status")
      .eq("customer_id", customerProfile.id)
      .eq("status", "active")
      .maybeSingle();

    if (activeSession) {
      return Response.json(
        { error: "Customer is already in an active session" },
        { status: 409 }
      );
    }

    const joinCode = generateJoinCode();
    const roomName = crypto.randomUUID();

    const { data: created, error: createError } = await admin
      .from("sessions")
      .insert({
        join_code: joinCode,
        room_name: roomName,
        customer_id: customerProfile.id,
        status: "waiting",
      })
      .select(
        "id, join_code, room_name, customer_id, technician_id, status"
      )
      .single();

    if (createError || !created) {
      return Response.json(
        { error: "Failed to create session for customer" },
        { status: 500 }
      );
    }

    sessionToJoin = created as SessionRow;
  }

  return joinSessionAsTechnician(
    sessionToJoin,
    authed.user.id,
    authed.profile.display_name ?? authed.profile.email,
    authed.profile.email,
    {
      id: customerProfile.id,
      email: customerProfile.email,
      displayName: customerProfile.display_name,
      publicId: customerProfile.public_id,
      avatarUrl: customerProfile.avatar_url,
    }
  );
}
