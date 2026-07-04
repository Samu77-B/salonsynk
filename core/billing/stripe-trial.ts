import { ONBOARDING_FREE_TRIAL_DAYS } from "@/lib/onboarding";

/** Stripe subscription trial for new client checkout (matches platform free month). */
export function stripeOnboardingTrialPeriod() {
  return { trial_period_days: ONBOARDING_FREE_TRIAL_DAYS } as const;
}
