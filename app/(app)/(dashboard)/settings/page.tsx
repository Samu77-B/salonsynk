import { formatFlatFee } from "@/config/subscription";
import { SettingsView } from "./settings-view";
import { SettingsNav } from "./settings-nav";
import { getSettingsData } from "./data";

export default async function SettingsPage() {
  const data = await getSettingsData();

  return (
    <main className="p-4 md:p-6 max-w-2xl min-w-0">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <SettingsNav current="general" />
      <SettingsView
        salonId={data.context.salon.id}
        salonName={data.salon?.name ?? data.context.salon.name}
        salonSlug={data.context.salon.slug}
        stripeConnectAccountId={data.salon?.stripe_connect_account_id ?? null}
        subscriptionStatus={data.salon?.subscription_status ?? "inactive"}
        formatFlatFee={formatFlatFee()}
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
        googleReviewUrl={data.googleReviewUrl}
        weMissYouWeeksMin={data.weMissYouWeeksMin}
        weMissYouWeeksMax={data.weMissYouWeeksMax}
        weMissYouDiscountCode={data.weMissYouDiscountCode}
      />
    </main>
  );
}
