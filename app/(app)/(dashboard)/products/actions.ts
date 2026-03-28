"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { revalidatePath } from "next/cache";

const DESCRIPTION_MAX = 2000;

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
