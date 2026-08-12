import { ONBOARDING_FREE_TRIAL_DAYS } from "@/lib/onboarding";
import { remainingOnboardingTrialDays } from "@core/billing/platform-billing";

/** Full onboarding free month as Stripe trial (legacy / no welcome date). */
export function stripeOnboardingTrialPeriod() {
  return { trial_period_days: ONBOARDING_FREE_TRIAL_DAYS } as const;
}

/**
 * Stripe trial matching remaining free days from welcome email.
 * Returns {} when the free window has ended (charge immediately).
 */
export function stripeTrialPeriodForWelcome(
  welcomeSentAt: string | null | undefined
): { trial_period_days: number } | Record<string, never> {
  const days = remainingOnboardingTrialDays(welcomeSentAt);
  if (days <= 0) return {};
  return { trial_period_days: days };
}
