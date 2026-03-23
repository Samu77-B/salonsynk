import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatFlatFee } from "@/config/subscription";
import { SettingsView } from "./settings-view";

function isMissingProcessingColumnError(error: { message?: string } | null | undefined) {
  const msg = error?.message?.toLowerCase() ?? "";
  return msg.includes("processing_time_minutes") && msg.includes("column");
}

export default async function SettingsPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const servicesPromise = (async () => {
    const withProcessing = await supabase
      .from("services")
      .select("id, name, duration_minutes, price_minor, processing_time_minutes")
      .eq("salon_id", context.salon.id)
      .order("name");
    if (!withProcessing.error) return withProcessing;
    if (!isMissingProcessingColumnError(withProcessing.error)) return withProcessing;
    return supabase
      .from("services")
      .select("id, name, duration_minutes, price_minor")
      .eq("salon_id", context.salon.id)
      .order("name");
  })();

  const [{ data: salon }, { data: member }, { data: services }] = await Promise.all([
    supabase
      .from("salons")
      .select("id, name, slug, stripe_connect_account_id, subscription_status, settings, tax_vault_minor")
      .eq("id", context.salon.id)
      .single(),
    supabase
      .from("salon_members")
      .select("employment_type, tax_vault_minor")
      .eq("id", context.member.id)
      .eq("salon_id", context.salon.id)
      .single(),
    servicesPromise,
  ]);

  const settings = (salon?.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const adminFeePercent = Number(settings.admin_fee_percent) || 10;
  const depositRequired = Boolean(settings.deposit_required);
  const depositType = (settings.deposit_type as "percent" | "flat") || "percent";
  const depositValue = Number(settings.deposit_value) ?? 20;
  const googleReviewUrl = String(settings.google_review_url ?? "");
  const weMissYouWeeksMin = Number(settings.we_miss_you_weeks_min) || 6;
  const weMissYouWeeksMax = Number(settings.we_miss_you_weeks_max) || 10;
  const weMissYouDiscountCode = String(settings.we_miss_you_discount_code ?? "");

  const isOwner = context.member.role === "owner";
  const employmentType = (member?.employment_type as string) ?? "EMPLOYEE";
  const showSalonTaxVault = isOwner;
  const showRenterTaxVault = !isOwner && employmentType === "RENTER";

  return (
    <main className="p-4 md:p-6 max-w-2xl min-w-0">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <SettingsView
        salonId={context.salon.id}
        salonName={salon?.name ?? context.salon.name}
        salonSlug={context.salon.slug}
        stripeConnectAccountId={salon?.stripe_connect_account_id ?? null}
        subscriptionStatus={salon?.subscription_status ?? "inactive"}
        formatFlatFee={formatFlatFee()}
        branding={{
          logo_url: branding.logo_url ?? "",
          primary_color: branding.primary_color ?? "",
          company_name: branding.company_name ?? "",
        }}
        showSalonTaxVault={showSalonTaxVault}
        salonTaxVaultMinor={showSalonTaxVault ? Number(salon?.tax_vault_minor ?? 0) : 0}
        showRenterTaxVault={showRenterTaxVault}
        renterTaxVaultMinor={showRenterTaxVault ? Number(member?.tax_vault_minor ?? 0) : 0}
        isOwner={isOwner}
        adminFeePercent={adminFeePercent}
        services={(services ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          duration_minutes: s.duration_minutes,
          price_minor: s.price_minor ?? 0,
          processing_time_minutes: s.processing_time_minutes ?? 0,
        }))}
        depositRequired={depositRequired}
        depositType={depositType}
        depositValue={depositValue}
        googleReviewUrl={googleReviewUrl}
        weMissYouWeeksMin={weMissYouWeeksMin}
        weMissYouWeeksMax={weMissYouWeeksMax}
        weMissYouDiscountCode={weMissYouDiscountCode}
      />
    </main>
  );
}
