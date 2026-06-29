import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingPlatform } from "@core/billing/platform-billing";
import { parsePlanTier } from "@/lib/onboarding";
import type { PlanTierId } from "@/config/plans";

export type TenantByToken = {
  platform: BillingPlatform;
  id: string;
  name: string;
  plan_tier?: PlanTierId | null;
  subscription_status?: string | null;
  subscription_required?: boolean | null;
  payment_invite_token?: string | null;
  stripe_billing_customer_id?: string | null;
  owner_email: string | null;
};

export function generatePaymentInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

async function ownerEmailForUserId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();
  return (profile?.email as string | null) ?? null;
}

export async function fetchTenantByPaymentToken(
  token: string,
  platform: BillingPlatform
): Promise<TenantByToken | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const admin = createAdminClient();

  if (platform === "salon") {
    const { data: salon } = await admin
      .from("salons")
      .select(
        "id, name, plan_tier, subscription_status, subscription_required, payment_invite_token, stripe_billing_customer_id"
      )
      .eq("payment_invite_token", trimmed)
      .single();
    if (!salon) return null;

    const { data: ownerMember } = await admin
      .from("salon_members")
      .select("user_id")
      .eq("salon_id", salon.id)
      .eq("role", "owner")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const ownerEmail = ownerMember?.user_id
      ? await ownerEmailForUserId(ownerMember.user_id)
      : null;

    return {
      platform: "salon",
      id: salon.id,
      name: salon.name,
      plan_tier: parsePlanTier(salon.plan_tier),
      subscription_status: salon.subscription_status,
      subscription_required: salon.subscription_required,
      payment_invite_token: salon.payment_invite_token,
      stripe_billing_customer_id: salon.stripe_billing_customer_id,
      owner_email: ownerEmail,
    };
  }

  if (platform === "barber") {
    const { data: shop } = await admin
      .from("barber_shops")
      .select(
        "id, name, subscription_status, subscription_required, payment_invite_token, stripe_billing_customer_id"
      )
      .eq("payment_invite_token", trimmed)
      .single();
    if (!shop) return null;

    const { data: ownerMember } = await admin
      .from("barber_members")
      .select("user_id")
      .eq("shop_id", shop.id)
      .eq("role", "owner")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const ownerEmail = ownerMember?.user_id
      ? await ownerEmailForUserId(ownerMember.user_id)
      : null;

    return {
      platform: "barber",
      id: shop.id,
      name: shop.name,
      subscription_status: shop.subscription_status,
      subscription_required: shop.subscription_required,
      payment_invite_token: shop.payment_invite_token,
      stripe_billing_customer_id: shop.stripe_billing_customer_id,
      owner_email: ownerEmail,
    };
  }

  const { data: nailSalon } = await admin
    .from("nail_salons")
    .select(
      "id, name, subscription_status, subscription_required, payment_invite_token, stripe_billing_customer_id"
    )
    .eq("payment_invite_token", trimmed)
    .single();
  if (!nailSalon) return null;

  const { data: ownerMember } = await admin
    .from("nail_members")
    .select("user_id")
    .eq("salon_id", nailSalon.id)
    .eq("role", "owner")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const ownerEmail = ownerMember?.user_id
    ? await ownerEmailForUserId(ownerMember.user_id)
    : null;

  return {
    platform: "nail",
    id: nailSalon.id,
    name: nailSalon.name,
    subscription_status: nailSalon.subscription_status,
    subscription_required: nailSalon.subscription_required,
    payment_invite_token: nailSalon.payment_invite_token,
    stripe_billing_customer_id: nailSalon.stripe_billing_customer_id,
    owner_email: ownerEmail,
  };
}

export async function fetchBarberBillingState(shopId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("barber_shops")
    .select(
      "id, name, subscription_status, subscription_required, payment_invite_token, onboarding_welcome_sent_at"
    )
    .eq("id", shopId)
    .single();
  return data;
}

export async function fetchNailBillingState(salonId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("nail_salons")
    .select(
      "id, name, subscription_status, subscription_required, payment_invite_token, onboarding_welcome_sent_at"
    )
    .eq("id", salonId)
    .single();
  return data;
}
