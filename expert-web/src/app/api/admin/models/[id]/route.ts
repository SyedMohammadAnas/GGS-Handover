import { NextRequest } from "next/server";

import { requireApiAdmin } from "@/lib/auth";
import { backendAdminConfig } from "@/lib/backendAdmin";

/** Admin: delete an uploaded 3D model. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin(request);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const { id } = await context.params;
  const { baseUrl, headers } = backendAdminConfig();
  const res = await fetch(
    `${baseUrl}/api/admin/models/${encodeURIComponent(id)}`,
    { method: "DELETE", headers }
  );

  if (res.status === 204) {
    return new Response(null, { status: 204 });
  }
  const json = await res.json().catch(() => ({}));
  return Response.json(json, { status: res.status });
}
