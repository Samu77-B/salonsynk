import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchSalonOnboardingState,
  paymentInviteUrl,
  parsePlanTier,
  salonRequiresPayment,
  salonSubscriptionIsActive,
} from "@/lib/onboarding";
import { canBypassSalonSubscriptionGate, getAdminSalonSwitchId } from "@/lib/salon-access.server";
import { PLAN_TIERS, formatPlanPrice } from "@/config/plans";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancel?: string; already?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (await canBypassSalonSubscriptionGate()) {
    const switchedSalonId = await getAdminSalonSwitchId();
    redirect(switchedSalonId ? "/dashboard" : "/admin");
  }

  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const params = await searchParams;
  const admin = createAdminClient();
  const { data: salonRow } = await admin
    .from("salons")
    .select(
      "id, name, plan_tier, subscription_status, subscription_required, payment_invite_token, onboarding_welcome_sent_at"
    )
    .eq("id", context.salon.id)
    .single();

  if (!salonRow) redirect("/login");

  const state = {
    ...(salonRow as Parameters<typeof salonRequiresPayment>[0]),
    id: salonRow.id as string,
    name: salonRow.name as string,
  };

  if (!salonRequiresPayment(state)) {
    redirect("/dashboard");
  }

  const planTier = parsePlanTier(salonRow.plan_tier as string | null);
  const planMeta = PLAN_TIERS[planTier];
  const token = (salonRow.payment_invite_token as string | null)?.trim();
  const payUrl = token ? paymentInviteUrl(token) : null;
  const isOwner = (context.member.role ?? "").toLowerCase() === "owner";
  const active = salonSubscriptionIsActive(salonRow.subscription_status as string | null);

  if (active) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-lg py-8">
      <h1 className="text-2xl font-bold mb-2">Complete your subscription</h1>
      <p className="text-muted text-sm mb-6">
        Welcome to SalonSynk for <strong className="text-foreground">{salonRow.name as string}</strong>.
        Pay for your first month to unlock your dashboard. Your plan renews monthly after that.
      </p>

      {params.success === "1" && (
        <p className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          Payment received — thank you! We&apos;re activating your account. If your dashboard doesn&apos;t open
          within a minute, refresh this page.
        </p>
      )}
      {params.cancel === "1" && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Checkout was cancelled. You can try again when you&apos;re ready.
        </p>
      )}
      {params.already === "1" && (
        <p className="mb-4 text-sm text-muted">This salon already has an active subscription.</p>
      )}

      <div className="rounded-xl border border-border p-4 mb-6 space-y-2">
        <p className="text-sm text-muted">Your plan</p>
        <p className="text-lg font-semibold">
          {planMeta.label} — {formatPlanPrice(planTier)}
        </p>
        <p className="text-sm text-muted">{planMeta.tagline}</p>
      </div>

      {isOwner && payUrl ? (
        <a
          href={payUrl}
          className="inline-flex rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-background"
        >
          Pay {formatPlanPrice(planTier)} — first month
        </a>
      ) : isOwner ? (
        <p className="text-sm text-red-400">
          Payment link is not available. Contact{" "}
          <a href="mailto:hello@salonsynk.com" className="underline">
            hello@salonsynk.com
          </a>
          .
        </p>
      ) : (
        <p className="text-sm text-muted">
          Only the salon owner can complete payment. Please ask your manager to pay from their welcome email
          or log in as owner.
        </p>
      )}

      <p className="mt-6 text-xs text-muted">
        Questions? Email{" "}
        <a href="mailto:hello@salonsynk.com" className="text-accent hover:underline">
          hello@salonsynk.com
        </a>
        . Already paid?{" "}
        <Link href="/billing" className="text-accent hover:underline">
          Refresh this page
        </Link>
        .
      </p>
    </div>
  );
}
