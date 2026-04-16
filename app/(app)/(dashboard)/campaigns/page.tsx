import { redirect } from "next/navigation";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { canViewReports } from "@/lib/dashboard-roles";
import { audienceSummaryLine, normalizeCampaignSegment } from "@/lib/campaign-audience";
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

  const { data: serviceRows } = await supabase
    .from("services")
    .select("id, name")
    .eq("salon_id", context.salon.id)
    .order("name");

  const services = (serviceRows ?? []) as { id: string; name: string }[];
  const serviceNameById = Object.fromEntries(services.map((s) => [s.id, s.name]));

  const { data: past } = await supabase
    .from("email_campaigns")
    .select(
      "id, subject, status, recipient_count, sent_at, created_at, audience_segment, audience_service_id"
    )
    .eq("salon_id", context.salon.id)
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Email marketing for <span className="text-foreground font-medium">{context.salon.name}</span>. Delivery is
          powered by Resend (same as booking and reminder emails). Build a campaign in three steps—similar to tools
          like Brevo or Mailchimp—then send to clients who have opted in.
        </p>
      </div>

      <CampaignComposer salonId={context.salon.id} salonName={context.salon.name} services={services} />

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold mb-3">Recent campaigns</h2>
        {!past?.length ? (
          <p className="text-sm text-muted">No campaigns yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {past.map((row) => {
              const r = row as {
                id: string;
                subject: string | null;
                status: string;
                recipient_count: number | null;
                sent_at: string | null;
                audience_segment?: string | null;
                audience_service_id?: string | null;
              };
              const seg = normalizeCampaignSegment(r.audience_segment);
              const svcId = r.audience_service_id ?? null;
              const audienceLabel = audienceSummaryLine(seg, svcId ? (serviceNameById[svcId] ?? null) : null);
              return (
                <li key={r.id} className="rounded-md border-2 border-border bg-white/5 px-3 py-2">
                  <p className="font-medium truncate">{r.subject || "(no subject)"}</p>
                  <p className="text-xs text-muted mt-1">
                    {audienceLabel}
                    {" · "}
                    {r.status}
                    {r.recipient_count != null ? ` · ${r.recipient_count} recipients` : ""}
                    {r.sent_at ? ` · ${new Date(r.sent_at).toLocaleString("en-GB")}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
