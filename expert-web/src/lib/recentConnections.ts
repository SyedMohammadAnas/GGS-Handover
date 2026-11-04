import { formatPublicId, normalizePublicId } from "@/lib/publicId";

const STORAGE_KEY = "assist-ar.recent-connections.v1";
const MAX_ITEMS = 8;

export type RecentConnection = {
  publicId: string;
  label: string;
  lastConnectedAt: string;
};

export function loadRecentConnections(): RecentConnection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentConnection[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item?.publicId === "string");
  } catch {
    return [];
  }
}

export function rememberRecentConnection(input: {
  publicId: string;
  label?: string | null;
}): RecentConnection[] {
  if (typeof window === "undefined") return [];
  const publicId = normalizePublicId(input.publicId);
  if (!/^\d{11}$/.test(publicId)) return loadRecentConnections();

  const label =
    input.label?.trim() ||
    formatPublicId(publicId);

  const next: RecentConnection = {
    publicId,
    label,
    lastConnectedAt: new Date().toISOString(),
  };

  const others = loadRecentConnections().filter(
    (item) => normalizePublicId(item.publicId) !== publicId
  );
  const list = [next, ...others].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("[recentConnections] save failed", err);
  }
  return list;
}
