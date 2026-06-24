import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { memberShowsOnDiary } from "@/lib/show-on-diary";
import {
  isPaymentGatewayId,
  salonUsesStripeCheckout,
  PAYMENT_GATEWAYS,
  type PaymentGatewayId,
} from "@core/config/payment-gateways";
import { NailCheckoutView } from "./checkout-view";

export default async function NailCheckoutPage() {
  const context = await getCurrentUserNailSalon();
  if (!context) redirect("/nail/login");

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    admin = await createClient();
  }

  const { data: salonRow } = await admin
    .from("nail_salons")
    .select("payment_gateway")
    .eq("id", context.salon.id)
    .single();

  const rawGateway = (salonRow?.payment_gateway as string) ?? "stripe";
  const paymentGateway: PaymentGatewayId = isPaymentGatewayId(rawGateway) ? rawGateway : "stripe";
  const usesStripeCheckout = salonUsesStripeCheckout(paymentGateway);
  const gatewayMeta = PAYMENT_GATEWAYS[paymentGateway];

  const supabase = await createClient();

  const [clientsRes, servicesRes, membersRes] = await Promise.all([
    supabase.from("nail_clients").select("id, name, email").eq("salon_id", context.salon.id).order("name"),
    supabase
      .from("nail_services")
      .select("id, name, duration_minutes, price_minor")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("nail_members")
      .select("id, display_name, employment_type, show_on_diary")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("role", { ascending: false }),
  ]);

  const technicians = (membersRes.data ?? [])
    .filter((m) => memberShowsOnDiary(m as { show_on_diary?: boolean | null }))
    .map((m) => ({
      id: m.id,
      displayName: (m as { display_name?: string | null }).display_name ?? "Technician",
      employmentType: ((m as { employment_type?: string | null }).employment_type as string) || "EMPLOYEE",
    }));

  const defaultTechnicianId =
    technicians.some((t) => t.id === context.member.id) ? context.member.id : technicians[0]?.id ?? "";

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading checkout…</p>}>
        <NailCheckoutView
          salonId={context.salon.id}
          clients={clientsRes.data ?? []}
          services={servicesRes.data ?? []}
          technicians={technicians}
          defaultTechnicianId={defaultTechnicianId}
          paymentGateway={paymentGateway}
          paymentGatewayLabel={gatewayMeta.shortLabel}
          usesStripeCheckout={usesStripeCheckout}
        />
      </Suspense>
    </>
  );
}
