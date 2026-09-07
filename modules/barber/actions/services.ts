"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@core/supabase/admin";
import { QUEUE_SETUP_LIMITS } from "@core/queue/platform-queue-access";
import { requireBarberShopManager } from "@modules/barber/lib/shop-access";

function getAdmin() {
  try {
    return { admin: createAdminClient(), error: null as string | null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Admin client unavailable";
    return { admin: null, error: msg };
  }
}

function revalidateServicePaths(slug?: string) {
  revalidatePath("/barber/services");
  revalidatePath("/barber/dashboard");
  revalidatePath("/barber/appointments");
  if (slug) revalidatePath(`/barber/join/${slug}`);
}

function parsePriceMinor(raw: string | null | undefined): number {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return 0;
  const pounds = Number.parseFloat(trimmed.replace(/[£,]/g, ""));
  if (!Number.isFinite(pounds) || pounds < 0) return 0;
  return Math.round(pounds * 100);
}

async function resolveCategoryId(
  admin: ReturnType<typeof createAdminClient>,
  shopId: string,
  categoryId: string | null | undefined
): Promise<{ id: string | null; error?: string }> {
  const trimmed = categoryId?.trim() || null;
  if (!trimmed) return { id: null };

  const { data: cat } = await admin
    .from("barber_service_categories")
    .select("id")
    .eq("id", trimmed)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (!cat) return { id: null, error: "That category could not be found. Refresh the page and try again." };
  return { id: cat.id };
}

export async function addBarberService(data: {
  name: string;
  duration_minutes: number;
  price_gbp?: string;
  category_id?: string | null;
}): Promise<{ error?: string }> {
  const { error, context } = await requireBarberShopManager();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { count } = await admin
    .from("barber_services")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", context.shop.id)
    .eq("is_active", true);

  if ((count ?? 0) >= QUEUE_SETUP_LIMITS.maxServices) {
    return { error: `Maximum ${QUEUE_SETUP_LIMITS.maxServices} services per shop.` };
  }

  const name = data.name?.trim();
  if (!name) return { error: "Service name is required" };

  const duration = Number(data.duration_minutes);
  if (!Number.isFinite(duration) || duration < 5) {
    return { error: "Duration must be at least 5 minutes" };
  }

  const category = await resolveCategoryId(admin, context.shop.id, data.category_id);
  if (category.error) return { error: category.error };

  const { data: maxSort } = await admin
    .from("barber_services")
    .select("sort_order")
    .eq("shop_id", context.shop.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: insertError } = await admin.from("barber_services").insert({
    shop_id: context.shop.id,
    name,
    duration_minutes: Math.round(duration),
    price_minor: parsePriceMinor(data.price_gbp),
    category_id: category.id,
    sort_order: (maxSort?.sort_order ?? 0) + 1,
    is_active: true,
  });

  if (insertError) return { error: insertError.message };
  revalidateServicePaths(context.shop.slug);
  return {};
}

export async function updateBarberService(
  serviceId: string,
  data: {
    name?: string;
    duration_minutes?: number;
    price_gbp?: string;
    clear_price?: boolean;
    category_id?: string | null;
  }
): Promise<{ error?: string }> {
  const { error, context } = await requireBarberShopManager();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) return { error: "Service name is required" };
    payload.name = name;
  }
  if (data.duration_minutes !== undefined) {
    const duration = Number(data.duration_minutes);
    if (!Number.isFinite(duration) || duration < 5) {
      return { error: "Duration must be at least 5 minutes" };
    }
    payload.duration_minutes = Math.round(duration);
  }
  if (data.clear_price) {
    payload.price_minor = 0;
  } else if (data.price_gbp !== undefined) {
    payload.price_minor = parsePriceMinor(data.price_gbp);
  }
  if (data.category_id !== undefined) {
    const category = await resolveCategoryId(admin, context.shop.id, data.category_id);
    if (category.error) return { error: category.error };
    payload.category_id = category.id;
  }

  const { error: updateError } = await admin
    .from("barber_services")
    .update(payload)
    .eq("id", serviceId)
    .eq("shop_id", context.shop.id);

  if (updateError) return { error: updateError.message };
  revalidateServicePaths(context.shop.slug);
  return {};
}

export async function deleteBarberService(serviceId: string): Promise<{ error?: string }> {
  const { error, context } = await requireBarberShopManager();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { error: deleteError } = await admin
    .from("barber_services")
    .update({ is_active: false })
    .eq("id", serviceId)
    .eq("shop_id", context.shop.id);

  if (deleteError) return { error: deleteError.message };
  revalidateServicePaths(context.shop.slug);
  return {};
}

export async function addBarberCategory(data: { name: string }): Promise<{ error?: string }> {
  const { error, context } = await requireBarberShopManager();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const name = data.name?.trim();
  if (!name) return { error: "Category name is required" };

  const { count } = await admin
    .from("barber_service_categories")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", context.shop.id);

  if ((count ?? 0) >= QUEUE_SETUP_LIMITS.maxCategories) {
    return { error: `Maximum ${QUEUE_SETUP_LIMITS.maxCategories} categories per shop.` };
  }

  const { data: maxSort } = await admin
    .from("barber_service_categories")
    .select("sort_order")
    .eq("shop_id", context.shop.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: insertError } = await admin.from("barber_service_categories").insert({
    shop_id: context.shop.id,
    name,
    sort_order: (maxSort?.sort_order ?? 0) + 1,
  });

  if (insertError) return { error: insertError.message };
  revalidateServicePaths(context.shop.slug);
  return {};
}

export async function updateBarberCategory(
  categoryId: string,
  data: { name?: string; sort_order?: number }
): Promise<{ error?: string }> {
  const { error, context } = await requireBarberShopManager();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) return { error: "Category name is required" };
    payload.name = name;
  }
  if (data.sort_order !== undefined) payload.sort_order = Math.max(0, Math.round(data.sort_order));
  if (Object.keys(payload).length === 0) return {};

  const { error: updateError } = await admin
    .from("barber_service_categories")
    .update(payload)
    .eq("id", categoryId)
    .eq("shop_id", context.shop.id);

  if (updateError) return { error: updateError.message };
  revalidateServicePaths(context.shop.slug);
  return {};
}

export async function deleteBarberCategory(categoryId: string): Promise<{ error?: string }> {
  const { error, context } = await requireBarberShopManager();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { error: deleteError } = await admin
    .from("barber_service_categories")
    .delete()
    .eq("id", categoryId)
    .eq("shop_id", context.shop.id);

  if (deleteError) return { error: deleteError.message };
  revalidateServicePaths(context.shop.slug);
  return {};
}
