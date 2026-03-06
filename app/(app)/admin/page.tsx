import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();

  const [profilesRes, salonsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, created_at, is_super_admin")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("salons")
      .select("id, name, slug, subscription_status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const profiles = profilesRes.data ?? [];
  const salons = salonsRes.data ?? [];

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
                  /book/{s.slug}
                </p>
                <p className="text-xs text-muted">
                  Joined{" "}
                  {s.created_at
                    ? new Date(s.created_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "—"}
                </p>
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <a
                    href={`/book/${s.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline"
                  >
                    View booking
                  </a>
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
