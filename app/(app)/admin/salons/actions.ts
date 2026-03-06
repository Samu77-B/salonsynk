"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { revalidatePath } from "next/cache";

export type BrandingInput = {
  logo_url?: string;
  primary_color?: string;
  company_name?: string;
};

async function requireAdmin() {
  const ok = await getIsSuperAdmin();
  if (!ok) throw new Error("Unauthorized");
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function adminCreateSalon(
  name: string,
  slug: string,
  ownerEmail?: string
) {
  await requireAdmin();
  const supabase = createAdminClient();
  const finalSlug = (slug || slugFromName(name)).trim();
  if (!finalSlug) return { error: "Slug is required" };

  const { data: salon, error: salonError } = await supabase
    .from("salons")
    .insert({ name: name.trim(), slug: finalSlug })
    .select("id")
    .single();

  if (salonError) {
    if (salonError.code === "23505") return { error: "That slug is already taken" };
    return { error: salonError.message };
  }

  if (ownerEmail?.trim()) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("email", ownerEmail.trim())
      .single();
    if (profile) {
      const displayName =
        (profile.full_name as string) || ownerEmail.split("@")[0] || "Owner";
      await supabase.from("salon_members").insert({
        salon_id: salon.id,
        user_id: profile.id,
        role: "owner",
        display_name: displayName,
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/salons");
  return { salonId: salon.id };
}

export async function adminUpdateSalon(
  salonId: string,
  updates: {
    name?: string;
    slug?: string;
    branding?: BrandingInput;
  }
) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("salons")
    .select("settings, slug")
    .eq("id", salonId)
    .single();
  if (!existing) return { error: "Salon not found" };
  const previousSlug = (existing.slug as string) ?? "";

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.slug !== undefined) payload.slug = updates.slug.trim();
  if (updates.branding !== undefined) {
    const current = (existing.settings as Record<string, unknown>) ?? {};
    const branding = { ...(current.branding as object), ...updates.branding };
    payload.settings = { ...current, branding };
  }

  if (Object.keys(payload).length === 0) return {};

  const { error } = await supabase.from("salons").update(payload).eq("id", salonId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  revalidatePath(`/book/${previousSlug}`);
  if (payload.slug && payload.slug !== previousSlug) {
    revalidatePath(`/book/${payload.slug}`);
  }
  return {};
}

export async function adminAssignOwner(salonId: string, email: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const trimmed = email.trim();
  if (!trimmed) return { error: "Email is required" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("email", trimmed)
    .single();
  if (!profile) return { error: "No user found with that email" };

  const displayName =
    (profile.full_name as string) || trimmed.split("@")[0] || "Owner";

  const { error } = await supabase.from("salon_members").upsert(
    {
      salon_id: salonId,
      user_id: profile.id,
      role: "owner",
      display_name: displayName,
      is_active: true,
    },
    { onConflict: "salon_id,user_id" }
  );
  if (error) return { error: error.message };
  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  return {};
}

export async function adminAddServices(
  salonId: string,
  services: { name: string; duration_minutes: number }[]
) {
  await requireAdmin();
  const supabase = createAdminClient();
  const rows = services
    .filter((s) => s.name.trim())
    .map((s) => ({
      salon_id: salonId,
      name: s.name.trim(),
      duration_minutes: s.duration_minutes ?? 60,
    }));
  if (!rows.length) return {};
  const { error } = await supabase.from("services").insert(rows);
  if (error) return { error: error.message };
  revalidatePath(`/admin/salons/${salonId}`);
  return {};
}
