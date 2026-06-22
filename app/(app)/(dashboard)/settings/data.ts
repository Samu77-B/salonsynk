import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import {
  getStripePriceIdForTier,
  isPlanTierId,
  PLAN_TIERS,
  formatPlanPrice,
  getEnabledFeatures,
  type PlanTierId,
} from "@/config/plans";
import { fetchSalonPlanState } from "@/lib/salon-features.server";
import { isPaymentGatewayId, PAYMENT_GATEWAYS, salonUsesStripeCheckout } from "@/config/payment-gateways";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

const SERVICE_SELECT_ATTEMPTS = [
  "id, name, duration_minutes, price_minor, processing_time_minutes, description, color, category_id, sort_order",
  "id, name, duration_minutes, price_minor, processing_time_minutes, description, color, category_id",
  "id, name, duration_minutes, price_minor, processing_time_minutes, description, category_id",
  "id, name, duration_minutes, price_minor, processing_time_minutes, description, color",
  "id, name, duration_minutes, price_minor, processing_time_minutes, description",
  "id, name, duration_minutes, price_minor, processing_time_minutes",
  "id, name, duration_minutes, price_minor, description",
  "id, name, duration_minutes, price_minor",
] as const;

export type ServiceSchemaCapabilities = {
  hasColorColumn: boolean;
  hasCategoryColumn: boolean;
};

function selectListHasField(cols: string, field: string): boolean {
  return cols.split(",").map((c) => c.trim()).includes(field);
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes(column.toLowerCase()) && (msg.includes("does not exist") || msg.includes("schema cache"));
}

async function probeServiceColumn(
  supabase: SupabaseClient,
  salonId: string,
  column: string
): Promise<boolean> {
  const res = await supabase.from("services").select(column).eq("salon_id", salonId).limit(1);
  if (!res.error) return true;
  if (isMissingColumnError(res.error, column)) return false;
  // Transient/RLS errors — don't treat as missing column
  return true;
}

async function probeServiceSchema(
  supabase: SupabaseClient,
  salonId: string
): Promise<ServiceSchemaCapabilities> {
  const [hasColorColumn, hasCategoryColumn] = await Promise.all([
    probeServiceColumn(supabase, salonId, "color"),
    probeServiceColumn(supabase, salonId, "category_id"),
  ]);
  return { hasColorColumn, hasCategoryColumn };
}

async function fetchSalonServices(
  supabase: SupabaseClient,
  salonId: string
): Promise<{
  data: Record<string, unknown>[] | null;
  schema: ServiceSchemaCapabilities;
}> {
  const schema = await probeServiceSchema(supabase, salonId);

  for (const cols of SERVICE_SELECT_ATTEMPTS) {
    if (schema.hasColorColumn && !selectListHasField(cols, "color")) continue;
    if (!schema.hasColorColumn && selectListHasField(cols, "color")) continue;
    if (schema.hasCategoryColumn && !selectListHasField(cols, "category_id")) continue;
    if (!schema.hasCategoryColumn && selectListHasField(cols, "category_id")) continue;

    for (const orderBySortOrder of [true, false]) {
      let query = supabase.from("services").select(cols).eq("salon_id", salonId);
      if (orderBySortOrder) query = query.order("sort_order");
      const res = await query.order("name");
      if (!res.error) {
        const rows = (res.data ?? []) as unknown as Record<string, unknown>[];
        const sample = rows[0];
        const loadedSchema: ServiceSchemaCapabilities = {
          hasColorColumn: selectListHasField(cols, "color") && (!sample || "color" in sample),
          hasCategoryColumn: selectListHasField(cols, "category_id") && (!sample || "category_id" in sample),
        };
        return { data: rows, schema: loadedSchema };
      }
    }
  }
  const fallback = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_minor")
    .eq("salon_id", salonId)
    .order("name");
  return {
    data: (fallback.data ?? []) as unknown as Record<string, unknown>[],
    schema,
  };
}

export async function getSettingsData() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const isSuperAdmin = await getIsSuperAdmin();
  const supabase = await createClient();

  const servicesPromise = fetchSalonServices(supabase, context.salon.id);

  const categoriesPromise = supabase
    .from("service_categories")
    .select("id, name, sort_order")
    .eq("salon_id", context.salon.id)
    .order("sort_order")
    .order("name");

  const [{ data: salon }, { data: member }, servicesResult, { data: categories }] = await Promise.all([
    supabase
      .from("salons")
      .select(
        "id, name, slug, stripe_connect_account_id, stripe_billing_customer_id, subscription_status, plan_tier, settings, tax_vault_minor, payment_gateway"
      )
      .eq("id", context.salon.id)
      .single(),
    supabase
      .from("salon_members")
      .select("employment_type, tax_vault_minor")
      .eq("id", context.member.id)
      .eq("salon_id", context.salon.id)
      .single(),
    servicesPromise,
    categoriesPromise,
  ]);
  const services = servicesResult.data;
  const serviceSchema = servicesResult.schema;

  const settings = (salon?.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const adminFeePercent = Number(settings.admin_fee_percent) || 10;
  const depositRequired = Boolean(settings.deposit_required);
  const depositType = (settings.deposit_type as "percent" | "flat") || "percent";
  const depositValue = Number(settings.deposit_value) ?? 20;
  const reminderHours = Array.isArray(settings.reminder_hours)
    ? (settings.reminder_hours as number[]).filter((h) => [12, 24, 48].includes(h))
    : [24];
  const googleReviewUrl = String(settings.google_review_url ?? "");
  const weMissYouWeeksMin = Number(settings.we_miss_you_weeks_min) || 6;
  const weMissYouWeeksMax = Number(settings.we_miss_you_weeks_max) || 10;
  const weMissYouDiscountCode = String(settings.we_miss_you_discount_code ?? "");
  const isOwner = context.member.role === "owner";
  const canManageServices = isOwner || isSuperAdmin;
  const employmentType = (member?.employment_type as string) ?? "EMPLOYEE";
  const showSalonTaxVault = isOwner;
  const showRenterTaxVault = !isOwner && employmentType === "RENTER";

  const rawPlanTier = (salon as { plan_tier?: string } | null)?.plan_tier ?? "professional";
  const planTier: PlanTierId = isPlanTierId(rawPlanTier) ? rawPlanTier : "professional";
  const planLabel = PLAN_TIERS[planTier].label;
  const planPriceLabel = formatPlanPrice(planTier);
  const subscriptionCheckoutAvailable = Boolean(getStripePriceIdForTier(planTier));
  const hasBillingCustomer = Boolean(salon?.stripe_billing_customer_id?.trim());
  const planState = await fetchSalonPlanState(context.salon.id);
  const enabledFeatures = getEnabledFeatures(planState);

  const rawPaymentGateway = (salon as { payment_gateway?: string } | null)?.payment_gateway ?? "stripe";
  const paymentGateway = isPaymentGatewayId(rawPaymentGateway) ? rawPaymentGateway : "stripe";
  const paymentGatewayLabel = PAYMENT_GATEWAYS[paymentGateway].label;
  const usesStripeCheckout = salonUsesStripeCheckout(paymentGateway);

  return {
    context,
    salon,
    member,
    categories: (categories ?? []).map((c) => {
      const row = c as { id: string; name: string; sort_order: number };
      return { id: row.id, name: row.name, sort_order: row.sort_order ?? 0 };
    }),
    serviceSchema,
    services: (services ?? []).map((s) => {
      const row = s as {
        id: string;
        name: string;
        duration_minutes: number;
        price_minor: number | null;
        processing_time_minutes?: number | null;
        description?: string | null;
        color?: string | null;
        category_id?: string | null;
        sort_order?: number | null;
      };
      return {
        id: row.id,
        name: row.name,
        duration_minutes: row.duration_minutes,
        price_minor: row.price_minor ?? 0,
        processing_time_minutes: row.processing_time_minutes ?? 0,
        description: row.description ?? "",
        color: row.color ?? "",
        category_id: row.category_id ?? null,
        sort_order: row.sort_order ?? 0,
      };
    }),
    branding: {
      logo_url: branding.logo_url ?? "",
      primary_color: branding.primary_color ?? "",
      company_name: branding.company_name ?? "",
      booking_heading: branding.booking_heading ?? "",
    },
    adminFeePercent,
    depositRequired,
    depositType,
    depositValue,
    reminderHours,
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
    subscriptionCheckoutAvailable,
    hasBillingCustomer,
    planTier,
    planLabel,
    planPriceLabel,
    enabledFeatures,
    paymentGateway,
    paymentGatewayLabel,
    usesStripeCheckout,
  };
}
