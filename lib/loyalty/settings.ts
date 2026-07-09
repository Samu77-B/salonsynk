export type LoyaltySettings = {
  enabled: boolean;
  /** Points earned per £1 spent on services (default 1). */
  servicePointsPerGbp: number;
  /** Points earned per £1 spent on products (default 2). */
  productPointsPerGbp: number;
  /** Pence discount per 1 service point redeemed (default 25). */
  servicePointValueMinor: number;
  /** Product points required per redemption block (default 2). */
  productPointsPerBlock: number;
  /** Pence discount per product block (default 25). */
  productBlockValueMinor: number;
};

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: false,
  servicePointsPerGbp: 1,
  productPointsPerGbp: 2,
  servicePointValueMinor: 25,
  productPointsPerBlock: 2,
  productBlockValueMinor: 25,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function parseLoyaltySettings(raw: Record<string, unknown> | null | undefined): LoyaltySettings {
  const loyalty = (raw?.loyalty as Record<string, unknown> | undefined) ?? {};
  return {
    enabled: Boolean(loyalty.enabled),
    servicePointsPerGbp: clampInt(loyalty.service_points_per_gbp, 0, 100, DEFAULT_LOYALTY_SETTINGS.servicePointsPerGbp),
    productPointsPerGbp: clampInt(loyalty.product_points_per_gbp, 0, 100, DEFAULT_LOYALTY_SETTINGS.productPointsPerGbp),
    servicePointValueMinor: clampInt(loyalty.service_point_value_minor, 1, 10_000, DEFAULT_LOYALTY_SETTINGS.servicePointValueMinor),
    productPointsPerBlock: clampInt(loyalty.product_points_per_block, 1, 100, DEFAULT_LOYALTY_SETTINGS.productPointsPerBlock),
    productBlockValueMinor: clampInt(loyalty.product_block_value_minor, 1, 10_000, DEFAULT_LOYALTY_SETTINGS.productBlockValueMinor),
  };
}

export function serializeLoyaltySettings(settings: LoyaltySettings): Record<string, unknown> {
  return {
    enabled: settings.enabled,
    service_points_per_gbp: settings.servicePointsPerGbp,
    product_points_per_gbp: settings.productPointsPerGbp,
    service_point_value_minor: settings.servicePointValueMinor,
    product_points_per_block: settings.productPointsPerBlock,
    product_block_value_minor: settings.productBlockValueMinor,
  };
}

export function formatMoneyMinor(minor: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
}
