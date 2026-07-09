import { Suspense } from "react";
import { requireSalonFeature } from "@/lib/salon-features.server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalonMembersAdaptiveSelect, memberShowsOnDiary } from "@/lib/show-on-diary";
import { isPaymentGatewayId, salonUsesStripeCheckout, type PaymentGatewayId } from "@/config/payment-gateways";
import { PAYMENT_GATEWAYS } from "@/config/payment-gateways";
import { DashboardPage, DashboardPageHeader } from "@/components/dashboard/page-layout";
import { CheckoutView } from "./checkout-view";
import { fetchSalonPlanState } from "@/lib/salon-features.server";
import { getEnabledFeatures } from "@/config/plans";
import { parseLoyaltySettings } from "@/lib/loyalty/settings";

export default async function CheckoutPage() {
  const { context } = await requireSalonFeature("checkout");

  const admin = createAdminClient();
  const { data: salonRow } = await admin
    .from("salons")
    .select("payment_gateway, settings")
    .eq("id", context.salon.id)
    .single();

  const rawGateway = (salonRow?.payment_gateway as string) ?? "stripe";
  const paymentGateway: PaymentGatewayId = isPaymentGatewayId(rawGateway) ? rawGateway : "stripe";
  const usesStripeCheckout = salonUsesStripeCheckout(paymentGateway);
  const gatewayMeta = PAYMENT_GATEWAYS[paymentGateway];

  const supabase = await createClient();
  const productsQuery = async () => {
    const withLinks = await supabase
      .from("products")
      .select("id, name, price_minor, product_services(service_id)")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true);
    if (!withLinks.error) return withLinks;
    return supabase
      .from("products")
      .select("id, name, price_minor")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true);
  };

  const [clientsRes, servicesRes, productsRes] = await Promise.all([
    supabase.from("clients").select("id, name, email").eq("salon_id", context.salon.id).order("name"),
    supabase.from("services").select("id, name, duration_minutes, price_minor").eq("salon_id", context.salon.id),
    productsQuery(),
  ]);

  type ProductRowRaw = {
    id: string;
    name: string;
    price_minor: number | null;
    product_services?: { service_id: string }[] | null;
  };

  const products =
    (productsRes.data ?? []).map((r) => {
      const row = r as ProductRowRaw;
      const linked =
        row.product_services?.map((x) => x.service_id).filter((id): id is string => typeof id === "string") ?? [];
      return {
        id: row.id,
        name: row.name,
        price_minor: row.price_minor ?? 0,
        linkedServiceIds: linked,
      };
    });

  const stylistsLoad = await fetchSalonMembersAdaptiveSelect(supabase, context.salon.id, [
    "id, display_name, employment_type, show_on_diary",
    "id, display_name, employment_type",
  ]);
  if (stylistsLoad.error) {
    console.error("[CheckoutPage] salon_members load failed:", stylistsLoad.error.message);
  }

  const stylists = (stylistsLoad.data as { id: string; display_name?: string | null; employment_type?: string | null; show_on_diary?: boolean | null }[])
    .filter((s) => memberShowsOnDiary(s as { show_on_diary?: boolean | null }))
    .map((s) => ({
    id: s.id,
    displayName: s.display_name ?? "Stylist",
    employmentType: (s.employment_type as string) || "EMPLOYEE",
  }));

  const defaultStylistId =
    stylists.some((s) => s.id === context.member.id)
      ? context.member.id
      : stylists[0]?.id ?? "";

  const planState = await fetchSalonPlanState(context.salon.id);
  const enabledFeatures = getEnabledFeatures(planState);
  const loyaltySettings = parseLoyaltySettings((salonRow?.settings as Record<string, unknown>) ?? {});
  const loyaltyEnabled = enabledFeatures.includes("targets_loyalty") && loyaltySettings.enabled;

  return (
    <DashboardPage width="wide">
      <DashboardPageHeader
        title="Checkout"
        description="Record a sale and take or log payment for today's services."
      />
      <Suspense fallback={<p className="text-sm text-muted">Loading checkout…</p>}>
        <CheckoutView
          salonId={context.salon.id}
          clients={clientsRes.data ?? []}
          services={servicesRes.data ?? []}
          products={products}
          stylists={stylists}
          defaultStylistId={defaultStylistId}
          paymentGateway={paymentGateway}
          paymentGatewayLabel={gatewayMeta.shortLabel}
          usesStripeCheckout={usesStripeCheckout}
          loyaltyEnabled={loyaltyEnabled}
          loyaltySettings={loyaltySettings}
        />
      </Suspense>
    </DashboardPage>
  );
}
