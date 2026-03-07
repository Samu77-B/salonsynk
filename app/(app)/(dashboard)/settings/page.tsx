import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatFlatFee } from "@/config/subscription";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const [{ data: salon }, { data: member }] = await Promise.all([
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
  ]);

  const settings = (salon?.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const adminFeePercent = Number(settings.admin_fee_percent) || 10;

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
      />
    </main>
  );
}
