import Link from "next/link";
import {
  formatPlatformPrice,
  isStripePriceConfiguredForPlatform,
  platformBillingPortalPath,
  platformDashboardPath,
  platformProductName,
  platformSwitchIntervalPath,
  remainingOnboardingTrialDays,
  type PlatformBillingInterval,
} from "@core/billing/platform-billing";
import type { PlatformStripeSubscriptionSummary } from "@core/billing/platform-stripe-subscription";
import { PlatformSubscribeButtons } from "@/components/billing/platform-subscribe-buttons";
import { ONBOARDING_FREE_TRIAL_DAYS } from "@/lib/onboarding";

type Props = {
  platform: "barber" | "nail";
  businessName: string;
  isOwner: boolean;
  needsPayment: boolean;
  welcomeSentAt: string | null;
  paymentInviteToken: string | null;
  hasBillingCustomer: boolean;
  subscriptionStatus: string | null;
  stripeSummary: PlatformStripeSubscriptionSummary | null;
  productBlurb: string;
  supportEmail: string;
  flash?: {
    success?: string;
    cancel?: string;
    already?: string;
    switched?: string;
    error?: string;
  };
};

export function PlatformBillingAccountView({
  platform,
  businessName,
  isOwner,
  needsPayment,
  welcomeSentAt,
  paymentInviteToken,
  hasBillingCustomer,
  subscriptionStatus,
  stripeSummary,
  productBlurb,
  supportEmail,
  flash = {},
}: Props) {
  const dashboardHref = platformDashboardPath(platform);
  const daysLeft = remainingOnboardingTrialDays(welcomeSentAt);
  const currentInterval: PlatformBillingInterval | null = stripeSummary?.interval ?? null;
  const otherInterval: PlatformBillingInterval | null =
    currentInterval === "monthly" ? "yearly" : currentInterval === "yearly" ? "monthly" : null;
  const canSwitch =
    isOwner &&
    hasBillingCustomer &&
    otherInterval != null &&
    isStripePriceConfiguredForPlatform(platform, otherInterval);

  const panelClass =
    platform === "barber"
      ? "barber-panel rounded p-4 space-y-2"
      : "rounded-lg border border-border bg-surface/60 p-4 space-y-2";
  const primaryBtn =
    platform === "barber"
      ? "btn-accent inline-flex w-full sm:w-auto justify-center px-5 py-2.5 text-sm"
      : "inline-flex w-full sm:w-auto justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-background";
  const secondaryBtn =
    platform === "barber"
      ? "btn-outline inline-flex w-full sm:w-auto justify-center px-5 py-2.5 text-sm"
      : "inline-flex w-full sm:w-auto justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5";

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <div>
        {!needsPayment ? (
          <p className="text-xs text-muted mb-3">
            <Link href={dashboardHref} className="text-accent hover:underline">
              ← Back to dashboard
            </Link>
          </p>
        ) : null}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1">Billing</h1>
        <p className="text-sm text-muted">
          {platformProductName(platform)} for{" "}
          <span className="text-foreground font-medium">{businessName}</span>
        </p>
      </div>

      {flash.success === "1" && (
        <p className="rounded border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          Payment received — thank you! Your account should unlock within a minute. Refresh if needed.
        </p>
      )}
      {flash.cancel === "1" && (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Checkout was cancelled. You can try again when you&apos;re ready.
        </p>
      )}
      {flash.already === "1" && (
        <p className="text-sm text-muted">You&apos;re already on that plan.</p>
      )}
      {flash.switched === "monthly" || flash.switched === "yearly" ? (
        <p className="rounded border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          Plan updated to {flash.switched}. Stripe will prorate the change on your next invoice.
        </p>
      ) : null}
      {flash.error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Could not update billing ({flash.error}). Try again or contact{" "}
          <a href={`mailto:${supportEmail}`} className="underline">
            {supportEmail}
          </a>
          .
        </p>
      )}

      <section className={panelClass}>
        <p className="text-xs uppercase tracking-wide text-muted">Status</p>
        <p className="text-lg font-semibold capitalize">
          {subscriptionStatus?.trim() || "inactive"}
          {stripeSummary?.cancelAtPeriodEnd ? " (cancels at period end)" : ""}
        </p>
        {stripeSummary?.priceLabel ? (
          <p className="text-sm text-foreground">Current plan: {stripeSummary.priceLabel}</p>
        ) : daysLeft > 0 && !hasBillingCustomer ? (
          <p className="text-sm text-muted">
            Free trial — {daysLeft} day{daysLeft === 1 ? "" : "s"} left of {ONBOARDING_FREE_TRIAL_DAYS}
          </p>
        ) : (
          <p className="text-sm text-muted">{productBlurb}</p>
        )}
        {stripeSummary?.currentPeriodEnd ? (
          <p className="text-xs text-muted">Current period ends {stripeSummary.currentPeriodEnd}</p>
        ) : null}
      </section>

      {needsPayment && isOwner ? (
        <PlatformSubscribeButtons
          platform={platform}
          useAuthenticatedCheckout
          paymentInviteToken={paymentInviteToken}
          welcomeSentAt={welcomeSentAt}
          productBlurb={productBlurb}
        />
      ) : null}

      {!needsPayment && isOwner && !hasBillingCustomer ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            You&apos;re on the free month. Subscribe now to add a card — you won&apos;t be charged until the
            free period ends.
          </p>
          <PlatformSubscribeButtons
            platform={platform}
            useAuthenticatedCheckout
            paymentInviteToken={paymentInviteToken}
            welcomeSentAt={welcomeSentAt}
            variant="banner"
            productBlurb={productBlurb}
          />
        </div>
      ) : null}

      {isOwner && hasBillingCustomer ? (
        <section className={`${panelClass} space-y-3`}>
          <p className="text-xs uppercase tracking-wide text-muted">Manage</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canSwitch && otherInterval ? (
              <a href={platformSwitchIntervalPath(platform, otherInterval)} className={secondaryBtn}>
                Switch to {otherInterval} — {formatPlatformPrice(platform, otherInterval)}
              </a>
            ) : null}
            <a href={platformBillingPortalPath(platform)} className={primaryBtn}>
              Manage billing
            </a>
          </div>
          <p className="text-xs text-muted">
            Manage billing opens Stripe — update your card, download invoices, or cancel. Switching monthly ↔
            yearly prorates automatically.
          </p>
        </section>
      ) : null}

      {!isOwner ? (
        <section className={panelClass}>
          <p className="text-sm text-muted">
            Only the <span className="text-foreground font-medium">owner</span> can view or change the
            subscription. Ask them to open <strong className="text-foreground">Billing</strong> in the menu, or
            contact{" "}
            <a href={`mailto:${supportEmail}`} className="text-accent underline">
              {supportEmail}
            </a>
            .
          </p>
        </section>
      ) : null}

      {needsPayment ? (
        <p className="text-xs text-muted">
          Already paid?{" "}
          <Link
            href={platform === "barber" ? "/barber/billing" : "/nail/billing"}
            className="text-accent hover:underline"
          >
            Refresh this page
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
