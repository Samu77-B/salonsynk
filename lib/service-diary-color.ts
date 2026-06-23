import { SERVICE_COLORS } from "@/lib/service-colors";

export const DEFAULT_DIARY_COLOR = "#22c55e";

export type DiaryColorService = {
  id: string;
  color?: string | null;
  category_id?: string | null;
};

export type DiaryColorCategory = {
  id: string;
  color?: string | null;
};

/** Service colour wins; otherwise category; otherwise default green. */
export function resolveDiaryColor(
  serviceColor?: string | null,
  categoryColor?: string | null,
  fallback = DEFAULT_DIARY_COLOR
): string {
  const svc = serviceColor?.trim();
  if (svc) return svc;
  const cat = categoryColor?.trim();
  if (cat) return cat;
  return fallback;
}

export function buildServiceDiaryColorMap(
  services: DiaryColorService[],
  categories: DiaryColorCategory[]
): Record<string, string> {
  const catById = new Map(categories.map((c) => [c.id, c.color ?? null]));
  const map: Record<string, string> = {};
  for (const svc of services) {
    const catColor = svc.category_id ? (catById.get(svc.category_id) ?? null) : null;
    map[svc.id] = resolveDiaryColor(svc.color, catColor);
  }
  return map;
}

/** Pick the first palette colour not already used by another category in this salon. */
export function pickNextCategoryColor(usedColors: Iterable<string>): string {
  const used = new Set(
    [...usedColors]
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean)
  );
  for (const hex of SERVICE_COLORS) {
    if (!used.has(hex.toLowerCase())) return hex;
  }
  return SERVICE_COLORS[used.size % SERVICE_COLORS.length];
}
