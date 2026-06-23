"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { revalidatePath } from "next/cache";
import { isMissingDescriptionColumnError, isMissingProcessingColumnError, isMissingColorColumnError, isMissingCategoryColumnError, isMissingSortOrderColumnError } from "@/lib/db/service-schema";

const SERVICE_DESCRIPTION_MAX_LEN = 2000;

function normalizeServiceDescription(raw: string | undefined): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  return t.length > SERVICE_DESCRIPTION_MAX_LEN ? t.slice(0, SERVICE_DESCRIPTION_MAX_LEN) : t;
}

export type BrandingInput = {
  logo_url?: string;
  primary_color?: string;
  company_name?: string;
  booking_heading?: string;
};

async function assertCanManageServices(salonId: string): Promise<{ ok: true } | { error: string }> {
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

async function readServiceOptionalFields(
  serviceId: string,
  salonId: string
): Promise<{ id: string; color: string | null; category_id: string | null } | null> {
  const supabase = await createClient();
  const admin = getOptionalAdminClient();
  const clients = admin ? [admin, supabase] : [supabase];
  for (const client of clients) {
    const res = await client
      .from("services")
      .select("id, color, category_id")
      .eq("id", serviceId)
      .eq("salon_id", salonId)
      .maybeSingle();
    if (!res.error && res.data) {
      return {
        id: res.data.id as string,
        color: (res.data.color as string | null) ?? null,
        category_id: (res.data.category_id as string | null) ?? null,
      };
    }
  }
  return null;
}

export async function updateSalonBranding(salonId: string, branding: BrandingInput) {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("salons")
    .select("settings")
    .eq("id", salonId)
    .single();
  if (!existing) return { error: "Salon not found" };

  const current = (existing.settings as Record<string, unknown>) ?? {};
  const nextBranding = { ...(current.branding as object), ...branding };
  const { error } = await supabase
    .from("salons")
    .update({ settings: { ...current, branding: nextBranding } })
    .eq("id", salonId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  const slug = context.salon.slug;
  if (slug) {
    revalidatePath(`/book/${slug}`);
    revalidatePath(`/shop/${slug}`);
    revalidatePath(`/${slug}/shop`);
  }
  return {};
}

export async function updateRenterAdminFee(salonId: string, adminFeePercent: number) {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId || context.member.role !== "owner") return { error: "Unauthorized" };
  const value = Math.min(100, Math.max(0, Math.round(adminFeePercent)));
  const supabase = await createClient();
  const { data: existing } = await supabase.from("salons").select("settings").eq("id", salonId).single();
  if (!existing) return { error: "Salon not found" };
  const current = (existing.settings as Record<string, unknown>) ?? {};
  const { error } = await supabase
    .from("salons")
    .update({ settings: { ...current, admin_fee_percent: value } })
    .eq("id", salonId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

export type DepositSettings = {
  deposit_required?: boolean;
  deposit_type?: "percent" | "flat";
  deposit_value?: number; // percent 1-100 or flat amount in minor units
};

export async function updateDepositSettings(salonId: string, settings: DepositSettings) {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId || context.member.role !== "owner") return { error: "Unauthorized" };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("salons").select("settings").eq("id", salonId).single();
  if (!existing) return { error: "Salon not found" };
  const current = (existing.settings as Record<string, unknown>) ?? {};
  const next = { ...current };
  if (settings.deposit_required !== undefined) next.deposit_required = settings.deposit_required;
  if (settings.deposit_type !== undefined) next.deposit_type = settings.deposit_type;
  if (settings.deposit_value !== undefined) next.deposit_value = Math.max(0, settings.deposit_value);
  const { error } = await supabase.from("salons").update({ settings: next }).eq("id", salonId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

const VALID_REMINDER_HOURS = [12, 24, 48];

export async function updateReminderSettings(
  salonId: string,
  reminderHours: number[]
) {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId || context.member.role !== "owner") return { error: "Unauthorized" };
  const validated = reminderHours.filter((h) => VALID_REMINDER_HOURS.includes(h));
  const supabase = await createClient();
  const { data: existing } = await supabase.from("salons").select("settings").eq("id", salonId).single();
  if (!existing) return { error: "Salon not found" };
  const current = (existing.settings as Record<string, unknown>) ?? {};
  const { error } = await supabase
    .from("salons")
    .update({ settings: { ...current, reminder_hours: validated } })
    .eq("id", salonId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

export async function updateSalonMarketingSettings(
  salonId: string,
  settings: { google_review_url?: string; we_miss_you_weeks_min?: number; we_miss_you_weeks_max?: number; we_miss_you_discount_code?: string }
) {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId || context.member.role !== "owner") return { error: "Unauthorized" };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("salons").select("settings").eq("id", salonId).single();
  if (!existing) return { error: "Salon not found" };
  const current = (existing.settings as Record<string, unknown>) ?? {};
  const next = { ...current };
  if (settings.google_review_url !== undefined) next.google_review_url = settings.google_review_url;
  if (settings.we_miss_you_weeks_min !== undefined) next.we_miss_you_weeks_min = Math.max(0, settings.we_miss_you_weeks_min);
  if (settings.we_miss_you_weeks_max !== undefined) next.we_miss_you_weeks_max = Math.max(0, settings.we_miss_you_weeks_max);
  if (settings.we_miss_you_discount_code !== undefined) next.we_miss_you_discount_code = settings.we_miss_you_discount_code;
  const { error } = await supabase.from("salons").update({ settings: next }).eq("id", salonId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

// Upload a logo image to Supabase Storage and update branding.logo_url
const LOGO_BUCKET = "team-avatars";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

export async function uploadSalonLogo(
  salonId: string,
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner") return { error: "Only owners can update branding" };

  const raw = formData.get("logo");
  if (!raw || typeof raw !== "object" || !("size" in raw) || !("type" in raw)) return { error: "No file provided" };
  const size = Number((raw as { size?: number }).size) || 0;
  const type = String((raw as { type?: string }).type || "").toLowerCase();
  if (size === 0) return { error: "No file provided" };
  if (size > MAX_LOGO_BYTES) return { error: "Image must be under 2MB" };
  if (!ALLOWED_LOGO_TYPES.includes(type)) return { error: "Allowed types: JPEG, PNG, GIF, WebP, SVG" };

  const admin = createAdminClient();
  const name = (raw as { name?: string }).name || "logo.png";
  const ext = name.split(".").pop()?.toLowerCase() || "png";
  const path = `salon-logos/${salonId}.${ext}`;

  const arrayBuffer = await (raw as Blob).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { error: uploadError } = await admin.storage
    .from(LOGO_BUCKET)
    .upload(path, buffer, { upsert: true, contentType: type });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const url = urlData.publicUrl;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("salons")
    .select("settings")
    .eq("id", salonId)
    .single();
  if (!existing) return { error: "Salon not found" };

  const current = (existing.settings as Record<string, unknown>) ?? {};
  const branding = (current.branding as Record<string, unknown>) ?? {};
  const nextBranding = { ...branding, logo_url: url };
  const { error: updateError } = await supabase
    .from("salons")
    .update({ settings: { ...current, branding: nextBranding } })
    .eq("id", salonId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/settings");
  const slug = context.salon.slug;
  if (slug) {
    revalidatePath(`/book/${slug}`);
    revalidatePath(`/shop/${slug}`);
    revalidatePath(`/${slug}/shop`);
  }
  return { error: null, url };
}

export type ServiceMutationResult = {
  error?: string;
  service?: { id: string; color: string; category_id: string | null };
};

function optionalServiceFieldSaveError(
  field: "color" | "category_id",
  error: { message?: string } | null | undefined
): string | null {
  if (field === "color" && isMissingColorColumnError(error)) {
    return "Diary colour could not be saved. Please run the latest database update (migration 051) on your Supabase project, then try again.";
  }
  if (field === "category_id" && isMissingCategoryColumnError(error)) {
    return "Category could not be saved. Please run the latest database update (migration 051) on your Supabase project, then try again.";
  }
  return null;
}

function verifySavedServiceOptionalFields(
  requested: { color?: string; category_id?: string | null },
  saved: { color?: string | null; category_id?: string | null } | null
): string | null {
  if (!saved) return "Service was not updated. Please try again.";
  if (requested.color !== undefined) {
    const want = requested.color.trim() || null;
    const got = (saved.color ?? "").trim() || null;
    if (want !== got) {
      return "Diary colour did not save. Please try again or contact support if this keeps happening.";
    }
  }
  if (requested.category_id !== undefined) {
    const want = requested.category_id?.trim() || null;
    const got = saved.category_id?.trim() || null;
    if (want !== got) {
      return "Category did not save. Please try again or contact support if this keeps happening.";
    }
  }
  return null;
}

// Services management (owners only)
export async function addService(
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
): Promise<ServiceMutationResult> {
  try {
    const auth = await assertCanManageServices(salonId);
    if ("error" in auth) return { error: auth.error };
    const name = data.name?.trim();
    if (!name) return { error: "Service name is required" };
    const duration = Math.max(1, Math.min(480, Math.round(data.duration_minutes ?? 60)));
    const price = Math.max(0, Math.round(data.price_minor ?? 0));
    const processing = Math.max(0, Math.min(duration, Math.round(data.processing_time_minutes ?? 0)));
    const description = normalizeServiceDescription(data.description);
    const supabase = await createClient();
    const admin = getOptionalAdminClient();
    const db = admin ?? supabase;
    const color = data.color?.trim() || null;
    const categoryId = data.category_id?.trim() || null;
    if (categoryId) {
      const { data: cat, error: catError } = await db
        .from("service_categories")
        .select("id")
        .eq("id", categoryId)
        .eq("salon_id", salonId)
        .maybeSingle();
      if (catError || !cat) {
        return { error: "That category could not be found. Refresh the page and try again." };
      }
    }
    let insertPayload: Record<string, unknown> = {
      salon_id: salonId,
      name,
      duration_minutes: duration,
      price_minor: price,
      processing_time_minutes: processing,
      description,
      color,
      category_id: categoryId,
    };
    const attemptInsert = async (payload: Record<string, unknown>) => {
      let result = await db.from("services").insert(payload).select("id, color, category_id").single();
      if (result.error && admin) {
        result = await admin.from("services").insert(payload).select("id, color, category_id").single();
      }
      return result;
    };
    let insertResult = await attemptInsert(insertPayload);
    let insertError = insertResult.error;
    if (insertError && categoryId) {
      const msg = optionalServiceFieldSaveError("category_id", insertError);
      if (msg) return { error: msg };
    }
    if (insertError && color) {
      const msg = optionalServiceFieldSaveError("color", insertError);
      if (msg) return { error: msg };
    }
    if (insertError && isMissingDescriptionColumnError(insertError)) {
      const { description: _d, ...next } = insertPayload;
      insertPayload = next;
      insertResult = await attemptInsert(insertPayload);
      insertError = insertResult.error;
    }
    if (insertError && isMissingProcessingColumnError(insertError)) {
      const { processing_time_minutes: _p, ...next } = insertPayload;
      insertPayload = next;
      insertResult = await attemptInsert(insertPayload);
      insertError = insertResult.error;
    }
    if (insertError) return { error: formatDbError(insertError) };
    const savedRow =
      insertResult.data?.id != null
        ? (await readServiceOptionalFields(insertResult.data.id, salonId)) ?? insertResult.data
        : insertResult.data;
    const verifyError = verifySavedServiceOptionalFields(
      { color: data.color, category_id: data.category_id },
      savedRow
    );
    if (verifyError) return { error: verifyError };
    revalidatePath("/settings");
    revalidatePath("/services");
    revalidatePath("/dashboard");
    return {
      service: {
        id: savedRow!.id,
        color: (savedRow!.color ?? "").trim(),
        category_id: savedRow!.category_id ?? null,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add service" };
  }
}

export async function updateService(
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
): Promise<ServiceMutationResult> {
  try {
    const auth = await assertCanManageServices(salonId);
    if ("error" in auth) return { error: auth.error };
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.duration_minutes !== undefined) payload.duration_minutes = Math.max(1, Math.min(480, Math.round(data.duration_minutes)));
    if (data.price_minor !== undefined) payload.price_minor = Math.max(0, Math.round(data.price_minor));
    if (data.processing_time_minutes !== undefined) payload.processing_time_minutes = Math.max(0, Math.round(data.processing_time_minutes));
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
    const supabase = await createClient();
    const admin = getOptionalAdminClient();
    const db = admin ?? supabase;
    if (data.category_id !== undefined) {
      const categoryId = data.category_id?.trim() || null;
      if (categoryId) {
        const { data: cat, error: catError } = await db
          .from("service_categories")
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
    const attemptUpdate = async (p: Record<string, unknown>) => {
      let result = await db
        .from("services")
        .update(p)
        .eq("id", serviceId)
        .eq("salon_id", salonId)
        .select("id, color, category_id")
        .maybeSingle();
      if (result.error && admin) {
        result = await admin
          .from("services")
          .update(p)
          .eq("id", serviceId)
          .eq("salon_id", salonId)
          .select("id, color, category_id")
          .maybeSingle();
      }
      return result;
    };
    let updatePayload: Record<string, unknown> = { ...payload };
    let updateResult = await attemptUpdate(updatePayload);
    let error = updateResult.error;
    if (error && payload.category_id !== undefined && payload.category_id !== null) {
      const msg = optionalServiceFieldSaveError("category_id", error);
      if (msg) return { error: msg };
    }
    if (error && payload.color !== undefined && payload.color) {
      const msg = optionalServiceFieldSaveError("color", error);
      if (msg) return { error: msg };
    }
    if (error && isMissingDescriptionColumnError(error)) {
      const { description: _d, ...next } = updatePayload;
      updatePayload = next;
      if (Object.keys(updatePayload).length === 0) return { error: formatDbError(error) };
      updateResult = await attemptUpdate(updatePayload);
      error = updateResult.error;
    }
    if (error && isMissingProcessingColumnError(error)) {
      const { processing_time_minutes: _p, ...next } = updatePayload;
      updatePayload = next;
      if (Object.keys(updatePayload).length === 0) return { error: formatDbError(error) };
      updateResult = await attemptUpdate(updatePayload);
      error = updateResult.error;
    }
    if (error) return { error: formatDbError(error) };
    const savedRow =
      (await readServiceOptionalFields(serviceId, salonId)) ?? updateResult.data;
    const verifyError = verifySavedServiceOptionalFields(
      { color: data.color, category_id: data.category_id },
      savedRow
    );
    if (verifyError) return { error: verifyError };
    revalidatePath("/settings");
    revalidatePath("/services");
    revalidatePath("/dashboard");
    if (savedRow) {
      return {
        service: {
          id: savedRow.id,
          color: (savedRow.color ?? "").trim(),
          category_id: savedRow.category_id ?? null,
        },
      };
    }
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update service" };
  }
}

export async function deleteService(salonId: string, serviceId: string): Promise<ServiceMutationResult> {
  try {
    const auth = await assertCanManageServices(salonId);
    if ("error" in auth) return { error: auth.error };
    const supabase = await createClient();
    const admin = getOptionalAdminClient();
    const db = admin ?? supabase;
    let { error } = await db
      .from("services")
      .delete()
      .eq("id", serviceId)
      .eq("salon_id", salonId);
    if (error && admin) {
      const adminRetry = await admin
        .from("services")
        .delete()
        .eq("id", serviceId)
        .eq("salon_id", salonId);
      error = adminRetry.error;
    }
    if (error) return { error: formatDbError(error) };
    revalidatePath("/settings");
    revalidatePath("/services");
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete service" };
  }
}

// ---------------------------------------------------------------------------
// Service categories
// ---------------------------------------------------------------------------

export async function addCategory(
  salonId: string,
  data: { name: string }
): Promise<ServiceMutationResult & { id?: string }> {
  try {
    const auth = await assertCanManageServices(salonId);
    if ("error" in auth) return { error: auth.error };
    const name = data.name?.trim();
    if (!name) return { error: "Category name is required" };
    const admin = getOptionalAdminClient();
    const supabase = await createClient();
    const db = admin ?? supabase;
    const { data: row, error } = await db
      .from("service_categories")
      .insert({ salon_id: salonId, name })
      .select("id")
      .single();
    if (error) return { error: formatDbError(error) };
    revalidatePath("/settings");
    revalidatePath("/services");
    revalidatePath("/dashboard");
    return { id: row?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add category" };
  }
}

export async function updateCategory(
  salonId: string,
  categoryId: string,
  data: { name?: string; sort_order?: number }
): Promise<ServiceMutationResult> {
  try {
    const auth = await assertCanManageServices(salonId);
    if ("error" in auth) return { error: auth.error };
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) {
      const n = data.name.trim();
      if (!n) return { error: "Category name is required" };
      payload.name = n;
    }
    if (data.sort_order !== undefined) payload.sort_order = Math.max(0, Math.round(data.sort_order));
    if (Object.keys(payload).length === 0) return {};
    const admin = getOptionalAdminClient();
    const supabase = await createClient();
    const db = admin ?? supabase;
    const { error } = await db
      .from("service_categories")
      .update(payload)
      .eq("id", categoryId)
      .eq("salon_id", salonId);
    if (error) return { error: formatDbError(error) };
    revalidatePath("/settings");
    revalidatePath("/services");
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update category" };
  }
}

export async function deleteCategory(
  salonId: string,
  categoryId: string
): Promise<ServiceMutationResult> {
  try {
    const auth = await assertCanManageServices(salonId);
    if ("error" in auth) return { error: auth.error };
    const admin = getOptionalAdminClient();
    const supabase = await createClient();
    const db = admin ?? supabase;
    const { error } = await db
      .from("service_categories")
      .delete()
      .eq("id", categoryId)
      .eq("salon_id", salonId);
    if (error) return { error: formatDbError(error) };
    revalidatePath("/settings");
    revalidatePath("/services");
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete category" };
  }
}
