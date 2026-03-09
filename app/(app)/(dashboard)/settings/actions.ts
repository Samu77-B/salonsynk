"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { revalidatePath } from "next/cache";

export type BrandingInput = {
  logo_url?: string;
  primary_color?: string;
  company_name?: string;
};

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
