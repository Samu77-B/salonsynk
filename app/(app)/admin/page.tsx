import { createAdminClient } from "@/lib/supabase/admin";
import {
  barberAdminSwitchUrl,
  barberJoinUrl,
  nailAdminSwitchUrl,
  nailJoinUrl,
  salonBookingUrl,
  salonPublicShopUrl,
  salonPublicUrlsLabel,
  salonShopUrl,
} from "@core/config/platform-urls";
import { fetchPaysynkOverview } from "@core/paysynk/admin-api";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();

  const [profilesRes, salonsRes, barberShopsRes, nailSalonsRes, paysynkOverview] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, created_at, is_super_admin")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("salons")
      .select("id, name, slug, subscription_status, plan_tier, feature_overrides, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("barber_shops")
      .select("id, name, slug, subscription_status, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("nail_salons")
      .select("id, name, slug, subscription_status, created_at")
      .order("created_at", { ascending: false }),
    fetchPaysynkOverview(),
  ]);

  const profiles = profilesRes.data ?? [];
  const salons = salonsRes.data ?? [];
  const barberShops = barberShopsRes.error ? [] : (barberShopsRes.data ?? []);
  const nailSalons = nailSalonsRes.error ? [] : (nailSalonsRes.data ?? []);

  return (
    <div className="max-w-6xl space-y-10">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>

      {/* Salons – card grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Salons</h2>
          <Link
            href="/admin/salons/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Add salon
          </Link>
        </div>
        {salons.length === 0 ? (
          <p className="text-muted text-sm">No salons yet. Add one to get started.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {salons.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-white/[0.02] p-4 flex flex-col gap-3 hover:border-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground truncate" title={s.name}>
                    {s.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      s.subscription_status === "active"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : s.subscription_status === "inactive"
                          ? "bg-muted/50 text-muted"
                          : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {s.subscription_status}
                  </span>
                </div>
                <p className="text-sm text-muted font-mono truncate" title={s.slug}>
                  {salonPublicUrlsLabel(s.slug, s)}
                </p>
                <p className="text-xs text-muted">
                  Joined{" "}
                  {s.created_at
                    ? new Date(s.created_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "—"}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-auto pt-1">
                  <a
                    href={salonBookingUrl(s.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline"
                  >
                    Booking
                  </a>
                  {salonPublicShopUrl(s) ? (
                    <>
                      <span className="text-muted">·</span>
                      <a
                        href={salonPublicShopUrl(s)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent hover:underline"
                      >
                        Shop
                      </a>
                    </>
                  ) : null}
                  <span className="text-muted">·</span>
                  <Link
                    href={`/admin/salons/${s.id}`}
                    className="text-sm text-accent hover:underline font-medium"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Barber shops */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Barbers</h2>
          <Link
            href="/admin/barber-shops/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Add barber
          </Link>
        </div>
        {barberShops.length === 0 ? (
          <p className="text-muted text-sm">No barber shops yet. Click Add barber to get started.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {barberShops.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-white/[0.02] p-4 flex flex-col gap-3 hover:border-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground truncate" title={s.name}>
                    {s.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      s.subscription_status === "active"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : s.subscription_status === "inactive"
                          ? "bg-muted/50 text-muted"
                          : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {s.subscription_status}
                  </span>
                </div>
                <p className="text-sm text-muted font-mono truncate" title={s.slug}>
                  /barber/join/{s.slug}
                </p>
                <p className="text-xs text-muted">
                  Joined{" "}
                  {s.created_at
                    ? new Date(s.created_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "—"}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-auto pt-1">
                  <a
                    href={barberJoinUrl(s.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline"
                  >
                    Join queue
                  </a>
                  <span className="text-muted">·</span>
                  <a
                    href={barberAdminSwitchUrl(s.id)}
                    className="text-sm text-accent hover:underline font-medium"
                  >
                    Manage
                  </a>
                  <span className="text-muted">·</span>
                  <Link
                    href={`/admin/barber-shops/${s.id}`}
                    className="text-sm text-accent hover:underline font-medium"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Nail salons */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nail bars</h2>
          <Link
            href="/admin/nail-salons/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Add nail bar
          </Link>
        </div>
        {nailSalons.length === 0 ? (
          <p className="text-muted text-sm">No nail bars yet. Click Add nail bar to get started.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nailSalons.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-white/[0.02] p-4 flex flex-col gap-3 hover:border-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground truncate" title={s.name}>
                    {s.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      s.subscription_status === "active"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : s.subscription_status === "inactive"
                          ? "bg-muted/50 text-muted"
                          : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {s.subscription_status}
                  </span>
                </div>
                <p className="text-sm text-muted font-mono truncate" title={s.slug}>
                  /nail/join/{s.slug}
                </p>
                <p className="text-xs text-muted">
                  Joined{" "}
                  {s.created_at
                    ? new Date(s.created_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "—"}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-auto pt-1">
                  <a
                    href={nailJoinUrl(s.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline font-medium"
                  >
                    Join queue
                  </a>
                  <span className="text-muted">·</span>
                  <a
                    href={nailAdminSwitchUrl(s.id)}
                    className="text-sm text-accent hover:underline font-medium"
                  >
                    Manage
                  </a>
                  <span className="text-muted">·</span>
                  <Link
                    href={`/admin/nail-salons/${s.id}`}
                    className="text-sm text-accent hover:underline font-medium"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PaySynk stores — separate app, HTTP only */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">PaySynk</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/paysynk/new"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Add client
            </Link>
            <Link href="/admin/paysynk" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>
        </div>
        {!paysynkOverview.ok ? (
          <p className="text-sm text-amber-400">
            {paysynkOverview.availability === "unconfigured"
              ? "PaySynk is not configured. Set PAYSYNK_ADMIN_API_KEY on the server."
              : `PaySynk is unavailable — ${paysynkOverview.error}`}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Total stores", paysynkOverview.data.stores.total],
                ["Pending", paysynkOverview.data.stores.pending],
                ["Approved", paysynkOverview.data.stores.approved],
                ["Rejected", paysynkOverview.data.stores.rejected],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-white/[0.02] p-4"
              >
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent signups – compact cards */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent signups</h2>
          <Link
            href="/admin/signups"
            className="text-sm text-accent hover:underline"
          >
            View all
          </Link>
        </div>
        {profiles.length === 0 ? (
          <p className="text-muted text-sm">No signups yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.slice(0, 9).map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-border bg-white/[0.02] px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {p.full_name || "—"}
                  </p>
                  <p className="text-sm text-muted truncate">{p.email ?? "—"}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {p.created_at
                      ? new Date(p.created_at).toLocaleDateString(undefined, {
                          dateStyle: "short",
                        })
                      : "—"}
                  </p>
                </div>
                {p.is_super_admin && (
                  <span className="shrink-0 rounded bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
                    Admin
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
