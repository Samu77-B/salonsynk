import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public diagnostic: which platform Stripe price env vars are present (booleans only).
 * Open while debugging Vercel env: /api/stripe/platform-prices-configured?platform=barber
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform");
  if (platform !== "barber" && platform !== "nail") {
    return NextResponse.json({ error: "platform must be barber or nail" }, { status: 400 });
  }

  const monthlyKey = platform === "barber" ? "STRIPE_PRICE_BARBER" : "STRIPE_PRICE_NAIL";
  const yearlyKey =
    platform === "barber" ? "STRIPE_PRICE_BARBER_YEARLY" : "STRIPE_PRICE_NAIL_YEARLY";
  const monthlyAlias =
    platform === "barber" ? "STRIPE_PRICE_BARBER_MONTHLY" : "STRIPE_PRICE_NAIL_MONTHLY";

  const monthlyRaw = (process.env[monthlyKey] ?? process.env[monthlyAlias] ?? "").trim();
  const yearlyRaw = (process.env[yearlyKey] ?? "").trim();

  return NextResponse.json({
    platform,
    monthlyKey,
    yearlyKey,
    monthlyConfigured: monthlyRaw.length > 0,
    yearlyConfigured: yearlyRaw.length > 0,
    monthlyLooksLikePriceId: monthlyRaw.startsWith("price_"),
    yearlyLooksLikePriceId: yearlyRaw.startsWith("price_"),
    // Length only — never return the secret value
    monthlyValueLength: monthlyRaw.length,
    yearlyValueLength: yearlyRaw.length,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    deploymentUrl: process.env.VERCEL_URL ?? null,
  });
}
