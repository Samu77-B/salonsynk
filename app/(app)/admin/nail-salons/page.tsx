import { createAdminClient } from "@core/supabase/admin";
import { NAIL_SITE } from "@core/config/nail-site";
import Link from "next/link";

export default async function AdminNailSalonsPage() {
  const supabase = createAdminClient();
  const { data: salons, error } = await supabase
    .from("nail_salons")
    .select("id, name, slug, subscription_status, created_at")
    .order("created_at", { ascending: false });

  const tableMissing = error?.message?.toLowerCase().includes("nail_salons");

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-muted hover:text-foreground text-sm">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Nail salons</h1>
        </div>
        <Link
          href="/admin/nail-salons/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          Add salon
        </Link>
      </div>

      {tableMissing ? (
        <p className="text-sm text-amber-400">
          Nail tables are not set up yet. Run migration 053_nail_module_schema.sql in Supabase.
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
              {(salons ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 font-mono text-muted">{s.slug}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`${NAIL_SITE.url}/nail/join/${s.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline font-mono text-xs"
                    >
                      /nail/join/{s.slug}
                    </a>
                  </td>
                  <td className="px-4 py-2 capitalize">{s.subscription_status}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`${NAIL_SITE.url}/api/admin/switch-nail-salon?salonId=${s.id}`}
                      className="text-accent hover:underline mr-3"
                    >
                      Manage
                    </a>
                    <Link href={`/admin/nail-salons/${s.id}`} className="text-accent hover:underline font-medium">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!salons?.length && (
            <p className="px-4 py-6 text-sm text-muted">No nail salons yet. Add one to get started.</p>
          )}
        </div>
      )}
    </div>
  );
}
