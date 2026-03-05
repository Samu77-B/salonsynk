import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@supabase/supabase-js";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  if (!webhookSecret?.trim()) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const stripe = getStripe();
  let event: { type: string; data?: { object?: { status?: string; metadata?: { salon_id?: string }; subscription?: string; customer?: string } } };
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret) as typeof event;
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const sub = event.data?.object;
    const status = sub?.status === "active" ? "active" : sub?.status === "past_due" ? "past_due" : "inactive";
    const salonId = sub?.metadata?.salon_id;
    if (salonId) {
      await supabase.from("salons").update({ subscription_status: status }).eq("id", salonId);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data?.object;
    const salonId = sub?.metadata?.salon_id;
    if (salonId) {
      await supabase.from("salons").update({ subscription_status: "canceled" }).eq("id", salonId);
    }
  }

  return NextResponse.json({ received: true });
}
