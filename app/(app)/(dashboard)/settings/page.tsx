import { SettingsView } from "./settings-view";
import { SettingsNav } from "./settings-nav";
import { getSettingsData } from "./data";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const data = await getSettingsData();
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isManagerRole(isSuperAdmin, data.context.member.role ?? "")) redirect("/dashboard");

  return (
    <main className="mx-auto w-full min-w-0 max-w-2xl p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <SettingsNav current="general" />
      <SettingsView
        salonId={data.context.salon.id}
        salonName={data.salon?.name ?? data.context.salon.name}
        salonSlug={data.context.salon.slug}
        stripeConnectAccountId={data.salon?.stripe_connect_account_id ?? null}
        subscriptionStatus={data.salon?.subscription_status ?? "inactive"}
        planLabel={data.planLabel}
        planPriceLabel={data.planPriceLabel}
        branding={data.branding}
        showSalonTaxVault={data.showSalonTaxVault}
        salonTaxVaultMinor={data.salonTaxVaultMinor}
        showRenterTaxVault={data.showRenterTaxVault}
        renterTaxVaultMinor={data.renterTaxVaultMinor}
        isOwner={data.isOwner}
        adminFeePercent={data.adminFeePercent}
        depositRequired={data.depositRequired}
        depositType={data.depositType}
        depositValue={data.depositValue}
        reminderHours={data.reminderHours}
        googleReviewUrl={data.googleReviewUrl}
        weMissYouWeeksMin={data.weMissYouWeeksMin}
        weMissYouWeeksMax={data.weMissYouWeeksMax}
        weMissYouDiscountCode={data.weMissYouDiscountCode}
        subscriptionCheckoutAvailable={data.subscriptionCheckoutAvailable}
        hasBillingCustomer={data.hasBillingCustomer}
        enabledFeatures={data.enabledFeatures}
        paymentGateway={data.paymentGateway}
        paymentGatewayLabel={data.paymentGatewayLabel}
        usesStripeCheckout={data.usesStripeCheckout}
      />
    </main>
  );
}
