import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminEditSalonForm } from "./admin-edit-salon-form";
import { AdminSalonDangerZone } from "./admin-salon-danger-zone";
import { AdminSalonOnboardingPanel } from "./admin-salon-onboarding-panel";
import { AdminSalonPaymentGateway } from "./admin-salon-payment-gateway";
import { AdminSalonPlanSection } from "./admin-salon-plan-section";
import { isPlanTierId, type PlanTierId } from "@/config/plans";

export default async function AdminEditSalonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: salon } = await supabase
    .from("salons")
    .select(
      "id, name, slug, settings, plan_tier, feature_overrides, subscription_status, subscription_required, onboarding_welcome_sent_at, payment_gateway"
    )
    .eq("id", id)
    .single();
  if (!salon) notFound();

  const { data: members } = await supabase
    .from("salon_members")
    .select("id, role, display_name, user_id")
    .eq("salon_id", id)
    .eq("is_active", true);

  const userIds = (members ?? []).map((m) => m.user_id).filter(Boolean);
  const profilesMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      if (p.email) profilesMap[p.id] = p.email;
    }
  }

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const rawTier = (salon as { plan_tier?: string }).plan_tier ?? "professional";
  const planTier: PlanTierId = isPlanTierId(rawTier) ? rawTier : "professional";
  const featureOverrides =
    ((salon as { feature_overrides?: Record<string, boolean> }).feature_overrides as
      | Record<string, boolean>
      | null) ?? {};
  const subscriptionStatus =
    (salon as { subscription_status?: string }).subscription_status ?? "inactive";
  const welcomeSentAt =
    (salon as { onboarding_welcome_sent_at?: string | null }).onboarding_welcome_sent_at ?? null;
  const subscriptionRequired = Boolean(
    (salon as { subscription_required?: boolean }).subscription_required
  );
  const paymentActive = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  const paymentGateway =
    (salon as { payment_gateway?: string }).payment_gateway ?? "stripe";

  const brandingDone = Boolean(
    branding.logo_url?.trim() || branding.primary_color?.trim() || branding.company_name?.trim()
  );
  const memberRows = members ?? [];
  const ownerEmails = memberRows
    .filter((m) => (m.role ?? "").toLowerCase() === "owner")
    .map((m) => profilesMap[m.user_id])
    .filter((e): e is string => Boolean(e));
  const ownerCount = memberRows.filter((m) => (m.role ?? "").toLowerCase() === "owner").length;
  const staffCount = memberRows.length - ownerCount;
  const ownerDone = ownerCount > 0;
  const frontDeskDone = staffCount > 0;
  const checklist: { label: string; done: boolean; hint: string }[] = [
    { label: "Platform plan", done: true, hint: "Save Essentials / Professional / Complete below" },
    { label: "Branding", done: brandingDone, hint: "Set company name, logo, primary colour" },
    { label: "Welcome email sent", done: Boolean(welcomeSentAt), hint: "Owner gets login + payment link" },
    { label: "Subscription paid", done: paymentActive, hint: "Owner pays via link — unlocks dashboard" },
    { label: "Front desk login (optional)", done: frontDeskDone, hint: "Shared staff login after owner is live" },
  ];

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/salons" className="text-muted hover:text-foreground text-sm">
          ← Salons
        </Link>
        <h1 className="text-2xl font-bold">Edit salon</h1>
      </div>
      <section
        aria-label="Setup checklist"
        className="mb-6 rounded-xl border border-border bg-background/60 p-4 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold">Setup checklist</h2>
        <ol className="space-y-2 text-sm">
          {checklist.map((step, i) => (
            <li key={step.label} className="flex items-start gap-3">
              <span
                aria-hidden
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  step.done
                    ? "border-green-500/60 bg-green-500/15 text-green-400"
                    : "border-border text-muted"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span className={step.done ? "text-foreground" : "font-medium text-foreground"}>
                  {step.label}
                </span>
                <span className="block text-xs text-muted">{step.hint}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <a
          href={`/api/admin/switch-salon?salonId=${salon.id}`}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Manage salon (Team, Services, Clients…)
        </a>
        <span className="text-muted text-sm flex flex-wrap gap-x-3 gap-y-1">
          <span>
            Booking:{" "}
            <a
              href={`/book/${salon.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              /book/{salon.slug}
            </a>
          </span>
          <span>
            Shop:{" "}
            <a
              href={`/shop/${salon.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              /shop/{salon.slug}
            </a>
          </span>
        </span>
      </div>
      <AdminEditSalonForm
        salonId={salon.id}
        initialName={salon.name}
        initialSlug={salon.slug}
        initialBranding={{
          logo_url: branding.logo_url ?? "",
          primary_color: branding.primary_color ?? "",
          company_name: branding.company_name ?? "",
        }}
        owners={(members ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          display_name: m.display_name,
          email: profilesMap[m.user_id] ?? null,
        }))}
      />
      <AdminSalonPlanSection
        salonId={salon.id}
        initialPlanTier={planTier}
        initialFeatureOverrides={featureOverrides}
        subscriptionStatus={subscriptionStatus}
      />
      <AdminSalonPaymentGateway salonId={salon.id} initialGateway={paymentGateway} />
      <AdminSalonOnboardingPanel
        salonId={salon.id}
        ownerEmails={ownerEmails}
        welcomeSentAt={welcomeSentAt}
        subscriptionRequired={subscriptionRequired}
        subscriptionStatus={subscriptionStatus}
      />
      <AdminSalonDangerZone salonId={salon.id} salonName={salon.name} />
    </div>
  );
}
