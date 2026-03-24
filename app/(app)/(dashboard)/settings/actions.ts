"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { revalidatePath } from "next/cache";

export type BrandingInput = {
  logo_url?: string;
  primary_color?: string;
  company_name?: string;
};

/** True when DB doesn't have processing_time_minutes yet (or schema cache still references it). */
function isMissingProcessingColumnError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("processing_time_minutes");
}

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
  return { error: null, url };
}

// Services management (owners only)
export async function addService(
  salonId: string,
  data: { name: string; duration_minutes: number; price_minor?: number; processing_time_minutes?: number }
) {
  const auth = await assertCanManageServices(salonId);
  if ("error" in auth) return auth;
  const name = data.name?.trim();
  if (!name) return { error: "Service name is required" };
  const duration = Math.max(1, Math.min(480, Math.round(data.duration_minutes ?? 60)));
  const price = Math.max(0, Math.round(data.price_minor ?? 0));
  const processing = Math.max(0, Math.min(duration, Math.round(data.processing_time_minutes ?? 0)));
  const admin = createAdminClient();
  const payload = {
    salon_id: salonId,
    name,
    duration_minutes: duration,
    price_minor: price,
    processing_time_minutes: processing,
  };
  const { error } = await admin.from("services").insert(payload);
  if (error && isMissingProcessingColumnError(error)) {
    const fallback = await admin.from("services").insert({
      salon_id: salonId,
      name,
      duration_minutes: duration,
      price_minor: price,
    });
    if (fallback.error) return { error: formatDbError(fallback.error) };
  } else if (error) {
    return { error: formatDbError(error) };
  }
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return {};
}

export async function updateService(
  salonId: string,
  serviceId: string,
  data: { name?: string; duration_minutes?: number; price_minor?: number; processing_time_minutes?: number }
) {
  const auth = await assertCanManageServices(salonId);
  if ("error" in auth) return auth;
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.duration_minutes !== undefined) payload.duration_minutes = Math.max(1, Math.min(480, Math.round(data.duration_minutes)));
  if (data.price_minor !== undefined) payload.price_minor = Math.max(0, Math.round(data.price_minor));
  if (data.processing_time_minutes !== undefined) payload.processing_time_minutes = Math.max(0, Math.round(data.processing_time_minutes));
  if (Object.keys(payload).length === 0) return {};
  const admin = createAdminClient();
  const { error } = await admin
    .from("services")
    .update(payload)
    .eq("id", serviceId)
    .eq("salon_id", salonId);
  if (error && isMissingProcessingColumnError(error)) {
    const { processing_time_minutes: _ignored, ...fallbackPayload } = payload;
    const fallback = await admin
      .from("services")
      .update(fallbackPayload)
      .eq("id", serviceId)
      .eq("salon_id", salonId);
    if (fallback.error) return { error: formatDbError(fallback.error) };
  } else if (error) {
    return { error: formatDbError(error) };
  }
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteService(salonId: string, serviceId: string) {
  const auth = await assertCanManageServices(salonId);
  if ("error" in auth) return auth;
  const admin = createAdminClient();
  const { error } = await admin
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("salon_id", salonId);
  if (error) return { error: formatDbError(error) };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return {};
}
