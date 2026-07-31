"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@core/supabase/admin";
import { QUEUE_SETUP_LIMITS } from "@core/queue/platform-queue-access";
import { requireNailSalonManager } from "@modules/nail/lib/salon-access";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { pickNextCategoryColor } from "@/lib/service-diary-color";

const SERVICE_DESCRIPTION_MAX_LEN = 2000;

function getAdmin() {
  try {
    return { admin: createAdminClient(), error: null as string | null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Admin client unavailable";
    return { admin: null, error: msg };
  }
}

function revalidateServicePaths(slug?: string) {
  revalidatePath("/nail/services");
  revalidatePath("/nail/queue");
  revalidatePath("/nail/appointments");
  revalidatePath("/nail/dashboard");
  if (slug) revalidatePath(`/nail/join/${slug}`);
}

function normalizeServiceDescription(raw: string | undefined): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  return t.length > SERVICE_DESCRIPTION_MAX_LEN ? t.slice(0, SERVICE_DESCRIPTION_MAX_LEN) : t;
}

function formatDbError(error: { message?: string; details?: string; hint?: string } | null | undefined): string {
  if (!error) return "Unknown database error";
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return parts.length ? parts.join(" | ") : "Unknown database error";
}

export type NailServiceMutationResult = {
  error?: string;
  service?: { id: string; color: string; category_id: string | null };
  id?: string;
  color?: string;
};

export async function addNailService(
  salonId: string,
  data: {
    name: string;
    duration_minutes: number;
    price_minor?: number;
    processing_time_minutes?: number;
    description?: string;
    color?: string;
    category_id?: string | null;
  }
): Promise<NailServiceMutationResult> {
  const { error: authError, context } = await requireNailSalonManager();
  if (authError || !context || context.salon.id !== salonId) return { error: "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { count } = await admin
    .from("nail_services")
    .select("id", { count: "exact", head: true })
    .eq("salon_id", salonId)
    .eq("is_active", true);

  if ((count ?? 0) >= QUEUE_SETUP_LIMITS.maxServices) {
    return { error: `Maximum ${QUEUE_SETUP_LIMITS.maxServices} services per salon.` };
  }

  const name = data.name?.trim();
  if (!name) return { error: "Service name is required" };
  const duration = Math.max(1, Math.min(480, Math.round(data.duration_minutes ?? 60)));
  const price = Math.max(0, Math.round(data.price_minor ?? 0));
  const processing = Math.max(0, Math.min(duration, Math.round(data.processing_time_minutes ?? 0)));
  const description = normalizeServiceDescription(data.description);
  const color = data.color?.trim() || null;
  const categoryId = data.category_id?.trim() || null;

  if (categoryId) {
    const { data: cat, error: catError } = await admin
      .from("nail_service_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("salon_id", salonId)
      .maybeSingle();
    if (catError || !cat) {
      return { error: "That category could not be found. Refresh the page and try again." };
    }
  }

  const { data: maxSort } = await admin
    .from("nail_services")
    .select("sort_order")
    .eq("salon_id", salonId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: inserted, error: insertError } = await admin
    .from("nail_services")
    .insert({
      salon_id: salonId,
      name,
      duration_minutes: duration,
      price_minor: price,
      processing_time_minutes: processing,
      description,
      color,
      category_id: categoryId,
      sort_order: (maxSort?.sort_order ?? 0) + 1,
      is_active: true,
    })
    .select("id, color, category_id")
    .single();

  if (insertError) return { error: formatDbError(insertError) };
  revalidateServicePaths(context.salon.slug);
  return {
    service: {
      id: inserted!.id,
      color: (inserted!.color ?? "").trim(),
      category_id: inserted!.category_id ?? null,
    },
  };
}

export async function updateNailService(
  salonId: string,
  serviceId: string,
  data: {
    name?: string;
    duration_minutes?: number;
    price_minor?: number;
    processing_time_minutes?: number;
    description?: string;
    color?: string;
    category_id?: string | null;
  }
): Promise<NailServiceMutationResult> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Unauthorized" };
  }

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const n = data.name.trim();
    if (!n) return { error: "Service name is required" };
    payload.name = n;
  }
  if (data.duration_minutes !== undefined) {
    payload.duration_minutes = Math.max(1, Math.min(480, Math.round(data.duration_minutes)));
  }
  if (data.price_minor !== undefined) payload.price_minor = Math.max(0, Math.round(data.price_minor));
  if (data.processing_time_minutes !== undefined) {
    payload.processing_time_minutes = Math.max(0, Math.round(data.processing_time_minutes));
  }
  if (
    payload.processing_time_minutes !== undefined &&
    payload.duration_minutes !== undefined
  ) {
    const d = Number(payload.duration_minutes);
    const p = Number(payload.processing_time_minutes);
    payload.processing_time_minutes = Math.max(0, Math.min(d, p));
  }
  if (data.description !== undefined) payload.description = normalizeServiceDescription(data.description);
  if (data.color !== undefined) payload.color = data.color?.trim() || null;

  if (data.category_id !== undefined) {
    const categoryId = data.category_id?.trim() || null;
    if (categoryId) {
      const { data: cat, error: catError } = await admin
        .from("nail_service_categories")
        .select("id")
        .eq("id", categoryId)
        .eq("salon_id", salonId)
        .maybeSingle();
      if (catError || !cat) {
        return { error: "That category could not be found. Refresh the page and try again." };
      }
    }
    payload.category_id = categoryId;
  }

  if (Object.keys(payload).length === 0) return {};

  const { data: updated, error: updateError } = await admin
    .from("nail_services")
    .update(payload)
    .eq("id", serviceId)
    .eq("salon_id", salonId)
    .select("id, color, category_id")
    .maybeSingle();

  if (updateError) return { error: formatDbError(updateError) };
  revalidateServicePaths(context.salon.slug);
  if (updated) {
    return {
      service: {
        id: updated.id,
        color: (updated.color ?? "").trim(),
        category_id: updated.category_id ?? null,
      },
    };
  }
  return {};
}

export async function deleteNailService(
  salonId: string,
  serviceId: string
): Promise<NailServiceMutationResult> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Unauthorized" };
  }

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { error } = await admin
    .from("nail_services")
    .update({ is_active: false })
    .eq("id", serviceId)
    .eq("salon_id", salonId);

  if (error) return { error: formatDbError(error) };
  revalidateServicePaths(context.salon.slug);
  return {};
}

async function fetchSalonCategoryColors(
  salonId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<string[]> {
  const res = await admin.from("nail_service_categories").select("color").eq("salon_id", salonId);
  if (res.error) return [];
  return (res.data ?? [])
    .map((row) => String((row as { color?: string | null }).color ?? "").trim())
    .filter(Boolean);
}

export async function addNailCategory(
  salonId: string,
  data: { name: string }
): Promise<NailServiceMutationResult> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Unauthorized" };
  }

  const name = data.name?.trim();
  if (!name) return { error: "Category name is required" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const usedColors = await fetchSalonCategoryColors(salonId, admin);
  const color = pickNextCategoryColor(usedColors);

  const { data: maxSort } = await admin
    .from("nail_service_categories")
    .select("sort_order")
    .eq("salon_id", salonId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: inserted, error } = await admin
    .from("nail_service_categories")
    .insert({
      salon_id: salonId,
      name,
      color,
      sort_order: (maxSort?.sort_order ?? 0) + 1,
    })
    .select("id, color")
    .single();

  if (error) return { error: formatDbError(error) };
  revalidateServicePaths(context.salon.slug);
  return {
    id: inserted?.id,
    color: (inserted?.color ?? color).trim(),
  };
}

export async function updateNailCategory(
  salonId: string,
  categoryId: string,
  data: { name?: string; sort_order?: number; color?: string | null }
): Promise<NailServiceMutationResult> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Unauthorized" };
  }

  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const n = data.name.trim();
    if (!n) return { error: "Category name is required" };
    payload.name = n;
  }
  if (data.sort_order !== undefined) payload.sort_order = Math.max(0, Math.round(data.sort_order));
  if (data.color !== undefined) payload.color = data.color?.trim() || null;
  if (Object.keys(payload).length === 0) return {};

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { data: updated, error } = await admin
    .from("nail_service_categories")
    .update(payload)
    .eq("id", categoryId)
    .eq("salon_id", salonId)
    .select("color")
    .maybeSingle();

  if (error) return { error: formatDbError(error) };
  revalidateServicePaths(context.salon.slug);
  return { color: (updated?.color ?? data.color ?? "").trim() };
}

export async function deleteNailCategory(
  salonId: string,
  categoryId: string
): Promise<NailServiceMutationResult> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Unauthorized" };
  }

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { error } = await admin
    .from("nail_service_categories")
    .delete()
    .eq("id", categoryId)
    .eq("salon_id", salonId);

  if (error) return { error: formatDbError(error) };
  revalidateServicePaths(context.salon.slug);
  return {};
}
