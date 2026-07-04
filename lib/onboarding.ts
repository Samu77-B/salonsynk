import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanTierId } from "@/config/plans";
import { isPlanTierId } from "@/config/plans";
import { SITE } from "@core/config/site";

export type SalonOnboardingRow = {
  id: string;
  name: string;
  slug: string;
  plan_tier?: string | null;
  subscription_status?: string | null;
  subscription_required?: boolean | null;
  payment_invite_token?: string | null;
  onboarding_welcome_sent_at?: string | null;
  onboarding_setup_email_sent_at?: string | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export function salonSubscriptionIsActive(status: string | null | undefined): boolean {
  return ACTIVE_SUBSCRIPTION_STATUSES.has((status ?? "").toLowerCase());
}

export function salonRequiresPayment(row: SalonOnboardingRow): boolean {
  if (!row.subscription_required) return false;
  return !salonSubscriptionIsActive(row.subscription_status);
}

export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    SITE.url
  ).replace(/\/$/, "");
}

export function paymentInviteUrl(token: string): string {
  return `${getAppBaseUrl()}/api/stripe/subscribe-invite?token=${encodeURIComponent(token)}`;
}

export async function fetchSalonByPaymentToken(
  token: string
): Promise<(SalonOnboardingRow & { owner_email: string | null }) | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const admin = createAdminClient();
  const { data: salon } = await admin
    .from("salons")
    .select(
      "id, name, slug, plan_tier, subscription_status, subscription_required, payment_invite_token, stripe_billing_customer_id"
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

  let ownerEmail: string | null = null;
  if (ownerMember?.user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", ownerMember.user_id)
      .single();
    ownerEmail = (profile?.email as string | null) ?? null;
  }

  return {
    ...(salon as SalonOnboardingRow),
    owner_email: ownerEmail,
  };
}

export async function fetchSalonOnboardingState(
  salonId: string
): Promise<SalonOnboardingRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("salons")
    .select(
      "id, name, slug, plan_tier, subscription_status, subscription_required, payment_invite_token, onboarding_welcome_sent_at, onboarding_setup_email_sent_at"
    )
    .eq("id", salonId)
    .single();
  return (data as SalonOnboardingRow | null) ?? null;
}

export function parsePlanTier(raw: string | null | undefined): PlanTierId {
  const tier = raw ?? "professional";
  return isPlanTierId(tier) ? tier : "professional";
}

export function generatePaymentInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}
