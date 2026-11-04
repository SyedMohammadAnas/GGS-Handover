/** Catalog entry from Homelab Express `/api/admin/models`. */
export type CatalogModel = {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  fileSizeBytes: number | null;
  description: string | null;
  createdAt: string;
};

export type ModelTransform = {
  rotationX: number;
  rotationY: number;
  scale: number;
};

export const DEFAULT_MODEL_SCALE = 0.15;

export function formatModelSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "USDZ";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
