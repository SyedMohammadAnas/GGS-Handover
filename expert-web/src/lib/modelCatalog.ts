import type { CatalogModel } from "@/lib/models";

/** Raw manifest entry — keep in sync with backend/assets/models/manifest.json */
export type ManifestModel = {
  id: string;
  name: string;
  fileName: string;
  thumbnailFileName?: string;
  description?: string;
  fileSizeBytes?: number;
  createdAt: string;
};

export type ModelManifestFile = {
  models: ManifestModel[];
};

/** Public API base URL embedded in model download links (phones download from here). */
export function resolveAssetsBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_BACKEND_ASSETS_URL ?? process.env.BACKEND_ASSETS_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_BACKEND_ASSETS_URL is required");
  }
  return base.replace(/\/$/, "");
}

export function buildCatalogFromManifest(
  manifest: ModelManifestFile,
  baseUrl: string
): CatalogModel[] {
  return manifest.models.map((model) => ({
    id: model.id,
    name: model.name,
    url: `${baseUrl}/assets/models/${model.fileName}`,
    thumbnailUrl: model.thumbnailFileName
      ? `${baseUrl}/assets/thumbnails/${model.thumbnailFileName}`
      : null,
    fileSizeBytes: model.fileSizeBytes ?? null,
    description: model.description ?? null,
    createdAt: model.createdAt,
  }));
}
