"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { revalidatePath } from "next/cache";
import { sendOwnerInviteLink } from "@/lib/email";

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

/** Invite a new user by email and add them as salon owner. Sends a signup email. */
export async function adminInviteOwner(
  salonId: string,
  email: string,
  displayName?: string
) {
  await requireAdmin();
  const supabase = createAdminClient();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required" };

  const name = (displayName?.trim() || trimmed.split("@")[0]) || "Owner";

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://salonsynk.vercel.app";
  const redirectTo = `${baseUrl}/auth/callback`;

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    trimmed,
    { data: { full_name: name }, redirectTo }
  );

  if (inviteError) {
    if (inviteError.message?.includes("already been registered")) {
      return { error: "That email is already registered. Use Add owner instead." };
    }
    return { error: inviteError.message };
  }

  const userId = inviteData?.user?.id;
  if (!userId) return { error: "Invite sent but could not add as owner. Add them manually after they sign up." };

  const { error: memberError } = await supabase.from("salon_members").upsert(
    {
      salon_id: salonId,
      user_id: userId,
      role: "owner",
      display_name: name,
      is_active: true,
    },
    { onConflict: "salon_id,user_id" }
  );

  if (memberError) return { error: memberError.message };
  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  return {};
}

/** Resend invite link to an owner's email (e.g. after fixing Site URL). Uses generateLink + Resend. */
export async function adminResendOwnerInvite(
  salonId: string,
  email: string
) {
  await requireAdmin();
  const supabase = createAdminClient();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required" };

  const { data: salon } = await supabase
    .from("salons")
    .select("name")
    .eq("id", salonId)
    .single();
  if (!salon) return { error: "Salon not found" };
  const salonName = (salon.name as string) || "the salon";

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://salonsynk.vercel.app";
  const redirectTo = `${baseUrl}/auth/callback`;

  function getActionLink(d: unknown): string | null {
    if (!d || typeof d !== "object") return null;
    const o = d as Record<string, unknown>;
    const direct = o.action_link;
    if (typeof direct === "string") return direct;
    const props = o.properties as Record<string, unknown> | undefined;
    const fromProps = props?.action_link;
    if (typeof fromProps === "string") return fromProps;
    const user = o.user as Record<string, unknown> | undefined;
    const fromUser = user?.action_link;
    if (typeof fromUser === "string") return fromUser;
    return null;
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: trimmed,
    options: { redirectTo },
  });

  if (linkError) {
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: trimmed,
      options: { redirectTo },
    });
    if (recoveryError) return { error: linkError.message };
    const actionLink = getActionLink(recoveryData);
    if (!actionLink) return { error: "Could not generate link. User may need to be invited first." };
    const err = await sendOwnerInviteLink(trimmed, actionLink, salonName);
    if (err.error) return err;
    revalidatePath(`/admin/salons/${salonId}`);
    return {};
  }

  const actionLink = getActionLink(linkData);
  if (!actionLink) return { error: "Could not generate link. User may need to be invited first." };

  const err = await sendOwnerInviteLink(trimmed, actionLink, salonName);
  if (err.error) return err;
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

export async function adminDeleteSalon(salonId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  // Delete in order (appointments reference salon_members)
  const { error: e1 } = await supabase.from("appointments").delete().eq("salon_id", salonId);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase.from("salon_invites").delete().eq("salon_id", salonId);
  if (e2) return { error: e2.message };
  const { error: e3 } = await supabase.from("salon_members").delete().eq("salon_id", salonId);
  if (e3) return { error: e3.message };
  const { error: e4 } = await supabase.from("services").delete().eq("salon_id", salonId);
  if (e4) return { error: e4.message };
  const { error: e5 } = await supabase.from("clients").delete().eq("salon_id", salonId);
  if (e5) return { error: e5.message };
  const { error: e6 } = await supabase.from("salons").delete().eq("id", salonId);
  if (e6) return { error: e6.message };
  revalidatePath("/admin");
  revalidatePath("/admin/salons");
  return {};
}
