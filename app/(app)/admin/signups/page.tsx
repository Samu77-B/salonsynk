import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function AdminSignupsPage() {
  const supabase = createAdminClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at, is_super_admin")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin" className="text-muted hover:text-foreground text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold">All signups</h1>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Signed up</th>
              <th className="text-left px-4 py-2 font-medium">Super admin</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2">{p.full_name ?? "—"}</td>
                <td className="px-4 py-2">{p.email ?? "—"}</td>
                <td className="px-4 py-2 text-muted">
                  {p.created_at
                    ? new Date(p.created_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
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
    </div>
  );
}
