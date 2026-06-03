import { NextResponse } from "next/server";
import { sendAccountRequest } from "@/lib/email";
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

    const result = await sendAccountRequest({
      fullName,
      email,
      salonName,
      phone,
      message,
      planTier,
      planLabel: PLAN_TIERS[planTier].label,
      planPrice: formatPlanPrice(planTier),
      paymentGateway,
      paymentGatewayLabel: PAYMENT_GATEWAYS[paymentGateway].label,
    });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
