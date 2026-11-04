import { NextResponse } from "next/server";

import manifest from "@/data/model-catalog.manifest.json";
import {
  buildCatalogFromManifest,
  resolveAssetsBaseUrl,
  type ModelManifestFile,
} from "@/lib/modelCatalog";

export const dynamic = "force-dynamic";

/**
 * Model catalog for the expert sidebar and the iPhone app's model drawer.
 *
 * Reads the live list from the API server, so models the admin uploads appear
 * immediately. Falls back to the bundled manifest if the API is unreachable.
 */
export async function GET() {
  const publicBase = resolveAssetsBaseUrl();
  const internalBase = (process.env.BACKEND_INTERNAL_URL || publicBase).replace(
    /\/$/,
    ""
  );
  const dashboardKey = process.env.DASHBOARD_KEY;

  if (dashboardKey) {
    try {
      const res = await fetch(`${internalBase}/api/admin/models`, {
        headers: { "x-dashboard-key": dashboardKey },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        return NextResponse.json(await res.json());
      }
      console.warn("[api/models] live fetch failed", res.status);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[api/models] live fetch error", message);
    }
  }

  const models = buildCatalogFromManifest(
    manifest as ModelManifestFile,
    publicBase
  );

  return NextResponse.json({ models });
}
