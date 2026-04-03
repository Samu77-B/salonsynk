import { redirect } from "next/navigation";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { canViewReports } from "@/lib/dashboard-roles";
import { CampaignComposer } from "./campaign-composer";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const isSuperAdmin = await getIsSuperAdmin();
  if (!canViewReports(isSuperAdmin, context.member.role ?? "")) {
    return (
      <main className="mx-auto w-full min-w-0 p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-3">Campaigns</h1>
        <p className="text-sm text-muted">
          Email campaigns are available to owners and manager roles only.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: past } = await supabase
    .from("email_campaigns")
    .select("id, subject, status, recipient_count, sent_at, created_at, error_message")
    .eq("salon_id", context.salon.id)
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <p className="text-sm text-muted mt-1">
          Marketing email for {context.salon.name}. Uses Resend; recipients must opt in on their client profile.
        </p>
      </div>

      <CampaignComposer />

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold mb-3">Recent campaigns</h2>
        {!past?.length ? (
          <p className="text-sm text-muted">No campaigns yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {past.map((row) => (
              <li key={row.id} className="rounded-md border border-border/80 bg-white/5 px-3 py-2">
                <p className="font-medium truncate">{row.subject || "(no subject)"}</p>
                <p className="text-xs text-muted mt-1">
                  {row.status}
                  {row.recipient_count != null ? ` · ${row.recipient_count} recipients` : ""}
                  {row.sent_at ? ` · ${new Date(row.sent_at).toLocaleString("en-GB")}` : ""}
                </p>
                {row.error_message && <p className="text-xs text-red-400 mt-1">{row.error_message}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
