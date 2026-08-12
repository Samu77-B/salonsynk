import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { tenantRequiresPayment } from "@core/billing/platform-billing";
import { BARBER_SITE } from "@core/config/barber-site";
import { fetchPlatformStripeSubscriptionSummary } from "@core/billing/platform-stripe-subscription";
import { PlatformBillingAccountView } from "@/components/billing/platform-billing-account-view";

export default async function BarberBillingPage({
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
    const shopId = (await cookies()).get("admin_barber_shop_id")?.value;
    redirect(shopId ? "/barber/dashboard" : "/admin");
  }

  const context = await getCurrentUserShop();
  if (!context) redirect("/barber/access");

  const params = await searchParams;
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    redirect("/barber/access");
  }
  const { data: shopRow } = await admin
    .from("barber_shops")
    .select(
      "id, name, subscription_status, subscription_required, payment_invite_token, onboarding_welcome_sent_at, stripe_billing_customer_id"
    )
    .eq("id", context.shop.id)
    .single();

  if (!shopRow) redirect("/login");

  const isOwner = (context.member.role ?? "").toLowerCase() === "owner";
  const customerId = (shopRow.stripe_billing_customer_id as string | null) ?? null;
  const stripeSummary = isOwner
    ? await fetchPlatformStripeSubscriptionSummary("barber", customerId)
    : null;

  return (
    <PlatformBillingAccountView
      platform="barber"
      businessName={shopRow.name as string}
      isOwner={isOwner}
      needsPayment={tenantRequiresPayment(shopRow)}
      welcomeSentAt={(shopRow.onboarding_welcome_sent_at as string | null) ?? null}
      paymentInviteToken={(shopRow.payment_invite_token as string | null) ?? null}
      hasBillingCustomer={Boolean(customerId?.trim())}
      subscriptionStatus={(shopRow.subscription_status as string | null) ?? null}
      stripeSummary={stripeSummary}
      productBlurb="Live queue, appointments, and team tools for your shop."
      supportEmail={BARBER_SITE.email}
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
