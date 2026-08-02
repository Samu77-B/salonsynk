"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { revalidatePath } from "next/cache";
import { sendOwnerInviteLink, sendSalonWelcomeEmail } from "@/lib/email";
import { isMissingShowOnDiaryColumnError } from "@/lib/show-on-diary";
import { isPlanTierId, PLAN_TIERS, formatPlanPrice, type PlanTierId } from "@/config/plans";
import {
  generatePaymentInviteToken,
  paymentInviteUrl,
} from "@/lib/onboarding";
import {
  buildPlatformAuthLink,
  getAuthCallbackUrl,
  normalizeAuthActionLink,
} from "@core/auth/auth-redirect";
import { isPaymentGatewayId, type PaymentGatewayId } from "@/config/payment-gateways";

/**
 * Staff logins added by SalonSynk admin (front desk / reception) are login-only by default —
 * hidden from diary columns and stylist pickers. Falls back if the column isn't migrated yet.
 */
async function upsertSalonMemberLoginOnly(
  admin: ReturnType<typeof createAdminClient>,
  row: { salon_id: string; user_id: string; role: string; display_name: string }
): Promise<{ error: string | null }> {
  const fullRow = { ...row, is_active: true, show_on_diary: false };
  const first = await admin
    .from("salon_members")
    .upsert(fullRow, { onConflict: "salon_id,user_id" });
  if (!first.error) return { error: null };
  if (isMissingShowOnDiaryColumnError(first.error)) {
    const { show_on_diary: _omit, ...legacyRow } = fullRow;
    void _omit;
    const retry = await admin
      .from("salon_members")
      .upsert(legacyRow, { onConflict: "salon_id,user_id" });
    return { error: retry.error?.message ?? null };
  }
  return { error: first.error.message };
}

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
  ownerEmail?: string,
  paymentGateway?: string
) {
  await requireAdmin();
  const supabase = createAdminClient();
  const finalSlug = (slug || slugFromName(name)).trim();
  if (!finalSlug) return { error: "Slug is required" };

  const gateway: PaymentGatewayId =
    paymentGateway && isPaymentGatewayId(paymentGateway) ? paymentGateway : "stripe";

  const { data: salon, error: salonError } = await supabase
    .from("salons")
    .insert({ name: name.trim(), slug: finalSlug, payment_gateway: gateway })
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

const LOGO_BUCKET = "team-avatars";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

export async function adminUploadSalonLogo(
  salonId: string,
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const raw = formData.get("logo");
    if (!raw || typeof raw !== "object" || !("size" in raw) || !("type" in raw)) return { error: "No file provided" };
    const size = Number((raw as { size?: number }).size) || 0;
    const type = String((raw as { type?: string }).type || "").toLowerCase();
    if (size === 0) return { error: "No file provided" };
    if (size > MAX_LOGO_BYTES) return { error: "Image must be under 2MB" };
    if (!ALLOWED_LOGO_TYPES.includes(type)) return { error: `File type "${type}" not allowed. Use JPEG, PNG, GIF, WebP, or SVG.` };

    const name = (raw as { name?: string }).name || "logo.png";
    const ext = name.split(".").pop()?.toLowerCase() || "png";
    const path = `salon-logos/${salonId}.${ext}`;

    const arrayBuffer = await (raw as Blob).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { error: uploadError } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(path, buffer, { upsert: true, contentType: type });

    if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

    const { data: urlData } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);
    const url = urlData.publicUrl;

    const { data: existing } = await admin
      .from("salons")
      .select("settings")
      .eq("id", salonId)
      .single();
    if (!existing) return { error: "Salon not found" };

    const current = (existing.settings as Record<string, unknown>) ?? {};
    const branding = (current.branding as Record<string, unknown>) ?? {};
    const nextBranding = { ...branding, logo_url: url };
    const { error: updateError } = await admin
      .from("salons")
      .update({ settings: { ...current, branding: nextBranding } })
      .eq("id", salonId);
    if (updateError) return { error: updateError.message };

    revalidatePath("/admin");
    revalidatePath("/admin/salons");
    revalidatePath(`/admin/salons/${salonId}`);
    return { error: null, url };
  } catch (err) {
    console.error("[adminUploadSalonLogo]", err);
    const msg = err instanceof Error ? err.message : "Unknown upload error";
    return { error: msg };
  }
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
  revalidatePath(`/shop/${previousSlug}`);
  revalidatePath(`/${previousSlug}/shop`);
  if (payload.slug && payload.slug !== previousSlug) {
    revalidatePath(`/book/${payload.slug}`);
    revalidatePath(`/shop/${payload.slug}`);
    revalidatePath(`/${payload.slug}/shop`);
  }
  return {};
}

export async function adminUpdateSalonPlan(
  salonId: string,
  input: {
    planTier: string;
    featureOverrides?: Record<string, boolean>;
  }
): Promise<{ error: string | null }> {
  await requireAdmin();
  if (!isPlanTierId(input.planTier)) {
    return { error: "Invalid plan tier" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("salons")
    .update({
      plan_tier: input.planTier as PlanTierId,
      feature_overrides: input.featureOverrides ?? {},
    })
    .eq("id", salonId);

  if (error) {
    if (error.message?.includes("plan_tier") || error.code === "42703") {
      return {
        error:
          "Plan columns are missing. Run migration 039_salon_plan_tier.sql in Supabase.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  return { error: null };
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

/** Create owner with email + password directly. No email verification. */
export async function adminCreateOwnerWithPassword(
  salonId: string,
  email: string,
  password: string,
  displayName?: string
) {
  await requireAdmin();
  const supabase = createAdminClient();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required" };
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters" };

  const name = (displayName?.trim() || trimmed.split("@")[0]) || "Owner";

  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email: trimmed,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (createError) {
    if (createError.message?.toLowerCase().includes("already") || createError.message?.toLowerCase().includes("registered")) {
      return { error: "That email is already registered. Use Add owner instead." };
    }
    return { error: createError.message };
  }

  const userId = userData?.user?.id;
  if (!userId) return { error: "User created but could not add as owner." };

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

/** Set password for an existing owner (e.g. demo accounts on example.com where email reset cannot be received). */
export async function adminSetOwnerPassword(
  salonId: string,
  email: string,
  password: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required" };
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", trimmed)
    .maybeSingle();

  let userId = profile?.id as string | undefined;
  if (!userId) {
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000, page: 1 });
    if (listError) return { error: listError.message };
    userId = listData.users.find((u) => u.email?.toLowerCase() === trimmed)?.id;
  }
  if (!userId) return { error: "No user found with that email." };

  const { data: member } = await supabase
    .from("salon_members")
    .select("id, role")
    .eq("salon_id", salonId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!member || (member.role ?? "").toLowerCase() !== "owner") {
    const { error: memberError } = await supabase.from("salon_members").upsert(
      {
        salon_id: salonId,
        user_id: userId,
        role: "owner",
        display_name: trimmed.split("@")[0] || "Owner",
        is_active: true,
      },
      { onConflict: "salon_id,user_id" }
    );
    if (memberError) return { error: memberError.message };
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
  if (updateError) return { error: updateError.message };

  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  return {};
}

/** Invite a new user by email and add them as salon owner. Sends invite via Resend. */
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

  const { data: salon } = await supabase
    .from("salons")
    .select("name")
    .eq("id", salonId)
    .single();
  const salonName = (salon?.name as string) || "the salon";

  const redirectTo = getAuthCallbackUrl("salon");

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: trimmed,
    options: { data: { full_name: name }, redirectTo },
  });

  if (linkError) {
    if (linkError.message?.includes("already been registered")) {
      return { error: "That email is already registered. Use Add owner instead." };
    }
    return { error: linkError.message };
  }

  const userId = linkData?.user?.id;
  if (!userId) return { error: "Could not create user. Try again or use Create owner instead." };

  const actionLink = getAuthActionLink(linkData);
  if (!actionLink) return { error: "User created but could not generate invite link." };

  const emailResult = await sendOwnerInviteLink(trimmed, actionLink, salonName);
  if (emailResult.error) return { error: `User created but email failed: ${emailResult.error}` };

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

function assertNonManagerRole(role: string): { ok: true } | { error: string } {
  const r = (role ?? "").trim().toLowerCase();
  if (!r) return { error: "Role is required" };
  if (r === "owner" || r.includes("manager")) return { error: "Role must not be owner/manager" };
  return { ok: true };
}

export async function adminAssignStaff(
  salonId: string,
  email: string,
  role = "staff"
): Promise<{ error?: string }> {
  await requireAdmin();
  const roleCheck = assertNonManagerRole(role);
  if ("error" in roleCheck) return roleCheck;

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
    (profile.full_name as string) || trimmed.split("@")[0] || "Staff";

  const upsert = await upsertSalonMemberLoginOnly(supabase, {
    salon_id: salonId,
    user_id: profile.id,
    role,
    display_name: displayName,
  });
  if (upsert.error) return { error: upsert.error };
  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  revalidatePath("/dashboard");
  return {};
}

/** Create staff login with email + password directly. No email verification. */
export async function adminCreateStaffWithPassword(
  salonId: string,
  email: string,
  password: string,
  displayName?: string,
  role = "staff"
): Promise<{ error?: string }> {
  await requireAdmin();
  const roleCheck = assertNonManagerRole(role);
  if ("error" in roleCheck) return roleCheck;

  const supabase = createAdminClient();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required" };
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters" };

  const name = (displayName?.trim() || trimmed.split("@")[0]) || "Staff";

  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email: trimmed,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (createError) {
    if (createError.message?.toLowerCase().includes("already") || createError.message?.toLowerCase().includes("registered")) {
      return { error: "That email is already registered. Use Add existing staff instead." };
    }
    return { error: createError.message };
  }

  const userId = userData?.user?.id;
  if (!userId) return { error: "User created but could not add as staff." };

  const upsert = await upsertSalonMemberLoginOnly(supabase, {
    salon_id: salonId,
    user_id: userId,
    role,
    display_name: name,
  });

  if (upsert.error) return { error: upsert.error };
  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  revalidatePath("/dashboard");
  return {};
}

/** Invite a new user by email and add them as staff. Sends invite via Resend. */
export async function adminInviteStaff(
  salonId: string,
  email: string,
  displayName?: string,
  role = "staff"
): Promise<{ error?: string }> {
  await requireAdmin();
  const roleCheck = assertNonManagerRole(role);
  if ("error" in roleCheck) return roleCheck;

  const supabase = createAdminClient();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required" };

  const name = (displayName?.trim() || trimmed.split("@")[0]) || "Staff";

  const { data: salon } = await supabase
    .from("salons")
    .select("name")
    .eq("id", salonId)
    .single();
  const salonName = (salon?.name as string) || "the salon";

  const redirectTo = getAuthCallbackUrl("salon");

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: trimmed,
    options: { data: { full_name: name }, redirectTo },
  });

  if (linkError) {
    if (linkError.message?.includes("already been registered")) {
      return { error: "That email is already registered. Use Add existing staff instead." };
    }
    return { error: linkError.message };
  }

  const userId = linkData?.user?.id;
  if (!userId) return { error: "Could not create user. Try again or use Create staff instead." };

  const actionLink = getAuthActionLink(linkData);
  if (!actionLink) return { error: "User created but could not generate invite link." };

  const emailResult = await sendOwnerInviteLink(trimmed, actionLink, salonName);
  if (emailResult.error) return { error: `User created but email failed: ${emailResult.error}` };

  const upsert = await upsertSalonMemberLoginOnly(supabase, {
    salon_id: salonId,
    user_id: userId,
    role,
    display_name: name,
  });

  if (upsert.error) return { error: upsert.error };
  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  revalidatePath("/dashboard");
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

  const redirectTo = getAuthCallbackUrl("salon");

  function getActionLink(d: unknown): string | null {
    if (!d || typeof d !== "object") return null;
    const o = d as Record<string, unknown>;
    const direct = o.action_link;
    if (typeof direct === "string") return normalizeAuthActionLink(direct);
    const props = o.properties as Record<string, unknown> | undefined;
    const fromProps = props?.action_link;
    if (typeof fromProps === "string") return normalizeAuthActionLink(fromProps);
    const user = o.user as Record<string, unknown> | undefined;
    const fromUser = user?.action_link;
    if (typeof fromUser === "string") return normalizeAuthActionLink(fromUser);
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

function getAuthActionLink(d: unknown): string | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const direct = o.action_link;
  if (typeof direct === "string") return normalizeAuthActionLink(direct);
  const props = o.properties as Record<string, unknown> | undefined;
  const fromProps = props?.action_link;
  if (typeof fromProps === "string") return normalizeAuthActionLink(fromProps);
  const user = o.user as Record<string, unknown> | undefined;
  const fromUser = user?.action_link;
  if (typeof fromUser === "string") return normalizeAuthActionLink(fromUser);
  return null;
}

/**
 * Invite/create owner, enable pay-before-access, and email welcome + payment link.
 */
export async function adminSendSalonWelcomeEmail(
  salonId: string,
  email: string,
  displayName?: string
): Promise<{ error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Owner email is required" };

  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, plan_tier")
    .eq("id", salonId)
    .single();
  if (!salon) return { error: "Salon not found" };

  const rawTier = (salon as { plan_tier?: string }).plan_tier ?? "professional";
  const planTier: PlanTierId = isPlanTierId(rawTier) ? rawTier : "professional";
  const planMeta = PLAN_TIERS[planTier];
  const ownerName = (displayName?.trim() || trimmed.split("@")[0]) || "there";
  const salonName = (salon.name as string) || "your salon";

  const redirectTo = getAuthCallbackUrl("salon");

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: trimmed,
    options: { redirectTo, data: { full_name: ownerName } },
  });

  let loginLink: string | null = buildPlatformAuthLink(linkData, "salon", "invite");
  let linkPayload: unknown = linkData;

  if (linkError || !loginLink) {
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: trimmed,
      options: { redirectTo },
    });
    if (recoveryError && linkError) return { error: linkError.message };
    if (recoveryError && !loginLink) return { error: recoveryError.message };
    loginLink = buildPlatformAuthLink(recoveryData, "salon", "recovery");
    linkPayload = recoveryData;
  }

  if (!loginLink) return { error: "Could not generate login link for this email." };

  const invitedUserId =
    (linkPayload as { user?: { id?: string } } | null)?.user?.id ??
    (await supabase.from("profiles").select("id").eq("email", trimmed).single()).data?.id;

  if (invitedUserId) {
    const { error: memberError } = await supabase.from("salon_members").upsert(
      {
        salon_id: salonId,
        user_id: invitedUserId,
        role: "owner",
        display_name: ownerName,
        is_active: true,
      },
      { onConflict: "salon_id,user_id" }
    );
    if (memberError) return { error: memberError.message };
  }

  const paymentToken = generatePaymentInviteToken();
  const { error: updateError } = await supabase
    .from("salons")
    .update({
      payment_invite_token: paymentToken,
      subscription_required: true,
      subscription_status: "trialing",
      onboarding_welcome_sent_at: new Date().toISOString(),
    })
    .eq("id", salonId);

  if (updateError) {
    if (updateError.message?.includes("payment_invite_token") || updateError.code === "42703") {
      return {
        error: "Onboarding columns are missing. Run migration 040_salon_onboarding.sql in Supabase.",
      };
    }
    return { error: updateError.message };
  }

  const emailResult = await sendSalonWelcomeEmail({
    to: trimmed,
    ownerName,
    salonName,
    planLabel: planMeta.label,
    planPrice: formatPlanPrice(planTier),
    loginLink,
    paymentLink: paymentInviteUrl(paymentToken),
  });
  if (emailResult.error) return { error: emailResult.error };

  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  return {};
}

/** Grant 30-day dashboard access without payment (e.g. existing clients before trial rollout). */
export async function adminStartSalonFreeTrial(salonId: string): Promise<{ error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("salons")
    .update({
      subscription_required: true,
      subscription_status: "trialing",
    })
    .eq("id", salonId);
  if (error) return { error: error.message };
  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  return {};
}

export async function adminUpdateSalonPaymentGateway(
  salonId: string,
  paymentGateway: string
): Promise<{ error: string | null }> {
  await requireAdmin();
  if (!isPaymentGatewayId(paymentGateway)) {
    return { error: "Invalid payment gateway" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("salons")
    .update({ payment_gateway: paymentGateway })
    .eq("id", salonId);

  if (error) {
    if (error.message?.includes("payment_gateway") || error.code === "42703") {
      return {
        error: "Payment gateway column missing. Run migration 041_salon_payment_gateway.sql in Supabase.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/salons");
  revalidatePath(`/admin/salons/${salonId}`);
  return { error: null };
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
