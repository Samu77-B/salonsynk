import type { BillingPlatform } from "@core/billing/platform-billing";

export function stripeMetadataForTenant(
  platform: BillingPlatform,
  tenantId: string,
  extra?: Record<string, string>
): Record<string, string> {
  if (platform === "barber") {
    return { platform: "barber", shop_id: tenantId, ...extra };
  }
  if (platform === "nail") {
    return { platform: "nail", nail_salon_id: tenantId, ...extra };
  }
  return { salon_id: tenantId, ...extra };
}

export function resolveTenantFromStripeMetadata(metadata?: Record<string, string> | null): {
  platform: BillingPlatform;
  tenantId: string;
} | null {
  if (!metadata) return null;
  const platform = metadata.platform as BillingPlatform | undefined;
  if (platform === "barber" && metadata.shop_id) {
    return { platform: "barber", tenantId: metadata.shop_id };
  }
  if (platform === "nail" && metadata.nail_salon_id) {
    return { platform: "nail", tenantId: metadata.nail_salon_id };
  }
  if (metadata.salon_id) {
    return { platform: "salon", tenantId: metadata.salon_id };
  }
  return null;
}

export function tenantTable(platform: BillingPlatform): string {
  if (platform === "barber") return "barber_shops";
  if (platform === "nail") return "nail_salons";
  return "salons";
}
