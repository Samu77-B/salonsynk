"use server";

import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { uploadTeamAvatarImage } from "@core/storage/team-avatar";
import { revalidatePath } from "next/cache";

export type BarberBrandingInput = {
  logo_url?: string;
  primary_color?: string;
  company_name?: string;
  /** When false, hide the shop title on the public join queue page (logo only). */
  show_title_on_queue?: boolean;
  /** When true, customers only see "Next available" — no named barber choice. */
  next_available_only?: boolean;
  /** When false, hide the service dropdown on the public join queue page. */
  show_services_on_queue?: boolean;
};

const LOGO_BUCKET = "team-avatars";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

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
      is_accepting_walk_ins: false,
    },
    { onConflict: "shop_id,user_id" }
  );

  if (memberError) return { error: memberError.message };
  return { linked: true };
}

export async function adminCreateBarberShop(
  name: string,
  slug: string,
  ownerEmail?: string,
  branding?: BarberBrandingInput
): Promise<{ error?: string; shopId?: string; ownerWarning?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const finalSlug = (slug || slugFromName(name)).trim();
  if (!finalSlug) return { error: "Slug is required" };

  const settings: Record<string, unknown> = {};
  if (branding && Object.keys(branding).length > 0) {
    settings.branding = {
      ...(branding.logo_url?.trim() ? { logo_url: branding.logo_url.trim() } : {}),
      ...(branding.primary_color?.trim() ? { primary_color: branding.primary_color.trim() } : {}),
      ...(branding.company_name?.trim()
        ? { company_name: branding.company_name.trim() }
        : { company_name: name.trim() }),
    };
  }

  const { data: shop, error: shopError } = await admin
    .from("barber_shops")
    .insert({
      name: name.trim(),
      slug: finalSlug,
      subscription_status: "inactive",
      subscription_required: false,
      ...(Object.keys(settings).length ? { settings } : {}),
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
  revalidatePath(`/barber/join/${finalSlug}`);
  return { shopId: shop.id, ownerWarning };
}

export async function adminUploadBarberShopLogo(
  shopId: string,
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const raw = formData.get("logo");
    if (!raw || typeof raw !== "object" || !("size" in raw) || !("type" in raw)) {
      return { error: "No file provided" };
    }
    const size = Number((raw as { size?: number }).size) || 0;
    const type = String((raw as { type?: string }).type || "").toLowerCase();
    if (size === 0) return { error: "No file provided" };
    if (size > MAX_LOGO_BYTES) return { error: "Image must be under 2MB" };
    if (!ALLOWED_LOGO_TYPES.includes(type)) {
      return { error: `File type "${type}" not allowed. Use JPEG, PNG, GIF, WebP, or SVG.` };
    }

    const name = (raw as { name?: string }).name || "logo.png";
    const ext = name.split(".").pop()?.toLowerCase() || "png";
    const path = `barber-logos/${shopId}.${ext}`;

    const arrayBuffer = await (raw as Blob).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { error: uploadError } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(path, buffer, { upsert: true, contentType: type });

    if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

    const { data: urlData } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);
    const url = urlData.publicUrl;

    const { data: existing } = await admin
      .from("barber_shops")
      .select("settings, slug")
      .eq("id", shopId)
      .single();
    if (!existing) return { error: "Shop not found" };

    const current = (existing.settings as Record<string, unknown>) ?? {};
    const branding = (current.branding as Record<string, unknown>) ?? {};
    const nextBranding = { ...branding, logo_url: url };
    const { error: updateError } = await admin
      .from("barber_shops")
      .update({ settings: { ...current, branding: nextBranding } })
      .eq("id", shopId);
    if (updateError) return { error: updateError.message };

    revalidatePath("/admin/barber-shops");
    revalidatePath(`/admin/barber-shops/${shopId}`);
    if (existing.slug) revalidatePath(`/barber/join/${existing.slug}`);
    return { error: null, url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown upload error";
    return { error: msg };
  }
}

export async function adminUpdateBarberShop(
  shopId: string,
  updates: {
    name?: string;
    slug?: string;
    branding?: BarberBrandingInput;
  }
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("barber_shops")
    .select("settings, slug")
    .eq("id", shopId)
    .single();
  if (!existing) return { error: "Shop not found" };

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.slug !== undefined) payload.slug = updates.slug.trim();
  if (updates.branding !== undefined) {
    const current = (existing.settings as Record<string, unknown>) ?? {};
    const merged = {
      ...((current.branding as Record<string, unknown>) ?? {}),
      ...updates.branding,
    };
    if ("logo_url" in updates.branding && !updates.branding.logo_url?.trim()) {
      delete merged.logo_url;
    }
    payload.settings = { ...current, branding: merged };
  }

  const { error } = await admin.from("barber_shops").update(payload).eq("id", shopId);
  if (error) {
    if (error.code === "23505") return { error: "That slug is already taken" };
    return { error: error.message };
  }

  revalidatePath("/admin/barber-shops");
  revalidatePath(`/admin/barber-shops/${shopId}`);
  const slug = (updates.slug ?? existing.slug) as string;
  if (slug) revalidatePath(`/barber/join/${slug}`);
  return {};
}

export async function adminAddBarberShopOwner(
  shopId: string,
  ownerEmail: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const linkResult = await linkOwnerByEmail(admin, shopId, ownerEmail);
  if (linkResult.error) return { error: linkResult.error };

  revalidateBarberShop(shopId);
  return {};
}

/** Create owner with email + password directly. No email verification. */
export async function adminCreateBarberOwnerWithPassword(
  shopId: string,
  email: string,
  password: string,
  displayName?: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required" };
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters" };

  const name = displayName?.trim() || trimmed.split("@")[0] || "Owner";

  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email: trimmed,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (createError) {
    const msg = createError.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("registered")) {
      return { error: "That email is already registered. Use Add owner instead." };
    }
    return { error: createError.message };
  }

  const userId = userData?.user?.id;
  if (!userId) return { error: "User created but could not add as owner." };

  const { error: memberError } = await admin.from("barber_members").upsert(
    {
      shop_id: shopId,
      user_id: userId,
      role: "owner",
      display_name: name,
      is_active: true,
      is_accepting_walk_ins: false,
    },
    { onConflict: "shop_id,user_id" }
  );

  if (memberError) return { error: memberError.message };
  revalidateBarberShop(shopId);
  return {};
}

async function revalidateBarberShop(shopId: string) {
  const admin = createAdminClient();
  const { data: shop } = await admin.from("barber_shops").select("slug").eq("id", shopId).single();
  revalidatePath("/admin/barber-shops");
  revalidatePath(`/admin/barber-shops/${shopId}`);
  if (shop?.slug) revalidatePath(`/barber/join/${shop.slug}`);
}

async function linkBarberByEmail(
  admin: ReturnType<typeof createAdminClient>,
  shopId: string,
  email: string,
  displayName: string,
  chairNumber?: number | null
): Promise<{ error?: string; memberId?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { error: "Email is required to link an account" };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", normalized)
    .maybeSingle();

  if (!profile) {
    return {
      error:
        "No user found with that email. Create them in Supabase Authentication first, then add them here.",
    };
  }

  const name =
    displayName.trim() ||
    (profile.full_name as string) ||
    profile.email?.split("@")[0] ||
    "Barber";

  const { data: member, error } = await admin
    .from("barber_members")
    .upsert(
      {
        shop_id: shopId,
        user_id: profile.id,
        role: "barber",
        display_name: name,
        chair_number: chairNumber ?? null,
        is_active: true,
        is_accepting_walk_ins: true,
      },
      { onConflict: "shop_id,user_id" }
    )
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { memberId: member?.id };
}

export async function adminAddBarberMember(
  shopId: string,
  data: {
    display_name: string;
    email?: string;
    chair_number?: number | null;
  }
): Promise<{ error?: string; memberId?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const displayName = data.display_name?.trim();
  if (!displayName) return { error: "Display name is required" };

  const chairNumber =
    data.chair_number != null && !Number.isNaN(data.chair_number)
      ? Number(data.chair_number)
      : null;

  if (data.email?.trim()) {
    const result = await linkBarberByEmail(admin, shopId, data.email, displayName, chairNumber);
    if (result.error) return { error: result.error };
    await revalidateBarberShop(shopId);
    return { memberId: result.memberId };
  }

  const { data: member, error } = await admin
    .from("barber_members")
    .insert({
      shop_id: shopId,
      user_id: null,
      role: "barber",
      display_name: displayName,
      chair_number: chairNumber,
      is_active: true,
      is_accepting_walk_ins: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  await revalidateBarberShop(shopId);
  return { memberId: member?.id };
}

export async function adminUpdateBarberMember(
  shopId: string,
  memberId: string,
  updates: {
    display_name?: string;
    chair_number?: number | null;
    is_accepting_walk_ins?: boolean;
    is_active?: boolean;
  }
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const payload: Record<string, unknown> = {};
  if (updates.display_name !== undefined) payload.display_name = updates.display_name.trim();
  if (updates.chair_number !== undefined) {
    payload.chair_number =
      updates.chair_number != null && !Number.isNaN(updates.chair_number)
        ? Number(updates.chair_number)
        : null;
  }
  if (updates.is_accepting_walk_ins !== undefined) {
    payload.is_accepting_walk_ins = updates.is_accepting_walk_ins;
  }
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { error } = await admin
    .from("barber_members")
    .update(payload)
    .eq("id", memberId)
    .eq("shop_id", shopId);

  if (error) return { error: error.message };
  await revalidateBarberShop(shopId);
  return {};
}

export async function adminRemoveBarberMember(
  shopId: string,
  memberId: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("barber_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("shop_id", shopId)
    .single();

  if (!member) return { error: "Team member not found" };
  if (member.role === "owner") return { error: "Cannot remove the shop owner" };

  const { count: appointmentCount } = await admin
    .from("barber_appointments")
    .select("id", { count: "exact", head: true })
    .eq("barber_id", memberId);

  if ((appointmentCount ?? 0) > 0) {
    const { error } = await admin
      .from("barber_members")
      .update({ is_active: false, is_accepting_walk_ins: false })
      .eq("id", memberId)
      .eq("shop_id", shopId);
    if (error) return { error: error.message };
    await revalidateBarberShop(shopId);
    return {};
  }

  const { error } = await admin
    .from("barber_members")
    .delete()
    .eq("id", memberId)
    .eq("shop_id", shopId);

  if (error) return { error: error.message };
  await revalidateBarberShop(shopId);
  return {};
}

export async function adminUploadBarberMemberAvatar(
  shopId: string,
  memberId: string,
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { data: member } = await admin
      .from("barber_members")
      .select("id")
      .eq("id", memberId)
      .eq("shop_id", shopId)
      .single();
    if (!member) return { error: "Barber not found" };

    const raw = formData.get("avatar");
    if (!raw || typeof raw !== "object" || !("size" in raw)) {
      return { error: "No file provided" };
    }

    const name = (raw as { name?: string }).name || "avatar.jpg";
    const ext = name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `barber-avatars/${shopId}/${memberId}.${ext}`;

    const upload = await uploadTeamAvatarImage(
      path,
      raw as Blob & { name?: string; type?: string; size?: number }
    );
    if (upload.error || !upload.url) return { error: upload.error ?? "Upload failed" };

    const { data: updated, error: updateError } = await admin
      .from("barber_members")
      .update({ avatar_url: upload.url })
      .eq("id", memberId)
      .eq("shop_id", shopId)
      .select("avatar_url")
      .single();

    if (updateError) return { error: updateError.message };
    if (!updated?.avatar_url) {
      return { error: "Photo saved to storage but could not update profile" };
    }

    await revalidateBarberShop(shopId);
    return { error: null, url: updated.avatar_url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown upload error";
    return { error: msg };
  }
}
