import { ONBOARDING_FREE_TRIAL_DAYS } from "@/lib/onboarding";
import {
  formatPlatformPrice,
  isStripePriceConfiguredForPlatform,
  paymentInviteUrl,
  platformCheckoutPath,
  platformProductName,
  remainingOnboardingTrialDays,
} from "@core/billing/platform-billing";

type Props = {
  platform: "barber" | "nail";
  /** Prefer logged-in checkout when true; otherwise use invite token links. */
  useAuthenticatedCheckout: boolean;
  paymentInviteToken?: string | null;
  welcomeSentAt?: string | null;
  /** Compact banner for dashboard (vs full billing card). */
  variant?: "page" | "banner";
  productBlurb: string;
};

export function PlatformSubscribeButtons({
  platform,
  useAuthenticatedCheckout,
  paymentInviteToken,
  welcomeSentAt,
  variant = "page",
  productBlurb,
}: Props) {
  const monthlyConfigured = isStripePriceConfiguredForPlatform(platform, "monthly");
  const yearlyConfigured = isStripePriceConfiguredForPlatform(platform, "yearly");
  const monthlyLabel = formatPlatformPrice(platform, "monthly");
  const yearlyLabel = formatPlatformPrice(platform, "yearly");
  const daysLeft = remainingOnboardingTrialDays(welcomeSentAt);

  const monthlyHref = useAuthenticatedCheckout
    ? platformCheckoutPath(platform, "monthly")
    : paymentInviteToken
      ? paymentInviteUrl(platform, paymentInviteToken, "monthly")
      : null;
  const yearlyHref = useAuthenticatedCheckout
    ? platformCheckoutPath(platform, "yearly")
    : paymentInviteToken
      ? paymentInviteUrl(platform, paymentInviteToken, "yearly")
      : null;

  const title =
    daysLeft > 0
      ? `Choose a plan — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left free`
      : "Choose a plan to continue";

  const intro =
    daysLeft > 0
      ? `Your first ${ONBOARDING_FREE_TRIAL_DAYS} days of ${platformProductName(platform)} are free. Pick monthly or yearly now — you won't be charged until the free period ends.`
      : `Your free month has ended. Subscribe to keep using ${platformProductName(platform)}.`;

  const panelClass =
    platform === "barber"
      ? "barber-panel rounded px-4 py-3 sm:px-5 sm:py-4"
      : "rounded-lg border border-border bg-surface/80 px-4 py-3 sm:px-5 sm:py-4";
  const primaryBtn =
    platform === "barber"
      ? "btn-accent inline-flex px-4 py-2 text-sm"
      : "inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background";
  const secondaryBtn =
    platform === "barber"
      ? "btn-outline inline-flex px-4 py-2 text-sm"
      : "inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5";

  if (variant === "banner") {
    return (
      <div className={panelClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted mt-0.5">{intro}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {monthlyConfigured && monthlyHref ? (
              <a href={monthlyHref} className={primaryBtn}>
                Monthly · {monthlyLabel}
              </a>
            ) : null}
            {yearlyConfigured && yearlyHref ? (
              <a href={yearlyHref} className={secondaryBtn}>
                Yearly · {yearlyLabel}
              </a>
            ) : null}
          </div>
        </div>
        {(!monthlyConfigured || !yearlyConfigured) && (
          <p className="mt-2 text-xs text-amber-200/90">
            {!monthlyConfigured && !yearlyConfigured
              ? "Subscription prices are not configured yet. Add STRIPE_PRICE_BARBER / STRIPE_PRICE_NAIL (and _YEARLY) on this Vercel project, then redeploy."
              : !yearlyConfigured
                ? "Yearly plan is not configured yet — monthly is available."
                : "Monthly plan is not configured yet — yearly is available."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${panelClass} space-y-2`}>
        <p className="text-xs uppercase tracking-wide text-muted">Your plan</p>
        <p className="text-lg font-semibold">{platformProductName(platform)}</p>
        <p className="text-sm text-muted">{productBlurb}</p>
        <p className="text-sm text-muted pt-1">
          {monthlyLabel}
          {yearlyConfigured ? ` · or ${yearlyLabel}` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {monthlyConfigured && monthlyHref ? (
          <a href={monthlyHref} className={primaryBtn}>
            Subscribe monthly — {monthlyLabel}
          </a>
        ) : null}
        {yearlyConfigured && yearlyHref ? (
          <a href={yearlyHref} className={secondaryBtn}>
            Subscribe yearly — {yearlyLabel}
          </a>
        ) : null}
      </div>

      {!monthlyConfigured && !yearlyConfigured ? (
        <p className="text-sm text-amber-200/90">
          Subscription prices are not configured yet. Add the Stripe price env vars on this Vercel project and
          redeploy.
        </p>
      ) : !monthlyHref && !yearlyHref ? (
        <p className="text-sm text-red-400">
          Payment link is not available. Contact support to activate billing.
        </p>
      ) : null}
    </div>
  );
}
