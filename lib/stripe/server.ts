import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret?.trim()) {
      throw new Error("STRIPE_SECRET_KEY is required for Stripe server operations");
    }
    _stripe = new Stripe(secret);
  }
  return _stripe;
}
