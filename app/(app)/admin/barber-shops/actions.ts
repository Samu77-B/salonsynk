"use server";

import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { revalidatePath } from "next/cache";

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

async function linkOwnerByEmail(
  admin: ReturnType<typeof createAdminClient>,
  shopId: string,
  ownerEmail: string
): Promise<{ error?: string; linked?: boolean }> {
  const email = ownerEmail.trim().toLowerCase();
  if (!email) return {};

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return {
      error:
        "No user found with that email. Create them in Supabase Authentication first, then add them here.",
    };
  }

  const displayName =
    (profile.full_name as string) || profile.email?.split("@")[0] || "Owner";

  const { error: memberError } = await admin.from("barber_members").upsert(
    {
      shop_id: shopId,
      user_id: profile.id,
      role: "owner",
      display_name: displayName,
      is_active: true,
    },
    { onConflict: "shop_id,user_id" }
  );

  if (memberError) return { error: memberError.message };
  return { linked: true };
}

export async function adminCreateBarberShop(
  name: string,
  slug: string,
  ownerEmail?: string
): Promise<{ error?: string; shopId?: string; ownerWarning?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const finalSlug = (slug || slugFromName(name)).trim();
  if (!finalSlug) return { error: "Slug is required" };

  const { data: shop, error: shopError } = await admin
    .from("barber_shops")
    .insert({
      name: name.trim(),
      slug: finalSlug,
      subscription_status: "active",
      plan_tier: "professional",
    })
    .select("id")
    .single();

  if (shopError) {
    if (shopError.code === "23505") return { error: "That slug is already taken" };
    return { error: shopError.message };
  }

  let ownerWarning: string | undefined;
  if (ownerEmail?.trim()) {
    const linkResult = await linkOwnerByEmail(admin, shop.id, ownerEmail);
    if (linkResult.error) ownerWarning = linkResult.error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/barber-shops");
  return { shopId: shop.id, ownerWarning };
}

export async function adminAddBarberShopOwner(
  shopId: string,
  ownerEmail: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const linkResult = await linkOwnerByEmail(admin, shopId, ownerEmail);
  if (linkResult.error) return { error: linkResult.error };

  revalidatePath(`/admin/barber-shops/${shopId}`);
  revalidatePath("/admin/barber-shops");
  return {};
}
