"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@core/supabase/admin";
import { uploadTeamAvatarImage } from "@core/storage/team-avatar";
import { getCurrentUserShop } from "@modules/barber/lib/shop";

async function requireShopOwner() {
  const context = await getCurrentUserShop();
  if (!context) return { error: "Unauthorized" as const, context: null };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Only shop owners can manage the team" as const, context: null };
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

function revalidateTeamPaths(slug?: string) {
  revalidatePath("/barber/team");
  revalidatePath("/barber/dashboard");
  if (slug) revalidatePath(`/barber/join/${slug}`);
}

async function uploadAvatarForMember(
  shopId: string,
  memberId: string,
  raw: Blob & { name?: string; type?: string; size?: number }
): Promise<{ error: string | null; url?: string }> {
  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const name = raw.name || "avatar.jpg";
  const ext = name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `barber-avatars/${shopId}/${memberId}.${ext}`;

  const upload = await uploadTeamAvatarImage(path, raw);
  if (upload.error || !upload.url) return { error: upload.error ?? "Upload failed" };

  const { data: updated, error: updateError } = await admin
    .from("barber_members")
    .update({ avatar_url: upload.url })
    .eq("id", memberId)
    .eq("shop_id", shopId)
    .select("avatar_url")
    .single();

  if (updateError) return { error: updateError.message };
  if (!updated?.avatar_url) return { error: "Photo saved to storage but could not update profile" };
  return { error: null, url: updated.avatar_url };
}

export async function addBarberTeamMember(
  formData: FormData
): Promise<{ error?: string; memberId?: string }> {
  const { error, context } = await requireShopOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const displayName = (formData.get("display_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const chairRaw = (formData.get("chair_number") as string)?.trim();
  const chair =
    chairRaw === "" ? null : Number.parseInt(chairRaw, 10);

  if (!displayName) return { error: "Display name is required" };

  const shopId = context.shop.id;
  let memberId: string | undefined;

  if (email) {
    const normalized = email.toLowerCase();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", normalized)
      .maybeSingle();

    if (!profile) {
      return {
        error:
          "No account found with that email. They need to sign up first, or add them without email.",
      };
    }

    const name =
      displayName ||
      (profile.full_name as string) ||
      profile.email?.split("@")[0] ||
      "Barber";

    const { data: member, error: upsertError } = await admin
      .from("barber_members")
      .upsert(
        {
          shop_id: shopId,
          user_id: profile.id,
          role: "barber",
          display_name: name,
          chair_number: chair != null && !Number.isNaN(chair) ? chair : null,
          is_active: true,
          is_accepting_walk_ins: true,
        },
        { onConflict: "shop_id,user_id" }
      )
      .select("id")
      .single();

    if (upsertError) return { error: upsertError.message };
    memberId = member?.id;
  } else {
    const { data: member, error: insertError } = await admin
      .from("barber_members")
      .insert({
        shop_id: shopId,
        user_id: null,
        role: "barber",
        display_name: displayName,
        chair_number: chair != null && !Number.isNaN(chair) ? chair : null,
        is_active: true,
        is_accepting_walk_ins: true,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.message.includes("user_id") && insertError.message.includes("null")) {
        return {
          error:
            "Database migration required: run migration 044_barber_member_without_user.sql in Supabase.",
        };
      }
      return { error: insertError.message };
    }
    memberId = member?.id;
  }

  const avatarRaw = formData.get("avatar");
  if (memberId && avatarRaw && typeof avatarRaw === "object" && "size" in avatarRaw) {
    const upload = await uploadAvatarForMember(
      shopId,
      memberId,
      avatarRaw as Blob & { name?: string; type?: string; size?: number }
    );
    if (upload.error) {
      revalidateTeamPaths(context.shop.slug);
      return {
        error: `Barber added but photo upload failed: ${upload.error}`,
        memberId,
      };
    }
  }

  revalidateTeamPaths(context.shop.slug);
  return { memberId };
}

export async function updateBarberTeamMember(
  memberId: string,
  updates: {
    display_name?: string;
    chair_number?: number | null;
    is_accepting_walk_ins?: boolean;
  }
): Promise<{ error?: string }> {
  const { error, context } = await requireShopOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

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

  const { error: updateError } = await admin
    .from("barber_members")
    .update(payload)
    .eq("id", memberId)
    .eq("shop_id", context.shop.id);

  if (updateError) return { error: updateError.message };
  revalidateTeamPaths(context.shop.slug);
  return {};
}

export async function updateBarberShopBranding(updates: {
  show_title_on_queue?: boolean;
  company_name?: string;
}): Promise<{ error?: string }> {
  const { error, context } = await requireShopOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { data: existing } = await admin
    .from("barber_shops")
    .select("settings")
    .eq("id", context.shop.id)
    .single();
  if (!existing) return { error: "Shop not found" };

  const current = (existing.settings as Record<string, unknown>) ?? {};
  const branding = { ...(current.branding as object), ...updates };
  if (updates.company_name !== undefined) {
    branding.company_name = updates.company_name.trim();
  }

  const { error: updateError } = await admin
    .from("barber_shops")
    .update({ settings: { ...current, branding } })
    .eq("id", context.shop.id);

  if (updateError) return { error: updateError.message };
  revalidateTeamPaths(context.shop.slug);
  return {};
}

export async function removeBarberTeamMember(memberId: string): Promise<{ error?: string }> {
  const { error, context } = await requireShopOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const { admin, error: adminError } = getAdmin();
  if (adminError || !admin) return { error: adminError ?? "Admin client unavailable" };

  const { data: member } = await admin
    .from("barber_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("shop_id", context.shop.id)
    .single();

  if (!member) return { error: "Team member not found" };
  if (member.role === "owner") return { error: "Cannot remove the shop owner" };

  const { count: appointmentCount } = await admin
    .from("barber_appointments")
    .select("id", { count: "exact", head: true })
    .eq("barber_id", memberId);

  if ((appointmentCount ?? 0) > 0) {
    const { error: deactivateError } = await admin
      .from("barber_members")
      .update({ is_active: false, is_accepting_walk_ins: false })
      .eq("id", memberId)
      .eq("shop_id", context.shop.id);
    if (deactivateError) return { error: deactivateError.message };
    revalidateTeamPaths(context.shop.slug);
    return {};
  }

  const { error: deleteError } = await admin
    .from("barber_members")
    .delete()
    .eq("id", memberId)
    .eq("shop_id", context.shop.id);

  if (deleteError) return { error: deleteError.message };
  revalidateTeamPaths(context.shop.slug);
  return {};
}

export async function uploadBarberTeamMemberAvatar(
  memberId: string,
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  const { error, context } = await requireShopOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const raw = formData.get("avatar");
  if (!raw || typeof raw !== "object" || !("size" in raw)) {
    return { error: "No file provided" };
  }

  const result = await uploadAvatarForMember(
    context.shop.id,
    memberId,
    raw as Blob & { name?: string; type?: string; size?: number }
  );
  if (!result.error) revalidateTeamPaths(context.shop.slug);
  return result;
}
