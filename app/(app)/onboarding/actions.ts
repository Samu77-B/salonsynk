"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createSalonAndOwner(name: string, slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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

  const displayName =
    (user.user_metadata?.full_name as string) ||
    user.email?.split("@")[0] ||
    "Owner";

  const { error: memberError } = await supabase.from("salon_members").insert({
    salon_id: salon.id,
    user_id: user.id,
    role: "owner",
    display_name: displayName,
  });

  if (memberError) return { error: memberError.message };

  revalidatePath("/", "layout");
  return { salonId: salon.id };
}

type ServiceInput = { name: string; duration_minutes: number };

export async function addOnboardingServices(
  salonId: string,
  services: ServiceInput[]
) {
  const supabase = await createClient();
  if (!services.length) return { error: null };

  const rows = services
    .filter((s) => s.name.trim())
    .map((s) => ({
      salon_id: salonId,
      name: s.name.trim(),
      duration_minutes: s.duration_minutes ?? 60,
    }));

  if (!rows.length) return { error: null };

  const { error } = await supabase.from("services").insert(rows);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null };
}
