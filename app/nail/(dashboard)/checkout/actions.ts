"use server";

import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { revalidatePath } from "next/cache";
import {
  externalPaymentReference,
  isPaymentGatewayId,
  salonUsesStripeCheckout,
  type PaymentGatewayId,
} from "@core/config/payment-gateways";

export async function getRelevantNailVisitServices(
  clientId: string,
  technicianId: string
): Promise<{ error: string | null; serviceIds: string[] }> {
  const context = await getCurrentUserNailSalon();
  if (!context) return { error: "Unauthorized", serviceIds: [] };

  if (!clientId.trim()) return { error: null, serviceIds: [] };

  const from = new Date();
  from.setDate(from.getDate() - 3);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + 2);
  to.setHours(23, 59, 59, 999);

  const supabase = await createClient();
  const preferred = technicianId || context.member.id;

  type Line = { service_id: string; sort_order: number };
  type AptRow = {
    id: string;
    start_time: string;
    technician_id: string;
    service_id: string | null;
    nail_appointment_services?: Line[] | null;
  };

  const withLines = await supabase
    .from("nail_appointments")
    .select("id, start_time, technician_id, service_id, nail_appointment_services(service_id, sort_order)")
    .eq("salon_id", context.salon.id)
    .eq("client_id", clientId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", from.toISOString())
    .lte("start_time", to.toISOString())
    .order("start_time", { ascending: false })
    .limit(30);

  let rows: AptRow[] = [];
  if (!withLines.error && withLines.data) {
    rows = withLines.data as AptRow[];
  } else {
    const minimal = await supabase
      .from("nail_appointments")
      .select("id, start_time, technician_id, service_id")
      .eq("salon_id", context.salon.id)
      .eq("client_id", clientId)
      .in("status", ["scheduled", "completed"])
      .gte("start_time", from.toISOString())
      .lte("start_time", to.toISOString())
      .order("start_time", { ascending: false })
      .limit(30);
    rows = (minimal.data ?? []) as AptRow[];
  }

  function serviceIdsFromAppointment(row: AptRow): string[] {
    const lines = row.nail_appointment_services?.filter((l) => l?.service_id) ?? [];
    if (lines.length > 0) {
      return [...lines].sort((a, b) => a.sort_order - b.sort_order).map((l) => l.service_id);
    }
    if (row.service_id) return [row.service_id];
    return [];
  }

  const stylistFirst = rows.filter((r) => r.technician_id === preferred);
  const pool = stylistFirst.length > 0 ? stylistFirst : rows;
  const apt =
    [...pool].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0] ?? null;

  if (!apt) return { error: null, serviceIds: [] };
  return { error: null, serviceIds: serviceIdsFromAppointment(apt) };
}

export async function recordNailCheckoutSale(payload: {
  salonId: string;
  clientId?: string;
  technicianId?: string;
  serviceIds?: string[];
  customAmountMinor?: number | null;
  terminalReference?: string;
}): Promise<{ error: string | null; amountMinor?: number }> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== payload.salonId) {
    return { error: "Unauthorized" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    admin = await createClient();
  }

  const { data: salon } = await admin
    .from("nail_salons")
    .select("payment_gateway")
    .eq("id", payload.salonId)
    .single();

  const gatewayRaw = (salon?.payment_gateway as string) ?? "stripe";
  const gateway: PaymentGatewayId = isPaymentGatewayId(gatewayRaw) ? gatewayRaw : "stripe";

  const memberId = payload.technicianId ?? context.member.id;
  const { data: technician } = await admin
    .from("nail_members")
    .select("id")
    .eq("id", memberId)
    .eq("salon_id", payload.salonId)
    .eq("is_active", true)
    .single();

  if (!technician) return { error: "Invalid technician" };

  const serviceIds = [...new Set((payload.serviceIds ?? []).filter(Boolean))];

  let amountMinor = 0;
  if (payload.customAmountMinor != null && payload.customAmountMinor >= 50) {
    amountMinor = Math.round(payload.customAmountMinor);
  } else if (serviceIds.length) {
    const { data: svc } = await admin
      .from("nail_services")
      .select("id, price_minor")
      .eq("salon_id", payload.salonId)
      .in("id", serviceIds);
    amountMinor = (svc ?? []).reduce((s, r) => s + Number(r.price_minor ?? 0), 0);
  }

  if (amountMinor < 50) {
    return { error: "Minimum amount is £0.50 — select services or enter a custom amount." };
  }

  const paymentRef = externalPaymentReference(gateway);
  const terminalRef =
    typeof payload.terminalReference === "string" ? payload.terminalReference.trim().slice(0, 120) : "";
  const syntheticId = terminalRef
    ? `${paymentRef}_${terminalRef.replace(/[^a-zA-Z0-9_-]/g, "")}`
    : paymentRef;

  const usesStripe = salonUsesStripeCheckout(gateway);

  const { error: insertError } = await admin.from("nail_sales_transactions").insert({
    salon_id: payload.salonId,
    technician_id: technician.id,
    client_id: payload.clientId?.trim() || null,
    stripe_payment_intent_id: usesStripe ? null : syntheticId.slice(0, 255),
    payment_gateway: gateway,
    payment_method: usesStripe ? "card" : "other",
    amount_minor: amountMinor,
    currency: "gbp",
    service_ids: serviceIds,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/nail/checkout");
  return { error: null, amountMinor };
}
