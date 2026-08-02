"use server";

import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { revalidatePath } from "next/cache";
import {
  buildPlatformAuthLink,
  getAuthCallbackUrl,
  type AuthLinkType,
} from "@core/auth/auth-redirect";
import {
  formatPlatformPrice,
  paymentInviteUrl,
} from "@core/billing/platform-billing";
import { generatePaymentInviteToken } from "@core/billing/platform-onboarding";
import { sendBarberWelcomeEmail, sendNailWelcomeEmail } from "@/lib/email";
import { tenantTable } from "@core/billing/stripe-metadata";

function getUserIdFromLinkPayload(d: unknown): string | undefined {
  if (!d || typeof d !== "object") return undefined;
  const user = (d as { user?: { id?: string } }).user;
  return user?.id;
}

type MemberConfig = {
  table: string;
  tenantColumn: string;
  role: string;
};

const MEMBER_CONFIG: Record<"barber" | "nail", MemberConfig> = {
  barber: { table: "barber_members", tenantColumn: "shop_id", role: "owner" },
  nail: { table: "nail_members", tenantColumn: "salon_id", role: "owner" },
};

async function tryGenerateOwnerLink(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  platform: "barber" | "nail",
  type: Extract<AuthLinkType, "invite" | "recovery" | "magiclink">,
  options: { redirectTo: string; data?: { full_name: string } }
): Promise<{ loginLink?: string; linkPayload?: unknown; error?: string }> {
  const params =
    type === "invite"
      ? ({ type: "invite", email, options } as const)
      : type === "recovery"
        ? ({ type: "recovery", email, options: { redirectTo: options.redirectTo } } as const)
        : ({ type: "magiclink", email, options: { redirectTo: options.redirectTo } } as const);

  const { data, error } = await supabase.auth.admin.generateLink(params);
  if (error) return { error: error.message };
  const loginLink = buildPlatformAuthLink(data, platform, type);
  if (!loginLink) return { error: "Could not generate login link for this email." };
  return { loginLink, linkPayload: data };
}

async function generateOwnerLoginLink(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  ownerName: string,
  platform: "barber" | "nail"
): Promise<{ loginLink?: string; linkPayload?: unknown; error?: string }> {
  const redirectTo = getAuthCallbackUrl(platform);

  const invite = await tryGenerateOwnerLink(supabase, email, platform, "invite", {
    redirectTo,
    data: { full_name: ownerName },
  });
  if (invite.loginLink) return invite;

  const recovery = await tryGenerateOwnerLink(supabase, email, platform, "recovery", {
    redirectTo,
  });
  if (recovery.loginLink) return recovery;

  const magic = await tryGenerateOwnerLink(supabase, email, platform, "magiclink", {
    redirectTo,
  });
  if (magic.loginLink) return magic;

  return {
    error:
      magic.error ||
      recovery.error ||
      invite.error ||
      "Could not generate login link for this email.",
  };
}

export async function adminSendPlatformWelcomeEmail(
  platform: "barber" | "nail",
  tenantId: string,
  ownerEmail: string,
  displayName?: string
): Promise<{ error?: string }> {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) return { error: "Unauthorized" };

  const trimmed = ownerEmail.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required" };

  const supabase = createAdminClient();
  const tenantTableName = tenantTable(platform);
  const { data: tenant } = await supabase
    .from(tenantTableName)
    .select("id, name")
    .eq("id", tenantId)
    .single();

  if (!tenant) return { error: "Business not found" };

  const ownerName = (displayName?.trim() || trimmed.split("@")[0]) || "there";
  const businessName = (tenant.name as string) || "your business";
  const planPrice = formatPlatformPrice(platform);

  const linkResult = await generateOwnerLoginLink(supabase, trimmed, ownerName, platform);
  if (linkResult.error || !linkResult.loginLink) {
    return { error: linkResult.error ?? "Could not generate login link for this email." };
  }

  const invitedUserId =
    getUserIdFromLinkPayload(linkResult.linkPayload) ??
    (await supabase.from("profiles").select("id").eq("email", trimmed).maybeSingle()).data?.id;

  if (invitedUserId) {
    const memberCfg = MEMBER_CONFIG[platform];
    const { error: memberError } = await supabase.from(memberCfg.table).upsert(
      {
        [memberCfg.tenantColumn]: tenantId,
        user_id: invitedUserId,
        role: memberCfg.role,
        display_name: ownerName,
        is_active: true,
        ...(platform === "barber" ? { is_accepting_walk_ins: false } : {}),
      },
      { onConflict: `${memberCfg.tenantColumn},user_id` }
    );
    if (memberError) return { error: memberError.message };
  }

  const paymentToken = generatePaymentInviteToken();
  const paymentLink = paymentInviteUrl(platform, paymentToken);
  const emailParams = {
    to: trimmed,
    ownerName,
    businessName,
    planPrice,
    loginLink: linkResult.loginLink,
    paymentLink,
  };

  const emailResult =
    platform === "barber"
      ? await sendBarberWelcomeEmail(emailParams)
      : await sendNailWelcomeEmail(emailParams);

  if (emailResult.error) return { error: emailResult.error };

  const { error: updateError } = await supabase
    .from(tenantTableName)
    .update({
      payment_invite_token: paymentToken,
      subscription_required: true,
      subscription_status: "trialing",
      onboarding_welcome_sent_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (updateError) {
    if (updateError.message?.includes("payment_invite_token") || updateError.code === "42703") {
      return { error: "Onboarding columns are missing. Run barber/nail migrations in Supabase." };
    }
    return { error: updateError.message };
  }

  const adminListPath = platform === "barber" ? "/admin/barber-shops" : "/admin/nail-salons";
  revalidatePath("/admin");
  revalidatePath(adminListPath);
  revalidatePath(`${adminListPath}/${tenantId}`);
  return {};
}
