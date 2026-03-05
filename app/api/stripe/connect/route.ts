import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const salonId = url.searchParams.get("salonId");
  if (!salonId) return NextResponse.json({ error: "salonId required" }, { status: 400 });

  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("stripe_connect_account_id")
    .eq("id", salonId)
    .single();

  const redirectUri = `${url.origin}/api/stripe/connect/callback`;
  const refreshUrl = `${url.origin}/settings?refresh=true`;
  const returnUrl = `${url.origin}/settings?connected=true`;

  try {
    const stripe = getStripe();
    let accountId = salon?.stripe_connect_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
      });
      accountId = account.id;
      await supabase.from("salons").update({ stripe_connect_account_id: accountId }).eq("id", salonId);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.redirect(link.url);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
