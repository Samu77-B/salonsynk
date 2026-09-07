export const PRODUCT_OPTION_MAX = 40;
export const MAX_PRODUCT_VARIANTS = 80;
export const DEFAULT_SIZE_PRESETS = ["Small", "Medium", "Large"] as const;

export type ProductVariantRow = {
  id: string;
  color: string;
  size: string;
  stock_quantity: number;
  image_url: string | null;
  sort_order?: number;
};

export type VariantInput = {
  color: string;
  size: string;
  stock_quantity: number;
  image_url?: string | null;
  sort_order?: number;
};

export type VariantDraft = {
  colors: string[];
  sizes: string[];
  colorImages: Record<string, string>;
  qtyByKey: Record<string, string>;
  stockOnlyQty: string;
};

export function emptyVariantDraft(): VariantDraft {
  return { colors: [], sizes: [], colorImages: {}, qtyByKey: {}, stockOnlyQty: "" };
}

export function normalizeOption(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.length > PRODUCT_OPTION_MAX ? t.slice(0, PRODUCT_OPTION_MAX) : t;
}

export function variantKey(color: string, size: string): string {
  return `${normalizeOption(color).toLowerCase()}\0${normalizeOption(size).toLowerCase()}`;
}

export function formatVariantLabel(v: { color: string; size: string }): string {
  const c = normalizeOption(v.color);
  const s = normalizeOption(v.size);
  if (c && s) return `${c} / ${s}`;
  return c || s || "Standard";
}

export function totalVariantStock(variants: { stock_quantity: number }[]): number {
  return variants.reduce((sum, v) => sum + Math.max(0, v.stock_quantity || 0), 0);
}

export function hasOptionVariants(variants: { color: string; size: string }[]): boolean {
  return variants.some((v) => normalizeOption(v.color) !== "" || normalizeOption(v.size) !== "");
}

export function isStockOnlyVariants(variants: { color: string; size: string }[]): boolean {
  return variants.length > 0 && !hasOptionVariants(variants);
}

export function uniqueOptions(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const n = normalizeOption(raw);
    if (!n) continue;
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

export function variantsToDraft(variants: ProductVariantRow[]): VariantDraft {
  if (variants.length === 0) return emptyVariantDraft();
  if (isStockOnlyVariants(variants)) {
    const qty = variants[0]?.stock_quantity ?? 0;
    return { ...emptyVariantDraft(), stockOnlyQty: String(qty) };
  }
  const colors = uniqueOptions(variants.map((v) => v.color));
  const sizes = uniqueOptions(variants.map((v) => v.size));
  const colorImages: Record<string, string> = {};
  const qtyByKey: Record<string, string> = {};
  for (const v of variants) {
    qtyByKey[variantKey(v.color, v.size)] = String(Math.max(0, v.stock_quantity || 0));
    const c = normalizeOption(v.color);
    if (c && v.image_url && !colorImages[c.toLowerCase()]) {
      colorImages[c.toLowerCase()] = v.image_url;
    }
  }
  return { colors, sizes, colorImages, qtyByKey, stockOnlyQty: "" };
}

function parseQtyCell(raw: string | undefined): number | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function draftToVariantInputs(draft: VariantDraft): VariantInput[] {
  const colors = uniqueOptions(draft.colors);
  const sizes = uniqueOptions(draft.sizes);

  if (colors.length === 0 && sizes.length === 0) {
    const qty = parseQtyCell(draft.stockOnlyQty);
    if (qty == null) return [];
    return [{ color: "", size: "", stock_quantity: qty, image_url: null, sort_order: 0 }];
  }

  const colorList = colors.length > 0 ? colors : [""];
  const sizeList = sizes.length > 0 ? sizes : [""];
  const out: VariantInput[] = [];
  let sort = 0;
  for (const color of colorList) {
    const image = color ? draft.colorImages[color.toLowerCase()]?.trim() || null : null;
    for (const size of sizeList) {
      const qty = parseQtyCell(draft.qtyByKey[variantKey(color, size)]);
      if (qty == null) continue;
      out.push({
        color,
        size,
        stock_quantity: qty,
        image_url: image,
        sort_order: sort,
      });
      sort += 1;
    }
  }
  return out.slice(0, MAX_PRODUCT_VARIANTS);
}

export function summarizeVariantsForCatalog(variants: { color: string; size: string; stock_quantity: number }[]): string | null {
  if (!variants.length) return null;
  if (isStockOnlyVariants(variants)) {
    const qty = totalVariantStock(variants);
    return qty > 0 ? `${qty} in stock` : "Out of stock";
  }
  const colors = uniqueOptions(variants.map((v) => v.color));
  const sizes = uniqueOptions(variants.map((v) => v.size));
  const parts: string[] = [];
  if (colors.length) parts.push(`Colours: ${colors.join(", ")}`);
  if (sizes.length) parts.push(`Sizes: ${sizes.join(", ")}`);
  return parts.length ? parts.join(". ") : null;
}

export function variantImageForColor(
  variants: { color: string; image_url: string | null }[],
  color: string,
  fallback: string | null
): string | null {
  const want = normalizeOption(color).toLowerCase();
  if (!want) return fallback;
  const hit = variants.find((v) => normalizeOption(v.color).toLowerCase() === want && v.image_url);
  return hit?.image_url || fallback;
}
