export type ServiceLineBillInput = {
  serviceId: string;
  serviceName: string;
  catalogPriceMinor: number;
  priceOverrideMinor?: number | null;
  assignedStylistId?: string | null;
  assignedStylistName?: string | null;
};

export function linePriceMinor(line: ServiceLineBillInput): number {
  if (line.priceOverrideMinor != null && Number.isFinite(line.priceOverrideMinor)) {
    return Math.max(0, line.priceOverrideMinor);
  }
  return Math.max(0, line.catalogPriceMinor);
}

export function computeBillSubtotalMinor(lines: ServiceLineBillInput[]): number {
  return lines.reduce((sum, line) => sum + linePriceMinor(line), 0);
}

export function computeBillTotalMinor(
  lines: ServiceLineBillInput[],
  billTotalOverrideMinor?: number | null,
  changeChargeMinor?: number | null
): number {
  if (billTotalOverrideMinor != null && Number.isFinite(billTotalOverrideMinor)) {
    return Math.max(0, billTotalOverrideMinor);
  }
  const subtotal = computeBillSubtotalMinor(lines);
  const change = changeChargeMinor != null && Number.isFinite(changeChargeMinor) ? changeChargeMinor : 0;
  return Math.max(0, subtotal + change);
}

export function computeBalanceDueMinor(params: {
  billTotalMinor: number;
  depositAmountMinor?: number | null;
  paidSalesMinor?: number;
}): number {
  const deposit = params.depositAmountMinor != null && Number.isFinite(params.depositAmountMinor)
    ? params.depositAmountMinor
    : 0;
  const paid = params.paidSalesMinor ?? 0;
  return Math.max(0, params.billTotalMinor - deposit - paid);
}

export function formatMoneyMinor(minor: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function parsePoundsToMinor(value: string): number | null {
  const trimmed = value.trim().replace(/£/g, "");
  if (!trimmed) return null;
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}
