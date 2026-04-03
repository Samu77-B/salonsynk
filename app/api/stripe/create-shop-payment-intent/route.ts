import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

/**
 * Public checkout for retail products on the salon shop (no staff session).
 * Payment routes to the salon Connect account (employee-style split).
 */
export async function POST(request: Request) {
  let body: { slug?: string; productIds?: string[]; clientEmail?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const rawIds = Array.isArray(body.productIds) ? body.productIds : [];
  const productIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.length > 0))];

  if (!slug || productIds.length === 0) {
    return NextResponse.json({ error: "Missing slug or productIds" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: salon } = await admin
    .from("salons")
    .select("id, stripe_connect_account_id")
    .eq("slug", slug)
    .single();

  if (!salon?.stripe_connect_account_id) {
    return NextResponse.json({ error: "This salon is not ready for online payments" }, { status: 400 });
  }

  const { data: products } = await admin
    .from("products")
    .select("id, price_minor")
    .eq("salon_id", salon.id)
    .eq("is_active", true)
    .in("id", productIds);

  const matched = products ?? [];
  if (matched.length !== productIds.length) {
    return NextResponse.json({ error: "Invalid product selection" }, { status: 400 });
  }

  const amountMinor = matched.reduce((sum, p) => sum + Number(p.price_minor ?? 0), 0);
  if (amountMinor < 50) {
    return NextResponse.json({ error: "Order total must be at least £0.50" }, { status: 400 });
  }

  let clientId = "";
  const email = typeof body.clientEmail === "string" ? body.clientEmail.trim().toLowerCase() : "";
  if (email) {
    const { data: client } = await admin
      .from("clients")
      .select("id")
      .eq("salon_id", salon.id)
      .ilike("email", email)
      .maybeSingle();
    if (client?.id) clientId = client.id;
  }

  const { data: memberRow } = await admin
    .from("salon_members")
    .select("id")
    .eq("salon_id", salon.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const stylistId = memberRow?.id ?? "";

  try {
    const stripe = getStripe();
    const metadata: Record<string, string> = {
      salon_id: salon.id,
      client_id: clientId,
      employment_type: "EMPLOYEE",
      stylist_id: stylistId,
      silent_appointment: "false",
      service_ids: "",
      product_ids: productIds.join(",").slice(0, 450),
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountMinor,
      currency: "gbp",
      transfer_data: { destination: salon.stripe_connect_account_id },
      metadata,
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, amountMinor });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
