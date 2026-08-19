import { NextResponse } from "next/server";
import { sendAccountRequest, resolveLeadPlatform } from "@/lib/email";
import { BARBER_MONTHLY_GBP, NAIL_MONTHLY_GBP } from "@core/billing/platform-billing";
import { isPlanTierId, PLAN_TIERS, formatPlanPrice, type PlanTierId } from "@/config/plans";
import { isPaymentGatewayId, PAYMENT_GATEWAYS, type PaymentGatewayId } from "@/config/payment-gateways";

const MAX_LEN = { name: 200, email: 320, salon: 200, phone: 40, message: 4000 };

function trimStr(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fullName = trimStr(body.fullName, MAX_LEN.name);
    const email = trimStr(body.email, MAX_LEN.email);
    const salonName = trimStr(body.salonName, MAX_LEN.salon);
    const phone = trimStr(body.phone, MAX_LEN.phone) || undefined;
    const message = trimStr(body.message, MAX_LEN.message) || undefined;
    const rawPlan = trimStr(body.planTier, 32);
    const platform = resolveLeadPlatform({
      platform: trimStr(body.platform, 16),
      planTier: rawPlan,
      message,
      host: req.headers.get("x-forwarded-host") || req.headers.get("host") || "",
      referer: req.headers.get("referer") || "",
    });
    const planTier: PlanTierId = isPlanTierId(rawPlan) ? rawPlan : "professional";

    const rawGateway = trimStr(body.paymentGateway, 32);
    const paymentGateway = isPaymentGatewayId(rawGateway) ? rawGateway : "stripe";

    if (!fullName) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    if (!salonName) {
      return NextResponse.json({ error: "Salon or business name is required." }, { status: 400 });
    }

    const planLabel =
      platform === "barber"
        ? "BarberSynk"
        : platform === "nail"
          ? "NailSynk"
          : PLAN_TIERS[planTier].label;
    const planPrice =
      platform === "barber"
        ? `£${BARBER_MONTHLY_GBP}/mo`
        : platform === "nail"
          ? `£${NAIL_MONTHLY_GBP}/mo`
          : formatPlanPrice(planTier);
    const paymentGatewayLabel =
      platform === "barber" || platform === "nail"
        ? "Stripe"
        : PAYMENT_GATEWAYS[paymentGateway].label;

    const result = await sendAccountRequest({
      fullName,
      email,
      salonName,
      phone,
      message,
      planTier: platform === "barber" || platform === "nail" ? platform : planTier,
      planLabel,
      planPrice,
      paymentGateway,
      paymentGatewayLabel,
      platform,
    });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
