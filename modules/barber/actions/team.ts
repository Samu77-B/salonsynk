"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserShop } from "@modules/barber/lib/shop";

const AVATAR_BUCKET = "team-avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

async function requireShopOwner() {
  const context = await getCurrentUserShop();
  if (!context) return { error: "Unauthorized" as const, context: null };
  if (context.member.role !== "owner" && context.member.id !== "admin") {
    return { error: "Only shop owners can manage the team" as const, context: null };
  }
  return { error: null, context };
}

function revalidateTeamPaths(slug?: string) {
  revalidatePath("/barber/team");
  revalidatePath("/barber/dashboard");
  if (slug) revalidatePath(`/barber/join/${slug}`);
}

export async function addBarberTeamMember(data: {
  display_name: string;
  email?: string;
  chair_number?: number | null;
}): Promise<{ error?: string; memberId?: string }> {
  const { error, context } = await requireShopOwner();
  if (error || !context) return { error: error ?? "Unauthorized" };

  const admin = createAdminClient();
  const shopId = context.shop.id;
  const displayName = data.display_name?.trim();
  if (!displayName) return { error: "Display name is required" };

  const chairNumber =
    data.chair_number != null && !Number.isNaN(data.chair_number)
      ? Number(data.chair_number)
      : null;

  if (data.email?.trim()) {
    const email = data.email.trim().toLowerCase();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
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
          chair_number: chairNumber,
          is_active: true,
          is_accepting_walk_ins: true,
        },
        { onConflict: "shop_id,user_id" }
      )
      .select("id")
      .single();

    if (upsertError) return { error: upsertError.message };
    revalidateTeamPaths(context.shop.slug);
    return { memberId: member?.id };
  }

  const { data: member, error: insertError } = await admin
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

  if (insertError) return { error: insertError.message };
  revalidateTeamPaths(context.shop.slug);
  return { memberId: member?.id };
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

  const supabase = await createClient();
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

  const { error: updateError } = await supabase
    .from("barber_members")
    .update(payload)
    .eq("id", memberId)
    .eq("shop_id", context.shop.id);

  if (updateError) return { error: updateError.message };
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
  if (!raw || typeof raw !== "object" || !("size" in raw) || !("type" in raw)) {
    return { error: "No file provided" };
  }
  const size = Number((raw as { size?: number }).size) || 0;
  const type = String((raw as { type?: string }).type || "").toLowerCase();
  if (size === 0) return { error: "No file provided" };
  if (size > MAX_AVATAR_BYTES) return { error: "Image must be under 2MB" };
  if (!ALLOWED_TYPES.includes(type)) return { error: "Use JPEG, PNG, GIF, or WebP" };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("barber_members")
    .select("id")
    .eq("id", memberId)
    .eq("shop_id", context.shop.id)
    .single();
  if (!member) return { error: "Barber not found" };

  const name = (raw as { name?: string }).name || "avatar.jpg";
  const ext = name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `barber-avatars/${context.shop.id}/${memberId}.${ext}`;

  const arrayBuffer = await (raw as Blob).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { upsert: true, contentType: type });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const url = urlData.publicUrl;

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("barber_members")
    .update({ avatar_url: url })
    .eq("id", memberId)
    .eq("shop_id", context.shop.id);

  if (updateError) return { error: updateError.message };

  revalidateTeamPaths(context.shop.slug);
  return { error: null, url };
}
