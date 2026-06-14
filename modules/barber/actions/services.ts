"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserShop } from "@modules/barber/lib/shop";

async function requireShopOwner() {
  const context = await getCurrentUserShop();
  if (!context) return { error: "Unauthorized" as const, context: null };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Only shop owners can manage services" as const, context: null };
  }
  return { error: null, context };
}

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

export async function addBarberService(data: {
  name: string;
  duration_minutes: number;
  price_gbp?: string;
}): Promise<{ error?: string }> {
  const { error, context } = await requireShopOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const name = data.name?.trim();
  if (!name) return { error: "Service name is required" };

  const duration = Number(data.duration_minutes);
  if (!Number.isFinite(duration) || duration < 5) {
    return { error: "Duration must be at least 5 minutes" };
  }

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
  }
): Promise<{ error?: string }> {
  const { error, context } = await requireShopOwner();
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
  const { error, context } = await requireShopOwner();
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
