/** Diary block colours — one distinct swatch per service (supports ~30+ services). */
export const SERVICE_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#78716c",
  "#64748b",
  "#475569",
  "#059669",
  "#0d9488",
  "#0284c7",
  "#4f46e5",
  "#7c3aed",
  "#c026d3",
  "#e11d48",
  "#ca8a04",
  "#65a30d",
  "#0891b2",
] as const;

/** Palette plus any saved colour not in the list (legacy/custom picks). */
export function serviceColorOptions(selected: string): readonly string[] {
  const hex = selected.trim();
  if (hex && !SERVICE_COLORS.includes(hex as (typeof SERVICE_COLORS)[number])) {
    return [hex, ...SERVICE_COLORS];
  }
  return SERVICE_COLORS;
}

export function serviceColorLabel(hex: string): string {
  if (!hex.trim()) return "Default (diary green)";
  return hex.toUpperCase();
}
