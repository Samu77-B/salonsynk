import type { SupabaseClient } from "@supabase/supabase-js";
import { computeLoyaltyCheckoutTotals } from "./calculate";
import { parseLoyaltySettings } from "./settings";
import { fetchClientLoyaltyBalance } from "./process-sale";
import { resolveRetailLines } from "@/lib/product-stock";

export type CheckoutLineInput = {
  serviceIds: string[];
  productIds: string[];
  variantIds?: string[];
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
): Promise<{
  serviceSum: number;
  productSum: number;
  allowedServiceIds: string[];
  allowedProductIds: string[];
  allowedVariantIds: string[];
  error?: string;
}> {
  const serviceIds = [...new Set(input.serviceIds.filter(Boolean))];

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

  const retail = await resolveRetailLines(db, salonId, {
    productIds: input.productIds ?? [],
    variantIds: input.variantIds ?? [],
  });
  if (retail.error) {
    return {
      serviceSum,
      productSum: 0,
      allowedServiceIds,
      allowedProductIds: [],
      allowedVariantIds: [],
      error: retail.error,
    };
  }

  return {
    serviceSum,
    productSum: retail.productSum,
    allowedServiceIds,
    allowedProductIds: retail.allowedProductIds,
    allowedVariantIds: retail.allowedVariantIds,
  };
}

export async function resolveCheckoutAmounts(
  db: SupabaseClient,
  salonId: string,
  clientId: string | null | undefined,
  input: CheckoutLineInput
): Promise<{ amounts: ResolvedCheckoutAmounts; error?: string }> {
  const lines = await resolveCheckoutLineTotals(db, salonId, input);
  if (lines.error) return { amounts: emptyAmounts(lines), error: lines.error };
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
