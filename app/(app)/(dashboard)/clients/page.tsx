import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ClientsPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, phone, patch_test_due_at")
    .eq("salon_id", context.salon.id)
    .order("name");

  return (
    <main className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link
          href="/clients/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          Add client
        </Link>
      </div>
      <ul className="space-y-2">
        {(clients ?? []).map((c) => (
          <li key={c.id}>
            <Link
              href={`/clients/${c.id}`}
              className="block rounded-lg border border-border p-4 hover:bg-white/5"
            >
              <p className="font-medium">{c.name || c.email || c.phone || "No name"}</p>
              {(c.email || c.phone) && (
                <p className="text-sm text-muted">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
              )}
              {c.patch_test_due_at && (
                <p className="text-xs text-amber-400 mt-1">
                  Patch test due: {new Date(c.patch_test_due_at).toLocaleDateString("en-GB")}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {(!clients || clients.length === 0) && (
        <p className="text-muted text-sm">No clients yet. Add your first client to get started.</p>
      )}
    </main>
  );
}
