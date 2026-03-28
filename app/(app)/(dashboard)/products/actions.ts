"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { revalidatePath } from "next/cache";
import { parseCsvRows } from "@/lib/simple-csv";

const DESCRIPTION_MAX = 2000;

const PRODUCT_IMAGE_BUCKET = "product-images";
const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const MAX_CSV_DATA_ROWS = 500;

function normCsvHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function parsePriceGbpCell(raw: string | undefined): { minor: number } | { error: string } {
  const t = raw?.trim() ?? "";
  if (!t) return { minor: 0 };
  const n = parseFloat(t.replace(/[£,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return { error: "Invalid price" };
  return { minor: Math.round(n * 100) };
}

function parseBoolCsvCell(raw: string | undefined, defaultActive: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return defaultActive;
  const x = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(x)) return true;
  if (["0", "false", "no", "n"].includes(x)) return false;
  return defaultActive;
}

async function assertCanManageProducts(salonId: string): Promise<{ ok: true } | { error: string }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  const isSuperAdmin = await getIsSuperAdmin();
  if (context.member.role !== "owner" && !isSuperAdmin) return { error: "Unauthorized" };
  return { ok: true };
}

function formatDbError(error: { message?: string; details?: string; hint?: string } | null | undefined): string {
  if (!error) return "Unknown database error";
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return parts.length ? parts.join(" | ") : "Unknown database error";
}

function getOptionalAdminClient() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function normalizeDescription(raw: string | undefined): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  return t.length > DESCRIPTION_MAX ? t.slice(0, DESCRIPTION_MAX) : t;
}

export async function addProduct(
  salonId: string,
  data: {
    name: string;
    description?: string | null;
    category?: string | null;
    price_minor: number;
    image_url?: string | null;
    sort_order?: number;
  }
): Promise<{ error: string | null }> {
  const auth = await assertCanManageProducts(salonId);
  if ("error" in auth) return { error: auth.error };
  const name = data.name?.trim();
  if (!name) return { error: "Product name is required" };
  const price = Math.max(0, Math.round(data.price_minor ?? 0));
  const sortOrder = Math.round(data.sort_order ?? 0);
  const supabase = await createClient();
  const admin = getOptionalAdminClient();
  const db = admin ?? supabase;
  const payload = {
    salon_id: salonId,
    name,
    description: normalizeDescription(data.description ?? undefined),
    category: data.category?.trim() || null,
    price_minor: price,
    image_url: data.image_url?.trim() || null,
    sort_order: sortOrder,
    is_active: true,
  };
  let { error } = await db.from("products").insert(payload);
  if (error && admin) {
    const r = await admin.from("products").insert(payload);
    error = r.error;
  }
  if (error) return { error: formatDbError(error) };
  revalidatePath("/products");
  const ctx = await getCurrentUserSalon();
  if (ctx?.salon.slug) revalidatePath(`/${ctx.salon.slug}/shop`);
  return { error: null };
}

export async function updateProduct(
  salonId: string,
  productId: string,
  data: {
    name?: string;
    description?: string | null;
    category?: string | null;
    price_minor?: number;
    image_url?: string | null;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<{ error: string | null }> {
  const auth = await assertCanManageProducts(salonId);
  if ("error" in auth) return { error: auth.error };
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.description !== undefined) payload.description = normalizeDescription(data.description ?? undefined);
  if (data.category !== undefined) payload.category = data.category?.trim() || null;
  if (data.price_minor !== undefined) payload.price_minor = Math.max(0, Math.round(data.price_minor));
  if (data.image_url !== undefined) payload.image_url = data.image_url?.trim() || null;
  if (data.is_active !== undefined) payload.is_active = data.is_active;
  if (data.sort_order !== undefined) payload.sort_order = Math.round(data.sort_order);
  if (Object.keys(payload).length === 0) return { error: null };
  payload.updated_at = new Date().toISOString();
  const supabase = await createClient();
  const admin = getOptionalAdminClient();
  const db = admin ?? supabase;
  let { error } = await db.from("products").update(payload).eq("id", productId).eq("salon_id", salonId);
  if (error && admin) {
    const r = await admin.from("products").update(payload).eq("id", productId).eq("salon_id", salonId);
    error = r.error;
  }
  if (error) return { error: formatDbError(error) };
  revalidatePath("/products");
  const ctx = await getCurrentUserSalon();
  if (ctx?.salon.slug) revalidatePath(`/${ctx.salon.slug}/shop`);
  return { error: null };
}

export async function deleteProduct(salonId: string, productId: string): Promise<{ error: string | null }> {
  const auth = await assertCanManageProducts(salonId);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const admin = getOptionalAdminClient();
  const db = admin ?? supabase;
  let { error } = await db.from("products").delete().eq("id", productId).eq("salon_id", salonId);
  if (error && admin) {
    const r = await admin.from("products").delete().eq("id", productId).eq("salon_id", salonId);
    error = r.error;
  }
  if (error) return { error: formatDbError(error) };
  revalidatePath("/products");
  const ctx = await getCurrentUserSalon();
  if (ctx?.salon.slug) revalidatePath(`/${ctx.salon.slug}/shop`);
  return { error: null };
}

export async function uploadProductImage(
  salonId: string,
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  const auth = await assertCanManageProducts(salonId);
  if ("error" in auth) return { error: auth.error };

  const raw = formData.get("image");
  if (!raw || typeof raw !== "object" || !("size" in raw)) return { error: "No file provided" };
  const file = raw as File;
  if (file.size === 0) return { error: "No file provided" };
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) return { error: "Image must be under 3 MB" };
  const type = (file.type || "").toLowerCase();
  if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(type)) {
    return { error: "Allowed types: JPEG, PNG, WebP, GIF" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Storage not configured" };
  }

  const ext = file.name?.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${salonId}/products/${randomUUID()}.${safeExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { error: uploadError } = await admin.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, buffer, { upsert: false, contentType: type });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = admin.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return { error: null, url: urlData.publicUrl };
}

export type CsvImportRowError = { line: number; message: string };

export async function importProductsFromCsv(
  salonId: string,
  csvText: string
): Promise<{
  error: string | null;
  added: number;
  rowErrors: CsvImportRowError[];
}> {
  const auth = await assertCanManageProducts(salonId);
  if ("error" in auth) return { error: auth.error, added: 0, rowErrors: [] };

  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return { error: "Add a header row and at least one product row.", added: 0, rowErrors: [] };
  }

  const headerCells = rows[0]!.map(normCsvHeader);
  const col: Record<string, number> = {};
  headerCells.forEach((h, i) => {
    if (h && col[h] === undefined) col[h] = i;
  });

  function pick(row: string[], ...keys: string[]): string | undefined {
    for (const k of keys) {
      const j = col[k];
      if (j !== undefined && row[j] !== undefined) return row[j];
    }
    return undefined;
  }

  if (col.name === undefined && col.product_name === undefined) {
    return { error: 'CSV must include a "name" column.', added: 0, rowErrors: [] };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_CSV_DATA_ROWS) {
    return {
      error: `Too many rows (max ${MAX_CSV_DATA_ROWS}). Split into multiple files.`,
      added: 0,
      rowErrors: [],
    };
  }

  type Payload = {
    salon_id: string;
    name: string;
    description: string | null;
    category: string | null;
    price_minor: number;
    image_url: string | null;
    sort_order: number;
    is_active: boolean;
  };

  const payloads: Payload[] = [];
  const rowErrors: CsvImportRowError[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]!;
    const lineNum = i + 2;
    const name = (pick(row, "name", "product_name") ?? "").trim();
    if (!name) {
      rowErrors.push({ line: lineNum, message: "Missing name" });
      continue;
    }

    const priceRaw = pick(row, "price_gbp", "price");
    const priceParsed = parsePriceGbpCell(priceRaw);
    if ("error" in priceParsed) {
      rowErrors.push({ line: lineNum, message: priceParsed.error });
      continue;
    }

    const sortRaw = pick(row, "sort_order", "sort");
    let sortOrder = 0;
    if (sortRaw !== undefined && sortRaw.trim() !== "") {
      const so = parseInt(sortRaw.trim(), 10);
      if (!Number.isFinite(so)) {
        rowErrors.push({ line: lineNum, message: "Invalid sort_order" });
        continue;
      }
      sortOrder = so;
    }

    const descRaw = pick(row, "description", "desc") ?? "";
    const description = normalizeDescription(descRaw);

    const category = (pick(row, "category") ?? "").trim() || null;
    const image_url = (pick(row, "image_url", "image", "photo_url") ?? "").trim() || null;
    const is_active = parseBoolCsvCell(pick(row, "is_active", "active"), true);

    payloads.push({
      salon_id: salonId,
      name,
      description,
      category,
      price_minor: priceParsed.minor,
      image_url,
      sort_order: sortOrder,
      is_active,
    });
  }

  if (payloads.length === 0) {
    return { error: null, added: 0, rowErrors };
  }

  const supabase = await createClient();
  const admin = getOptionalAdminClient();
  const db = admin ?? supabase;
  let { error } = await db.from("products").insert(payloads);
  if (error && admin) {
    const r = await admin.from("products").insert(payloads);
    error = r.error;
  }
  if (error) {
    return { error: formatDbError(error), added: 0, rowErrors };
  }

  revalidatePath("/products");
  const ctx = await getCurrentUserSalon();
  if (ctx?.salon.slug) revalidatePath(`/${ctx.salon.slug}/shop`);

  return { error: null, added: payloads.length, rowErrors };
}
