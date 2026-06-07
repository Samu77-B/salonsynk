import { createAdminClient } from "@core/supabase/admin";
import { BARBER_SITE } from "@core/config/barber-site";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminAddBarberOwnerForm } from "./admin-add-owner-form";

export default async function AdminBarberShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: shop } = await supabase
    .from("barber_shops")
    .select("id, name, slug, subscription_status, created_at")
    .eq("id", id)
    .single();

  if (!shop) notFound();

  const { data: members } = await supabase
    .from("barber_members")
    .select("id, role, display_name, user_id")
    .eq("shop_id", id)
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

  const joinUrl = `${BARBER_SITE.url}/barber/join/${shop.slug}`;
  const dashboardUrl = `${BARBER_SITE.url}/barber/dashboard`;

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
        <p className="text-xs text-muted font-mono break-all">{joinUrl}</p>
        <p className="text-xs text-muted">
          Dashboard: <span className="font-mono">{dashboardUrl}</span>
        </p>
      </section>

      <section className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-semibold">Owners &amp; staff</h2>
        {(members ?? []).length === 0 ? (
          <p className="text-sm text-muted">No members linked yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(members ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.display_name ?? "—"}</span>
                <span className="text-muted capitalize">({m.role})</span>
                <span className="text-muted">{profilesMap[m.user_id] ?? m.user_id}</span>
              </li>
            ))}
          </ul>
        )}
        <AdminAddBarberOwnerForm shopId={shop.id} />
      </section>
    </div>
  );
}
