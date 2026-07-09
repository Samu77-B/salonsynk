import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
import { parseLoyaltySettings } from "@/lib/loyalty/settings";
import { redirect } from "next/navigation";

const SERVICE_SELECT_ATTEMPTS = [
  "id, name, duration_minutes, price_minor, processing_time_minutes, description, color, category_id",
  "id, name, duration_minutes, price_minor, color, category_id",
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

function getOptionalAdminClient() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

async function enrichServicesWithColorAndCategory(
  salonId: string,
  rows: Record<string, unknown>[]
): Promise<{ rows: Record<string, unknown>[]; enriched: boolean }> {
  const supabase = await createClient();
  const admin = getOptionalAdminClient();
  const clients = admin ? [admin, supabase] : [supabase];

  for (const db of clients) {
    const res = await db
      .from("services")
      .select("id, color, category_id")
      .eq("salon_id", salonId);
    if (res.error || !res.data) continue;

    const byId = new Map(
      res.data.map((row) => {
        const r = row as { id: string; color?: string | null; category_id?: string | null };
        return [r.id, r] as const;
      })
    );

    return {
      enriched: true,
      rows: rows.map((row) => {
        const extra = byId.get(row.id as string);
        if (!extra) return row;
        return {
          ...row,
          color: extra.color ?? null,
          category_id: extra.category_id ?? null,
        };
      }),
    };
  }

  return { rows, enriched: false };
}

async function fetchSalonServices(
  salonId: string
): Promise<{
  data: Record<string, unknown>[] | null;
  schema: ServiceSchemaCapabilities;
}> {
  const supabase = await createClient();
  const admin = getOptionalAdminClient();
  const dbs = admin ? [admin, supabase] : [supabase];

  for (const db of dbs) {
    for (const cols of SERVICE_SELECT_ATTEMPTS) {
      for (const orderBySortOrder of [false, true]) {
        let query = db.from("services").select(cols).eq("salon_id", salonId);
        if (orderBySortOrder && selectListHasField(cols, "sort_order")) {
          query = query.order("sort_order");
        }
        const res = await query.order("name");
        if (!res.error) {
          let rows = (res.data ?? []) as unknown as Record<string, unknown>[];
          let hasColor = selectListHasField(cols, "color");
          let hasCategory = selectListHasField(cols, "category_id");

          if (!hasColor || !hasCategory) {
            const enriched = await enrichServicesWithColorAndCategory(salonId, rows);
            rows = enriched.rows;
            if (enriched.enriched) {
              hasColor = true;
              hasCategory = true;
            }
          }

          return {
            data: rows,
            schema: { hasColorColumn: hasColor, hasCategoryColumn: hasCategory },
          };
        }
      }
    }
  }

  const fallbackDb = admin ?? supabase;
  const fallback = await fallbackDb
    .from("services")
    .select("id, name, duration_minutes, price_minor")
    .eq("salon_id", salonId)
    .order("name");

  const baseRows = (fallback.data ?? []) as unknown as Record<string, unknown>[];
  const enriched = await enrichServicesWithColorAndCategory(salonId, baseRows);

  return {
    data: enriched.rows,
    schema: {
      hasColorColumn: enriched.enriched,
      hasCategoryColumn: enriched.enriched,
    },
  };
}

export async function getSettingsData() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const isSuperAdmin = await getIsSuperAdmin();
  const supabase = await createClient();

  const servicesPromise = fetchSalonServices(context.salon.id);

  const categoriesPromise = (async () => {
    const withColor = await supabase
      .from("service_categories")
      .select("id, name, sort_order, color")
      .eq("salon_id", context.salon.id)
      .order("sort_order")
      .order("name");
    if (!withColor.error) return withColor;
    return supabase
      .from("service_categories")
      .select("id, name, sort_order")
      .eq("salon_id", context.salon.id)
      .order("sort_order")
      .order("name");
  })();

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
  const loyaltySettings = parseLoyaltySettings(settings);
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
      const row = c as { id: string; name: string; sort_order: number; color?: string | null };
      return { id: row.id, name: row.name, sort_order: row.sort_order ?? 0, color: row.color ?? "" };
    }),
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
    loyaltySettings,
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
