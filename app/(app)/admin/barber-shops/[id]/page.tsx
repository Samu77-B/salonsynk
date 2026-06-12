import { createAdminClient } from "@core/supabase/admin";
import { BARBER_SITE } from "@core/config/barber-site";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminAddBarberOwnerForm } from "./admin-add-owner-form";
import { AdminAddBarberForm } from "./admin-add-barber-form";
import { AdminBarberMemberRow } from "./admin-barber-member-row";
import { AdminEditBarberShopForm } from "./admin-edit-barber-shop-form";

export default async function AdminBarberShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: shop } = await supabase
    .from("barber_shops")
    .select("id, name, slug, subscription_status, created_at, settings")
    .eq("id", id)
    .single();

  if (!shop) notFound();

  const { data: members } = await supabase
    .from("barber_members")
    .select(
      "id, role, display_name, user_id, avatar_url, chair_number, is_accepting_walk_ins"
    )
    .eq("shop_id", id)
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

  const joinUrl = `${BARBER_SITE.url}/barber/join/${shop.slug}`;
  const dashboardUrl = `${BARBER_SITE.url}/barber/dashboard`;
  const settings = (shop.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | boolean | undefined>) ?? {};
  const brandingStr = (key: string) => {
    const v = branding[key];
    return typeof v === "string" ? v : "";
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin/barber-shops" className="text-muted hover:text-foreground text-sm">
          ← Barber shops
        </Link>
        <h1 className="text-2xl font-bold">{shop.name}</h1>
      </div>

      <section className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="font-semibold">Shop details</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Slug</dt>
            <dd className="font-mono">{shop.slug}</dd>
          </div>
          <div>
            <dt className="text-muted">Billing</dt>
            <dd className="capitalize">{shop.subscription_status}</dd>
          </div>
          <div>
            <dt className="text-muted">Plan</dt>
            <dd>£25 pcm (BarberSynk)</dd>
          </div>
          <div>
            <dt className="text-muted">Created</dt>
            <dd>
              {shop.created_at
                ? new Date(shop.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })
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
            href={`${BARBER_SITE.url}/api/admin/switch-barber-shop?shopId=${shop.id}`}
            className="text-sm text-accent hover:underline font-medium"
          >
            Open barber dashboard
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
            href={`${BARBER_SITE.url}/api/admin/switch-barber-shop?shopId=${shop.id}`}
            className="text-accent font-mono break-all underline hover:opacity-80"
          >
            {dashboardUrl}
          </a>
        </p>
      </section>

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-semibold">Branding &amp; queue page</h2>
        <p className="text-sm text-muted">
          Logo and brand colour appear on the public walk-in queue page customers use to join the line.
        </p>
        <AdminEditBarberShopForm
          shopId={shop.id}
          initialName={shop.name}
          initialSlug={shop.slug}
          initialBranding={{
            logo_url: brandingStr("logo_url"),
            primary_color: brandingStr("primary_color"),
            company_name: brandingStr("company_name") || shop.name,
            show_title_on_queue: branding.show_title_on_queue !== false,
          }}
        />
      </section>

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-semibold">Team</h2>
        <p className="text-sm text-muted">
          Add barbers with a name and photo so walk-in clients can choose who they want on the
          public queue page — or pick next available.
        </p>
        {(members ?? []).length === 0 ? (
          <p className="text-sm text-muted">No team members yet.</p>
        ) : (
          <ul className="space-y-2">
            {(members ?? []).map((m) => (
              <AdminBarberMemberRow
                key={m.id}
                shopId={shop.id}
                member={{
                  ...m,
                  email: m.user_id ? profilesMap[m.user_id] ?? null : null,
                }}
              />
            ))}
          </ul>
        )}
        <AdminAddBarberForm shopId={shop.id} />
        <div className="border-t border-border pt-4">
          <AdminAddBarberOwnerForm shopId={shop.id} />
        </div>
      </section>
    </div>
  );
}
