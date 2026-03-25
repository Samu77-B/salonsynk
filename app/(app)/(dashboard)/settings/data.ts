import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { redirect } from "next/navigation";
import { isMissingProcessingColumnError } from "@/lib/db/service-schema";

export async function getSettingsData() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const isSuperAdmin = await getIsSuperAdmin();
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
  const canManageServices = isOwner || isSuperAdmin;
  const employmentType = (member?.employment_type as string) ?? "EMPLOYEE";
  const showSalonTaxVault = isOwner;
  const showRenterTaxVault = !isOwner && employmentType === "RENTER";

  return {
    context,
    salon,
    member,
    services: (services ?? []).map((s) => {
      const row = s as {
        id: string;
        name: string;
        duration_minutes: number;
        price_minor: number | null;
        processing_time_minutes?: number | null;
      };
      return {
        id: row.id,
        name: row.name,
        duration_minutes: row.duration_minutes,
        price_minor: row.price_minor ?? 0,
        processing_time_minutes: row.processing_time_minutes ?? 0,
      };
    }),
    branding: {
      logo_url: branding.logo_url ?? "",
      primary_color: branding.primary_color ?? "",
      company_name: branding.company_name ?? "",
    },
    adminFeePercent,
    depositRequired,
    depositType,
    depositValue,
    googleReviewUrl,
    weMissYouWeeksMin,
    weMissYouWeeksMax,
    weMissYouDiscountCode,
    isOwner,
    canManageServices,
    showSalonTaxVault,
    showRenterTaxVault,
    salonTaxVaultMinor: showSalonTaxVault ? Number(salon?.tax_vault_minor ?? 0) : 0,
    renterTaxVaultMinor: showRenterTaxVault ? Number(member?.tax_vault_minor ?? 0) : 0,
  };
}
