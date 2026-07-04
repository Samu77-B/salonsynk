import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import {
  formatPlatformPrice,
  paymentInviteUrl,
  platformProductName,
  tenantRequiresPayment,
  tenantSubscriptionIsActive,
} from "@core/billing/platform-billing";
import { BARBER_SITE } from "@core/config/barber-site";

export default async function BarberBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancel?: string; already?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (await getIsSuperAdmin()) {
    const shopId = (await cookies()).get("admin_barber_shop_id")?.value;
    redirect(shopId ? "/barber/dashboard" : "/admin");
  }

  const context = await getCurrentUserShop();
  if (!context) redirect("/barber/onboarding");

  const params = await searchParams;
  const admin = createAdminClient();
  const { data: shopRow } = await admin
    .from("barber_shops")
    .select(
      "id, name, subscription_status, subscription_required, payment_invite_token, onboarding_welcome_sent_at"
    )
    .eq("id", context.shop.id)
    .single();

  if (!shopRow) redirect("/login");

  if (!tenantRequiresPayment(shopRow)) {
    redirect("/barber/dashboard");
  }

  const token = (shopRow.payment_invite_token as string | null)?.trim();
  const payUrl = token ? paymentInviteUrl("barber", token) : null;
  const isOwner = (context.member.role ?? "").toLowerCase() === "owner";
  const active = tenantSubscriptionIsActive(shopRow.subscription_status as string | null);

  if (active) {
    redirect("/barber/dashboard");
  }

  const planPrice = formatPlatformPrice("barber");

  return (
    <div className="mx-auto max-w-lg py-8">
      <h1 className="text-2xl font-bold mb-2">Complete your subscription</h1>
      <p className="text-muted text-sm mb-6">
        Welcome to {platformProductName("barber")} for{" "}
        <strong className="text-foreground">{shopRow.name as string}</strong>. Pay for your first
        month to unlock your dashboard.
      </p>

      {params.success === "1" && (
        <p className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          Payment received — thank you! We&apos;re activating your account. If your dashboard
          doesn&apos;t open within a minute, refresh this page.
        </p>
      )}
      {params.cancel === "1" && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Checkout was cancelled. You can try again when you&apos;re ready.
        </p>
      )}

      <div className="rounded-xl border border-border p-4 mb-6 space-y-2">
        <p className="text-sm text-muted">Your plan</p>
        <p className="text-lg font-semibold">BarberSynk — {planPrice}</p>
        <p className="text-sm text-muted">Live queue, appointments, and team tools for your shop.</p>
      </div>

      {isOwner && payUrl ? (
        <a
          href={payUrl}
          className="inline-flex rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-background"
        >
          Pay {planPrice} — first month
        </a>
      ) : isOwner ? (
        <p className="text-sm text-red-400">
          Payment link is not available. Contact{" "}
          <a href={`mailto:${BARBER_SITE.email}`} className="underline">
            {BARBER_SITE.email}
          </a>
          .
        </p>
      ) : (
        <p className="text-sm text-muted">
          Only the shop owner can complete payment. Ask your manager to pay from their welcome email.
        </p>
      )}

      <p className="mt-6 text-xs text-muted">
        Already paid?{" "}
        <Link href="/barber/billing" className="text-accent hover:underline">
          Refresh this page
        </Link>
        .
      </p>
    </div>
  );
}
