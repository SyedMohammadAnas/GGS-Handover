import { NextRequest } from "next/server";

import { requireApiAdmin } from "@/lib/auth";
import { backendAdminConfig } from "@/lib/backendAdmin";

export const dynamic = "force-dynamic";

/** Admin: list uploaded 3D models. */
export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { baseUrl, headers } = backendAdminConfig();
  const res = await fetch(`${baseUrl}/api/admin/models`, {
    headers,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return Response.json(json, { status: res.status });
}

/** Admin: upload a .usdz model (and optional thumbnail). */
export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const incoming = await request.formData().catch(() => null);
  const model = incoming?.get("model");
  if (!incoming || !(model instanceof File) || model.size === 0) {
    return Response.json(
      { error: "Choose a .usdz file to upload" },
      { status: 400 }
    );
  }
  if (!/\.usdz$/i.test(model.name)) {
    return Response.json(
      { error: "Only .usdz files work in the iPhone AR view" },
      { status: 400 }
    );
  }

  const outgoing = new FormData();
  outgoing.append("model", model, model.name);
  const thumbnail = incoming.get("thumbnail");
  if (thumbnail instanceof File && thumbnail.size > 0) {
    outgoing.append("thumbnail", thumbnail, thumbnail.name);
  }
  const name = String(incoming.get("name") ?? "").trim();
  if (name) {
    outgoing.append("name", name);
  }
  const description = String(incoming.get("description") ?? "").trim();
  if (description) {
    outgoing.append("description", description);
  }

  const { baseUrl, headers } = backendAdminConfig();
  const res = await fetch(`${baseUrl}/api/admin/models/upload`, {
    method: "POST",
    headers,
    body: outgoing,
  });
  const json = await res.json().catch(() => ({}));
  return Response.json(json, { status: res.status });
}
