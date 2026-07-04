"use server";

import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { revalidatePath } from "next/cache";
import { getAuthCallbackUrl } from "@core/auth/auth-redirect";
import {
  formatPlatformPrice,
  paymentInviteUrl,
  platformProductName,
  type BillingPlatform,
} from "@core/billing/platform-billing";
import { generatePaymentInviteToken } from "@core/billing/platform-onboarding";
import { sendBarberWelcomeEmail, sendNailWelcomeEmail } from "@/lib/email";
import { tenantTable } from "@core/billing/stripe-metadata";

function getAuthActionLink(d: unknown): string | null {
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

type MemberConfig = {
  table: string;
  tenantColumn: string;
  role: string;
};

const MEMBER_CONFIG: Record<"barber" | "nail", MemberConfig> = {
  barber: { table: "barber_members", tenantColumn: "shop_id", role: "owner" },
  nail: { table: "nail_members", tenantColumn: "salon_id", role: "owner" },
};

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
  const productName = platformProductName(platform);
  const planPrice = formatPlatformPrice(platform);

  const redirectTo = getAuthCallbackUrl(platform);

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: trimmed,
    options: { redirectTo, data: { full_name: ownerName } },
  });

  let loginLink: string | null = getAuthActionLink(linkData);

  if (linkError) {
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: trimmed,
      options: { redirectTo },
    });
    if (recoveryError) return { error: linkError.message };
    loginLink = getAuthActionLink(recoveryData);
  }

  if (!loginLink) return { error: "Could not generate login link for this email." };

  const invitedUserId =
    (linkData as { user?: { id?: string } } | null)?.user?.id ??
    (await supabase.from("profiles").select("id").eq("email", trimmed).single()).data?.id;

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
  const { error: updateError } = await supabase
    .from(tenantTableName)
    .update({
      payment_invite_token: paymentToken,
      subscription_required: true,
      subscription_status: "inactive",
      onboarding_welcome_sent_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (updateError) {
    if (updateError.message?.includes("payment_invite_token") || updateError.code === "42703") {
      return { error: "Onboarding columns are missing. Run barber/nail migrations in Supabase." };
    }
    return { error: updateError.message };
  }

  const paymentLink = paymentInviteUrl(platform, paymentToken);
  const emailParams = {
    to: trimmed,
    ownerName,
    businessName,
    planPrice,
    loginLink,
    paymentLink,
  };

  const emailResult =
    platform === "barber"
      ? await sendBarberWelcomeEmail(emailParams)
      : await sendNailWelcomeEmail(emailParams);

  if (emailResult.error) return { error: emailResult.error };

  const adminListPath = platform === "barber" ? "/admin/barber-shops" : "/admin/nail-salons";
  revalidatePath("/admin");
  revalidatePath(adminListPath);
  revalidatePath(`${adminListPath}/${tenantId}`);
  return {};
}
