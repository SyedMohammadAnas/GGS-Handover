import { AccessToken } from "livekit-server-sdk";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

/** URL the browser (and phone) use to reach LiveKit — set by the installer. */
export function getLiveKitPublicUrl(): string {
  return requiredEnv("NEXT_PUBLIC_LIVEKIT_URL").trim();
}

export async function createLiveKitToken(params: {
  roomName: string;
  identity: string;
  name: string;
}): Promise<string> {
  const token = new AccessToken(
    requiredEnv("LIVEKIT_API_KEY"),
    requiredEnv("LIVEKIT_API_SECRET"),
    {
      identity: params.identity,
      name: params.name,
      ttl: "1h",
    }
  );

  token.addGrant({
    roomJoin: true,
    room: params.roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return token.toJwt();
}
