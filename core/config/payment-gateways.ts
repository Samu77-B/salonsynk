/**
 * In-salon / retail payment provider per salon (separate from SalonSynk platform subscription billing).
 */

export type PaymentGatewayId = "stripe" | "worldpay" | "dojo" | "other_pos";

export const PAYMENT_GATEWAY_IDS: PaymentGatewayId[] = [
  "stripe",
  "worldpay",
  "dojo",
  "other_pos",
];

export const PAYMENT_GATEWAYS: Record<
  PaymentGatewayId,
  {
    label: string;
    shortLabel: string;
    description: string;
    /** SalonSynk can take card payments in-app for this provider */
    supportsInAppCheckout: boolean;
  }
> = {
  stripe: {
    label: "Stripe (SalonSynk checkout)",
    shortLabel: "Stripe",
    description:
      "Take card payments in SalonSynk checkout. Connect your Stripe account in Settings after you go live.",
    supportsInAppCheckout: true,
  },
  worldpay: {
    label: "Worldpay (existing terminal)",
    shortLabel: "Worldpay",
    description:
      "You already take cards on your Worldpay terminal. Use SalonSynk checkout to record the sale — payment happens on your existing device.",
    supportsInAppCheckout: false,
  },
  dojo: {
    label: "Dojo (existing terminal)",
    shortLabel: "Dojo",
    description:
      "You already take cards on your Dojo terminal. Use SalonSynk checkout to record the sale — payment happens on your existing device.",
    supportsInAppCheckout: false,
  },
  other_pos: {
    label: "Other card machine / POS",
    shortLabel: "Other POS",
    description:
      "You use another card provider or till. Record completed sales in SalonSynk for reporting; card payment stays on your existing system.",
    supportsInAppCheckout: false,
  },
};

export function isPaymentGatewayId(value: string): value is PaymentGatewayId {
  return PAYMENT_GATEWAY_IDS.includes(value as PaymentGatewayId);
}

export function salonUsesStripeCheckout(gateway: string | null | undefined): boolean {
  return (gateway ?? "stripe") === "stripe";
}

export function externalPaymentReference(gateway: PaymentGatewayId): string {
  return `${gateway}_${crypto.randomUUID()}`;
}
