import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { fetchClientLoyaltyBalance } from "@/lib/loyalty/process-sale";
import { parseLoyaltySettings, formatMoneyMinor } from "@/lib/loyalty/settings";
import { maxRedeemableProductPoints } from "@/lib/loyalty/calculate";

export async function GET(request: Request) {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const clientId = new URL(request.url).searchParams.get("clientId")?.trim();
  if (!clientId) return NextResponse.json({ enabled: false });

  const supabase = await createClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("settings")
    .eq("id", context.salon.id)
    .maybeSingle();

  const settings = parseLoyaltySettings((salon?.settings as Record<string, unknown>) ?? {});
  if (!settings.enabled) return NextResponse.json({ enabled: false });

  const balance = await fetchClientLoyaltyBalance(supabase, context.salon.id, clientId);
  if (!balance) return NextResponse.json({ enabled: true, enrolled: false });

  const maxProductRedeem = maxRedeemableProductPoints(balance, settings);

  return NextResponse.json({
    enabled: true,
    enrolled: true,
    servicePoints: balance.servicePoints,
    productPoints: balance.productPoints,
    settings: {
      servicePointValueMinor: settings.servicePointValueMinor,
      productPointsPerBlock: settings.productPointsPerBlock,
      productBlockValueMinor: settings.productBlockValueMinor,
      servicePointsPerGbp: settings.servicePointsPerGbp,
      productPointsPerGbp: settings.productPointsPerGbp,
    },
    redeemHints: {
      serviceValueLabel: formatMoneyMinor(settings.servicePointValueMinor),
      productBlockLabel: `${settings.productPointsPerBlock} pts = ${formatMoneyMinor(settings.productBlockValueMinor)}`,
      maxProductRedeem,
    },
  });
}
