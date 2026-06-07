import { createAdminClient } from "@core/supabase/admin";
import { BARBER_SITE } from "@core/config/barber-site";
import Link from "next/link";

export default async function AdminBarberShopsPage() {
  const supabase = createAdminClient();
  const { data: shops, error } = await supabase
    .from("barber_shops")
    .select("id, name, slug, subscription_status, created_at")
    .order("created_at", { ascending: false });

  const tableMissing = error?.message?.toLowerCase().includes("barber_shops");

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-muted hover:text-foreground text-sm">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Barbers</h1>
        </div>
        <Link
          href="/admin/barber-shops/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          Add barber
        </Link>
      </div>

      {tableMissing ? (
        <p className="text-sm text-amber-400">
          Barber tables are not set up yet. Run migration 043_barber_module_schema.sql in Supabase.
        </p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Slug</th>
                <th className="text-left px-4 py-2 font-medium">Join queue</th>
                <th className="text-left px-4 py-2 font-medium">Billing</th>
                <th className="text-left px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(shops ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 font-mono text-muted">{s.slug}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`${BARBER_SITE.url}/barber/join/${s.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline font-mono text-xs"
                    >
                      /barber/join/{s.slug}
                    </a>
                  </td>
                  <td className="px-4 py-2 capitalize">{s.subscription_status}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`${BARBER_SITE.url}/api/admin/switch-barber-shop?shopId=${s.id}`}
                      className="text-accent hover:underline mr-3"
                    >
                      Manage
                    </a>
                    <Link href={`/admin/barber-shops/${s.id}`} className="text-accent hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shops?.length && (
            <p className="px-4 py-6 text-sm text-muted">No barber shops yet. Add one to get started.</p>
          )}
        </div>
      )}
    </div>
  );
}
