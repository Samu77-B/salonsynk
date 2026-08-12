import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { tenantRequiresPayment } from "@core/billing/platform-billing";
import { NAIL_SITE } from "@core/config/nail-site";
import { fetchPlatformStripeSubscriptionSummary } from "@core/billing/platform-stripe-subscription";
import { PlatformBillingAccountView } from "@/components/billing/platform-billing-account-view";

export default async function NailBillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    cancel?: string;
    already?: string;
    switched?: string;
    error?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (await getIsSuperAdmin()) {
    const salonId = (await cookies()).get("admin_nail_salon_id")?.value;
    redirect(salonId ? "/nail/queue" : "/admin");
  }

  const context = await getCurrentUserNailSalon();
  if (!context) redirect("/nail/onboarding");

  const params = await searchParams;
  const admin = createAdminClient();
  const { data: salonRow } = await admin
    .from("nail_salons")
    .select(
      "id, name, subscription_status, subscription_required, payment_invite_token, onboarding_welcome_sent_at, stripe_billing_customer_id"
    )
    .eq("id", context.salon.id)
    .single();

  if (!salonRow) redirect("/login");

  const isOwner = (context.member.role ?? "").toLowerCase() === "owner";
  const customerId = (salonRow.stripe_billing_customer_id as string | null) ?? null;
  const stripeSummary = isOwner
    ? await fetchPlatformStripeSubscriptionSummary("nail", customerId)
    : null;

  return (
    <PlatformBillingAccountView
      platform="nail"
      businessName={salonRow.name as string}
      isOwner={isOwner}
      needsPayment={tenantRequiresPayment(salonRow)}
      welcomeSentAt={(salonRow.onboarding_welcome_sent_at as string | null) ?? null}
      paymentInviteToken={(salonRow.payment_invite_token as string | null) ?? null}
      hasBillingCustomer={Boolean(customerId?.trim())}
      subscriptionStatus={(salonRow.subscription_status as string | null) ?? null}
      stripeSummary={stripeSummary}
      productBlurb="Live queue, diary, and client tools for your nail salon."
      supportEmail={NAIL_SITE.email}
      flash={{
        success: params.success,
        cancel: params.cancel,
        already: params.already,
        switched: params.switched,
        error: params.error,
      }}
    />
  );
}
