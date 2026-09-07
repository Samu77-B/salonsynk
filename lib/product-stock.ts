import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatVariantLabel,
  hasOptionVariants,
  MAX_PRODUCT_VARIANTS,
  normalizeOption,
  type VariantInput,
} from "@/lib/product-variants";

export async function applyProductVariantStock(
  db: SupabaseClient,
  paymentIntentId: string
): Promise<void> {
  const id = paymentIntentId.trim();
  if (!id) return;
  const { error } = await db.rpc("apply_product_variant_stock", {
    p_payment_intent_id: id,
  });
  if (error) {
    console.error("[product-stock] apply failed", error.message, id);
  }
}

export type ResolvedRetailLines = {
  productSum: number;
  allowedProductIds: string[];
  allowedVariantIds: string[];
  error?: string;
};

/**
 * Resolves checkout/shop product lines. Variant products must include variantIds.
 * Simple products (no variants) use productIds only. Stock is checked, not decremented.
 */
export async function resolveRetailLines(
  db: SupabaseClient,
  salonId: string,
  input: { productIds: string[]; variantIds?: string[] }
): Promise<ResolvedRetailLines> {
  const productIds = [...new Set((input.productIds ?? []).filter(Boolean))];
  const variantIds = [...new Set((input.variantIds ?? []).filter(Boolean))];

  if (productIds.length === 0 && variantIds.length === 0) {
    return { productSum: 0, allowedProductIds: [], allowedVariantIds: [] };
  }

  let variantRows: {
    id: string;
    product_id: string;
    color: string;
    size: string;
    stock_quantity: number;
    is_active: boolean | null;
  }[] = [];

  if (variantIds.length > 0) {
    const { data, error } = await db
      .from("product_variants")
      .select("id, product_id, color, size, stock_quantity, is_active")
      .eq("salon_id", salonId)
      .in("id", variantIds);
    if (error) {
      return {
        productSum: 0,
        allowedProductIds: [],
        allowedVariantIds: [],
        error: "Could not load product options. Run the latest Products migration if this persists.",
      };
    }
    variantRows = data ?? [];
    if (variantRows.length !== variantIds.length) {
      return {
        productSum: 0,
        allowedProductIds: [],
        allowedVariantIds: [],
        error: "Invalid size or colour selection",
      };
    }
    for (const v of variantRows) {
      if (v.is_active === false) {
        return {
          productSum: 0,
          allowedProductIds: [],
          allowedVariantIds: [],
          error: `${formatVariantLabel(v)} is not available`,
        };
      }
      if ((v.stock_quantity ?? 0) < 1) {
        return {
          productSum: 0,
          allowedProductIds: [],
          allowedVariantIds: [],
          error: `${formatVariantLabel(v)} is out of stock`,
        };
      }
    }
  }

  const productIdsFromVariants = variantRows.map((v) => v.product_id);
  const allProductIds = [...new Set([...productIds, ...productIdsFromVariants])];

  const { data: prodRows, error: prodError } = await db
    .from("products")
    .select("id, name, price_minor, is_active")
    .eq("salon_id", salonId)
    .in("id", allProductIds);

  if (prodError) {
    return { productSum: 0, allowedProductIds: [], allowedVariantIds: [], error: prodError.message };
  }

  const products = (prodRows ?? []).filter((p) => p.is_active !== false);
  const productById = new Map(products.map((p) => [p.id as string, p]));

  if (products.length !== allProductIds.length && variantRows.length > 0) {
    const missing = allProductIds.filter((id) => !productById.has(id));
    if (missing.length) {
      return {
        productSum: 0,
        allowedProductIds: [],
        allowedVariantIds: [],
        error: "Invalid product selection",
      };
    }
  }

  let existingByProduct: { product_id: string; color: string; size: string }[] = [];
  if (allProductIds.length > 0) {
    const existing = await db
      .from("product_variants")
      .select("product_id, color, size")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .in("product_id", allProductIds);
    if (!existing.error) existingByProduct = existing.data ?? [];
  }

  const variantsForProduct = new Map<string, { color: string; size: string }[]>();
  for (const row of existingByProduct) {
    const list = variantsForProduct.get(row.product_id) ?? [];
    list.push({ color: row.color ?? "", size: row.size ?? "" });
    variantsForProduct.set(row.product_id, list);
  }

  const selectedVariantProductIds = new Set(productIdsFromVariants);
  const allowedProductIds: string[] = [];
  const allowedVariantIds: string[] = [];
  let productSum = 0;

  for (const vid of variantIds) {
    const v = variantRows.find((row) => row.id === vid);
    if (!v) continue;
    const product = productById.get(v.product_id);
    if (!product) {
      return {
        productSum: 0,
        allowedProductIds: [],
        allowedVariantIds: [],
        error: "Invalid product selection",
      };
    }
    allowedVariantIds.push(v.id);
    if (!allowedProductIds.includes(v.product_id)) allowedProductIds.push(v.product_id);
    productSum += Number(product.price_minor ?? 0);
  }

  for (const pid of productIds) {
    const product = productById.get(pid);
    if (!product) continue;
    const opts = variantsForProduct.get(pid) ?? [];
    if (opts.length === 0) {
      if (!allowedProductIds.includes(pid)) allowedProductIds.push(pid);
      productSum += Number(product.price_minor ?? 0);
      continue;
    }
    if (selectedVariantProductIds.has(pid)) continue;
    if (hasOptionVariants(opts)) {
      return {
        productSum: 0,
        allowedProductIds: [],
        allowedVariantIds: [],
        error: `Choose a size or colour for ${product.name}`,
      };
    }
    return {
      productSum: 0,
      allowedProductIds: [],
      allowedVariantIds: [],
      error: `${product.name} needs a stocked option selected`,
    };
  }

  return { productSum, allowedProductIds, allowedVariantIds };
}

export function sanitizeVariantInputs(raw: VariantInput[] | undefined): VariantInput[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const out: VariantInput[] = [];
  for (const row of raw) {
    const color = normalizeOption(row.color);
    const size = normalizeOption(row.size);
    const key = `${color.toLowerCase()}\0${size.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const qty = Math.max(0, Math.round(Number(row.stock_quantity) || 0));
    out.push({
      color,
      size,
      stock_quantity: qty,
      image_url: row.image_url?.trim() || null,
      sort_order: Math.round(row.sort_order ?? out.length),
    });
    if (out.length >= MAX_PRODUCT_VARIANTS) break;
  }
  return out;
}
