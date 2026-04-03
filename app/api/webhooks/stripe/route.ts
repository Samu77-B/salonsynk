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
  const TAX_RESERVE_PERCENT = 20;

  type SubscriptionObject = { status?: string; metadata?: { salon_id?: string }; subscription?: string; customer?: string };
  type InvoiceObject = { subscription?: string; total_taxes?: Array<{ amount?: number }> };
  type PaymentIntentObject = {
    id: string;
    amount: number;
    currency?: string;
    created?: number;
    metadata?: {
      salon_id?: string;
      stylist_id?: string;
      client_id?: string;
      employment_type?: string;
      service_ids?: string;
      product_ids?: string;
    };
  };
  type CheckoutSessionObject = {
    id: string;
    amount_total?: number | null;
    payment_intent?: string | null;
    currency?: string | null;
    metadata?: {
      salon_id?: string;
      stylist_id?: string;
      client_id?: string;
      employment_type?: string;
      service_ids?: string;
      product_ids?: string;
    } | null;
  };
  let event: {
    type: string;
    data?: { object?: SubscriptionObject & InvoiceObject & PaymentIntentObject & CheckoutSessionObject };
  };
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret) as typeof event;
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Tax Vault: on successful payment, add 20% tax reserve to salon (EMPLOYEE) or stylist (RENTER).
  async function applyTaxVault(
    amountMinor: number,
    employmentType: string | undefined,
    salonId: string | undefined,
    stylistId: string | undefined
  ): Promise<void> {
    if (!salonId || !employmentType) return;
    const taxReserve = Math.round((amountMinor * TAX_RESERVE_PERCENT) / 100);
    if (taxReserve <= 0) return;
    try {
      if (employmentType === "EMPLOYEE") {
        const { data } = await supabase.from("salons").select("tax_vault_minor").eq("id", salonId).single();
        const current = Number(data?.tax_vault_minor ?? 0);
        await supabase.from("salons").update({ tax_vault_minor: current + taxReserve }).eq("id", salonId);
      } else if (employmentType === "RENTER" && stylistId) {
        const { data } = await supabase
          .from("salon_members")
          .select("tax_vault_minor")
          .eq("id", stylistId)
          .eq("salon_id", salonId)
          .single();
        const current = Number(data?.tax_vault_minor ?? 0);
        await supabase
          .from("salon_members")
          .update({ tax_vault_minor: current + taxReserve })
          .eq("id", stylistId)
          .eq("salon_id", salonId);
      }
    } catch (err) {
      console.error("Tax Vault update failed", err);
    }
  }

  async function upsertSalesTransaction(args: {
    paymentIntentId: string;
    amountMinor: number;
    currency?: string | null;
    paidAt?: Date;
    metadata?: {
      salon_id?: string;
      stylist_id?: string;
      client_id?: string;
      employment_type?: string;
      service_ids?: string;
      product_ids?: string;
    } | null;
  }): Promise<void> {
    const { paymentIntentId, amountMinor, currency, paidAt, metadata } = args;
    const salonId = metadata?.salon_id;
    if (!paymentIntentId || !salonId || amountMinor <= 0) return;
    const stylistId = metadata?.stylist_id?.trim() || null;
    const clientId = metadata?.client_id?.trim() || null;
    const serviceIds = (metadata?.service_ids ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const productIds = (metadata?.product_ids ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    await supabase.from("sales_transactions").upsert(
      {
        salon_id: salonId,
        stylist_id: stylistId,
        client_id: clientId,
        stripe_payment_intent_id: paymentIntentId,
        amount_minor: amountMinor,
        currency: (currency ?? "gbp").toLowerCase(),
        employment_type: metadata?.employment_type ?? null,
        service_ids: serviceIds,
        product_ids: productIds,
        paid_at: (paidAt ?? new Date()).toISOString(),
      },
      { onConflict: "stripe_payment_intent_id" }
    );
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data?.object as PaymentIntentObject | undefined;
    const amount = pi?.amount ?? 0;
    const employmentType = pi?.metadata?.employment_type;
    const salonId = pi?.metadata?.salon_id;
    const stylistId = pi?.metadata?.stylist_id;
    if (amount > 0 && employmentType && salonId) {
      await applyTaxVault(amount, employmentType, salonId, stylistId);
    }
    if (pi?.id && amount > 0) {
      await upsertSalesTransaction({
        paymentIntentId: pi.id,
        amountMinor: amount,
        currency: pi.currency,
        paidAt: pi.created ? new Date(pi.created * 1000) : undefined,
        metadata: pi.metadata,
      });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object as CheckoutSessionObject | undefined;
    const amountTotal = session?.amount_total ?? 0;
    const metadata = session?.metadata ?? {};
    const employmentType = metadata.employment_type;
    const salonId = metadata.salon_id;
    const stylistId = metadata.stylist_id;
    if (amountTotal > 0 && employmentType && salonId) {
      await applyTaxVault(amountTotal, employmentType, salonId, stylistId);
    }
    const paymentIntentId = session?.payment_intent ?? "";
    if (paymentIntentId && amountTotal > 0) {
      await upsertSalesTransaction({
        paymentIntentId,
        amountMinor: amountTotal,
        currency: session?.currency ?? "gbp",
        metadata,
      });
    }
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const sub = event.data?.object as SubscriptionObject | undefined;
    const status = sub?.status === "active" ? "active" : sub?.status === "past_due" ? "past_due" : "inactive";
    const salonId = sub?.metadata?.salon_id;
    if (salonId) {
      await supabase.from("salons").update({ subscription_status: status }).eq("id", salonId);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data?.object as SubscriptionObject | undefined;
    const salonId = sub?.metadata?.salon_id;
    if (salonId) {
      await supabase.from("salons").update({ subscription_status: "canceled" }).eq("id", salonId);
    }
  }

  // Tax Vault: when a subscription invoice is paid, add the invoice tax to the salon's tax vault.
  if (event.type === "invoice.paid") {
    const invoice = event.data?.object as InvoiceObject | undefined;
    const subscriptionId = invoice?.subscription;
    const taxMinor = Array.isArray(invoice?.total_taxes)
      ? invoice.total_taxes.reduce((sum, t) => sum + (typeof t?.amount === "number" ? t.amount : 0), 0)
      : 0;
    if (subscriptionId && taxMinor > 0) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
        const salonId = (subscription.metadata as { salon_id?: string } | null)?.salon_id;
        if (salonId) {
          const { data: salon } = await supabase.from("salons").select("tax_vault_minor").eq("id", salonId).single();
          const currentVault = Number(salon?.tax_vault_minor ?? 0);
          await supabase.from("salons").update({ tax_vault_minor: currentVault + taxMinor }).eq("id", salonId);
        }
      } catch (err) {
        console.error("Tax Vault: failed to update from invoice.paid", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
