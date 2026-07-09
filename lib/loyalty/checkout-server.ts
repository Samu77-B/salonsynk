import type { SupabaseClient } from "@supabase/supabase-js";
import { computeLoyaltyCheckoutTotals } from "./calculate";
import { parseLoyaltySettings } from "./settings";
import { fetchClientLoyaltyBalance } from "./process-sale";

export type CheckoutLineInput = {
  serviceIds: string[];
  productIds: string[];
  customAmountMinor?: number | null;
  redeemServicePoints?: number;
  redeemProductPoints?: number;
};

export type ResolvedCheckoutAmounts = {
  amountMinor: number;
  serviceLineMinor: number;
  productLineMinor: number;
  servicePaidMinor: number;
  productPaidMinor: number;
  redeemServicePoints: number;
  redeemProductPoints: number;
  loyaltyApplied: boolean;
};

export async function resolveCheckoutLineTotals(
  db: SupabaseClient,
  salonId: string,
  input: CheckoutLineInput
): Promise<{ serviceSum: number; productSum: number; allowedServiceIds: string[]; allowedProductIds: string[] }> {
  const serviceIds = [...new Set(input.serviceIds.filter(Boolean))];
  const productIds = [...new Set(input.productIds.filter(Boolean))];

  let serviceSum = 0;
  const allowedServiceIds: string[] = [];
  if (serviceIds.length > 0) {
    const { data: svcRows } = await db
      .from("services")
      .select("id, price_minor")
      .eq("salon_id", salonId)
      .in("id", serviceIds);
    for (const s of svcRows ?? []) {
      allowedServiceIds.push(s.id);
      serviceSum += Number(s.price_minor ?? 0);
    }
  }

  let productSum = 0;
  const allowedProductIds: string[] = [];
  if (productIds.length > 0) {
    const { data: prodRows } = await db
      .from("products")
      .select("id, price_minor")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .in("id", productIds);
    for (const p of prodRows ?? []) {
      allowedProductIds.push(p.id);
      productSum += Number(p.price_minor ?? 0);
    }
  }

  return { serviceSum, productSum, allowedServiceIds, allowedProductIds };
}

export async function resolveCheckoutAmounts(
  db: SupabaseClient,
  salonId: string,
  clientId: string | null | undefined,
  input: CheckoutLineInput
): Promise<{ amounts: ResolvedCheckoutAmounts; error?: string }> {
  const lines = await resolveCheckoutLineTotals(db, salonId, input);
  const lineTotalMinor = lines.serviceSum + lines.productSum;

  const useCustom =
    typeof input.customAmountMinor === "number" &&
    !Number.isNaN(input.customAmountMinor) &&
    input.customAmountMinor >= 50;

  if (useCustom) {
    return {
      amounts: {
        amountMinor: Math.round(input.customAmountMinor!),
        serviceLineMinor: lines.serviceSum,
        productLineMinor: lines.productSum,
        servicePaidMinor: 0,
        productPaidMinor: 0,
        redeemServicePoints: 0,
        redeemProductPoints: 0,
        loyaltyApplied: false,
      },
    };
  }

  const { data: salon } = await db.from("salons").select("settings").eq("id", salonId).maybeSingle();
  const loyaltySettings = parseLoyaltySettings((salon?.settings as Record<string, unknown>) ?? {});
  const canUseLoyalty = loyaltySettings.enabled && Boolean(clientId?.trim());

  if (!canUseLoyalty) {
    return {
      amounts: {
        amountMinor: lineTotalMinor,
        serviceLineMinor: lines.serviceSum,
        productLineMinor: lines.productSum,
        servicePaidMinor: lines.serviceSum,
        productPaidMinor: lines.productSum,
        redeemServicePoints: 0,
        redeemProductPoints: 0,
        loyaltyApplied: false,
      },
    };
  }

  const balance = await fetchClientLoyaltyBalance(db, salonId, clientId!.trim());
  const balances = {
    servicePoints: balance?.servicePoints ?? 0,
    productPoints: balance?.productPoints ?? 0,
  };

  const { totals, error } = computeLoyaltyCheckoutTotals(
    loyaltySettings,
    balances,
    lines.serviceSum,
    lines.productSum,
    {
      redeemServicePoints: input.redeemServicePoints ?? 0,
      redeemProductPoints: input.redeemProductPoints ?? 0,
    }
  );

  if (error) return { amounts: emptyAmounts(lines), error };

  return {
    amounts: {
      amountMinor: totals.totalMinor,
      serviceLineMinor: totals.serviceLineMinor,
      productLineMinor: totals.productLineMinor,
      servicePaidMinor: totals.servicePaidMinor,
      productPaidMinor: totals.productPaidMinor,
      redeemServicePoints: totals.redeemServicePoints,
      redeemProductPoints: totals.redeemProductPoints,
      loyaltyApplied: totals.redeemServicePoints > 0 || totals.redeemProductPoints > 0,
    },
  };
}

function emptyAmounts(lines: { serviceSum: number; productSum: number }): ResolvedCheckoutAmounts {
  return {
    amountMinor: lines.serviceSum + lines.productSum,
    serviceLineMinor: lines.serviceSum,
    productLineMinor: lines.productSum,
    servicePaidMinor: lines.serviceSum,
    productPaidMinor: lines.productSum,
    redeemServicePoints: 0,
    redeemProductPoints: 0,
    loyaltyApplied: false,
  };
}

export function loyaltyMetadata(amounts: ResolvedCheckoutAmounts): Record<string, string> {
  return {
    loyalty_redeem_service_pts: String(amounts.redeemServicePoints),
    loyalty_redeem_product_pts: String(amounts.redeemProductPoints),
    loyalty_service_paid_minor: String(amounts.servicePaidMinor),
    loyalty_product_paid_minor: String(amounts.productPaidMinor),
  };
}
