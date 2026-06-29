import { createAdminClient } from "@core/supabase/admin";
import { NAIL_SITE } from "@core/config/nail-site";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminAddNailOwnerForm } from "./admin-add-owner-form";
import { AdminAddTechnicianForm } from "./admin-add-technician-form";
import { AdminNailMemberRow } from "./admin-nail-member-row";
import { AdminEditNailSalonForm } from "./admin-edit-nail-salon-form";
import { AdminPlatformOnboardingPanel } from "@/components/admin/admin-platform-onboarding-panel";
import { formatPlatformPrice } from "@core/billing/platform-billing";

export default async function AdminNailSalonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: salon } = await supabase
    .from("nail_salons")
    .select(
      "id, name, slug, subscription_status, subscription_required, onboarding_welcome_sent_at, created_at, settings"
    )
    .eq("id", id)
    .single();

  if (!salon) notFound();

  const { data: members } = await supabase
    .from("nail_members")
    .select(
      "id, role, display_name, user_id, avatar_url, station_number, is_accepting_walk_ins"
    )
    .eq("salon_id", id)
    .eq("is_active", true)
    .order("role")
    .order("display_name");

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

  const joinUrl = `${NAIL_SITE.url}/nail/join/${salon.slug}`;
  const dashboardUrl = `${NAIL_SITE.url}/nail/queue`;
  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | boolean | undefined>) ?? {};
  const brandingStr = (key: string) => {
    const v = branding[key];
    return typeof v === "string" ? v : "";
  };

  const ownerEmails = (members ?? [])
    .filter((m) => (m.role ?? "").toLowerCase() === "owner")
    .map((m) => profilesMap[m.user_id])
    .filter((e): e is string => Boolean(e));

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin/nail-salons" className="text-muted hover:text-foreground text-sm">
          ← Nail salons
        </Link>
        <h1 className="text-2xl font-bold">{salon.name}</h1>
      </div>

      <section className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="font-semibold">Salon details</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Slug</dt>
            <dd className="font-mono">{salon.slug}</dd>
          </div>
          <div>
            <dt className="text-muted">Billing</dt>
            <dd className="capitalize">{salon.subscription_status}</dd>
          </div>
          <div>
            <dt className="text-muted">Plan</dt>
            <dd>{formatPlatformPrice("nail")}</dd>
          </div>
          <div>
            <dt className="text-muted">Created</dt>
            <dd>
              {salon.created_at
                ? new Date(salon.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })
                : "—"}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            Public join queue
          </a>
          <span className="text-muted">·</span>
          <a
            href={`${NAIL_SITE.url}/api/admin/switch-nail-salon?salonId=${salon.id}`}
            className="text-sm text-accent hover:underline font-medium"
          >
            Open nail dashboard
          </a>
        </div>
        <p className="text-xs text-muted">
          Join queue:{" "}
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent font-mono break-all underline hover:opacity-80"
          >
            {joinUrl}
          </a>
        </p>
        <p className="text-xs text-muted">
          Dashboard:{" "}
          <a
            href={`${NAIL_SITE.url}/api/admin/switch-nail-salon?salonId=${salon.id}`}
            className="text-accent font-mono break-all underline hover:opacity-80"
          >
            {dashboardUrl}
          </a>
        </p>
      </section>

      <AdminPlatformOnboardingPanel
        platform="nail"
        tenantId={salon.id}
        ownerEmails={ownerEmails}
        welcomeSentAt={(salon.onboarding_welcome_sent_at as string | null) ?? null}
        subscriptionRequired={Boolean(salon.subscription_required)}
        subscriptionStatus={(salon.subscription_status as string) ?? "inactive"}
        productName="NailSynk"
      />

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-semibold">Branding &amp; queue page</h2>
        <p className="text-sm text-muted">
          Logo and brand colour appear on the public walk-in queue page customers use to join the line.
        </p>
        <AdminEditNailSalonForm
          salonId={salon.id}
          initialName={salon.name}
          initialSlug={salon.slug}
          initialBranding={{
            logo_url: brandingStr("logo_url"),
            primary_color: brandingStr("primary_color"),
            company_name: brandingStr("company_name") || salon.name,
            show_title_on_queue: branding.show_title_on_queue !== false,
            next_available_only: branding.next_available_only === true,
            show_services_on_queue: branding.show_services_on_queue !== false,
          }}
        />
      </section>

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-semibold">Team</h2>
        <p className="text-sm text-muted">
          Use the checkbox on each person to show or hide them on the public{" "}
          <span className="font-medium text-foreground">Choose your technician</span> page. Click{" "}
          <span className="font-medium text-foreground">Edit name &amp; station</span> to change their
          display name or station number.
        </p>
        {(members ?? []).length === 0 ? (
          <p className="text-sm text-muted">No team members yet.</p>
        ) : (
          <ul className="space-y-2">
            {(members ?? []).map((m) => (
              <AdminNailMemberRow
                key={m.id}
                salonId={salon.id}
                member={{
                  ...m,
                  email: m.user_id ? profilesMap[m.user_id] ?? null : null,
                }}
              />
            ))}
          </ul>
        )}
        <AdminAddTechnicianForm salonId={salon.id} />
        <div className="border-t border-border pt-4">
          <AdminAddNailOwnerForm salonId={salon.id} />
        </div>
      </section>
    </div>
  );
}
