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
    <div className="max-w-4xl space-y-10">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>

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
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Signed up</th>
                <th className="text-left px-4 py-2 font-medium">Admin</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2">{p.full_name ?? "—"}</td>
                  <td className="px-4 py-2">{p.email ?? "—"}</td>
                  <td className="px-4 py-2 text-muted">
                    {p.created_at
                      ? new Date(p.created_at).toLocaleDateString(undefined, {
                          dateStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {p.is_super_admin ? (
                      <span className="text-accent">Yes</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Salons</h2>
          <Link
            href="/admin/salons/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Add salon
          </Link>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Slug</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
                <th className="text-left px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {salons.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 font-mono text-muted">{s.slug}</td>
                  <td className="px-4 py-2 capitalize">{s.subscription_status}</td>
                  <td className="px-4 py-2 text-muted">
                    {s.created_at
                      ? new Date(s.created_at).toLocaleDateString(undefined, {
                          dateStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/salons/${s.id}`}
                      className="text-accent hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
