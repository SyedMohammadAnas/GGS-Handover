/**
 * Server-side access to the Express API's admin endpoints (3D model upload/list/delete).
 * BACKEND_INTERNAL_URL is the in-network address (e.g. http://api:3000); it falls back
 * to the public API URL if unset.
 */
export function backendAdminConfig(): { baseUrl: string; headers: Record<string, string> } {
  const baseUrl = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_ASSETS_URL ||
    process.env.NEXT_PUBLIC_BACKEND_ASSETS_URL ||
    ""
  ).replace(/\/$/, "");
  const key = process.env.DASHBOARD_KEY;

  if (!baseUrl || !key) {
    throw new Error("BACKEND_INTERNAL_URL and DASHBOARD_KEY are required");
  }

  return { baseUrl, headers: { "x-dashboard-key": key } };
}
