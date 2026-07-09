import type { LoyaltySettings } from "./settings";

export type LoyaltyBalances = {
  servicePoints: number;
  productPoints: number;
};

export type LoyaltyRedemptionInput = {
  redeemServicePoints: number;
  redeemProductPoints: number;
};

export type LoyaltyCheckoutTotals = {
  serviceLineMinor: number;
  productLineMinor: number;
  serviceDiscountMinor: number;
  productDiscountMinor: number;
  servicePaidMinor: number;
  productPaidMinor: number;
  totalMinor: number;
  redeemServicePoints: number;
  redeemProductPoints: number;
};

export function earnPointsFromSpend(
  settings: LoyaltySettings,
  servicePaidMinor: number,
  productPaidMinor: number
): { servicePoints: number; productPoints: number } {
  const servicePoints =
    Math.floor(Math.max(0, servicePaidMinor) / 100) * settings.servicePointsPerGbp;
  const productPoints =
    Math.floor(Math.max(0, productPaidMinor) / 100) * settings.productPointsPerGbp;
  return { servicePoints, productPoints };
}

export function maxRedeemableProductPoints(balances: LoyaltyBalances, settings: LoyaltySettings): number {
  const block = Math.max(1, settings.productPointsPerBlock);
  return Math.floor(Math.max(0, balances.productPoints) / block) * block;
}

export function productRedemptionDiscountMinor(
  redeemProductPoints: number,
  settings: LoyaltySettings
): number {
  const block = Math.max(1, settings.productPointsPerBlock);
  const blocks = Math.floor(Math.max(0, redeemProductPoints) / block);
  return blocks * settings.productBlockValueMinor;
}

export function serviceRedemptionDiscountMinor(
  redeemServicePoints: number,
  settings: LoyaltySettings
): number {
  return Math.max(0, redeemServicePoints) * settings.servicePointValueMinor;
}

export function computeLoyaltyCheckoutTotals(
  settings: LoyaltySettings,
  balances: LoyaltyBalances,
  serviceLineMinor: number,
  productLineMinor: number,
  redemption: LoyaltyRedemptionInput
): { totals: LoyaltyCheckoutTotals; error?: string } {
  let redeemServicePoints = Math.max(0, Math.floor(redemption.redeemServicePoints));
  let redeemProductPoints = Math.max(0, Math.floor(redemption.redeemProductPoints));

  redeemServicePoints = Math.min(redeemServicePoints, balances.servicePoints);
  redeemProductPoints = Math.min(redeemProductPoints, maxRedeemableProductPoints(balances, settings));

  const serviceDiscountMinor = Math.min(
    serviceLineMinor,
    serviceRedemptionDiscountMinor(redeemServicePoints, settings)
  );
  const productDiscountMinor = Math.min(
    productLineMinor,
    productRedemptionDiscountMinor(redeemProductPoints, settings)
  );

  const servicePaidMinor = Math.max(0, serviceLineMinor - serviceDiscountMinor);
  const productPaidMinor = Math.max(0, productLineMinor - productDiscountMinor);
  const totalMinor = servicePaidMinor + productPaidMinor;

  if (totalMinor > 0 && totalMinor < 50) {
    return { totals: emptyTotals(serviceLineMinor, productLineMinor), error: "Minimum amount after points is £0.50" };
  }

  if (redeemProductPoints > 0 && redeemProductPoints % Math.max(1, settings.productPointsPerBlock) !== 0) {
    return {
      totals: emptyTotals(serviceLineMinor, productLineMinor),
      error: `Product points must be redeemed in blocks of ${settings.productPointsPerBlock}`,
    };
  }

  return {
    totals: {
      serviceLineMinor,
      productLineMinor,
      serviceDiscountMinor,
      productDiscountMinor,
      servicePaidMinor,
      productPaidMinor,
      totalMinor,
      redeemServicePoints,
      redeemProductPoints,
    },
  };
}

function emptyTotals(serviceLineMinor: number, productLineMinor: number): LoyaltyCheckoutTotals {
  return {
    serviceLineMinor,
    productLineMinor,
    serviceDiscountMinor: 0,
    productDiscountMinor: 0,
    servicePaidMinor: serviceLineMinor,
    productPaidMinor: productLineMinor,
    totalMinor: serviceLineMinor + productLineMinor,
    redeemServicePoints: 0,
    redeemProductPoints: 0,
  };
}
