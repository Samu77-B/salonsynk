"use server";

import { createClient } from "@/lib/supabase/server";
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
