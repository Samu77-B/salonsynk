import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TeamView } from "./team-view";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const [membersRes, invitesRes, countsRes, salonRes] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, user_id, display_name, role, is_active, holiday_ranges, employment_type, avatar_url, calendar_color")
      .eq("salon_id", context.salon.id)
      .order("role", { ascending: false }),
    supabase
      .from("salon_invites")
      .select("id, email, role, display_name, created_at")
      .eq("salon_id", context.salon.id),
    supabase
      .from("appointments")
      .select("stylist_id")
      .eq("salon_id", context.salon.id)
      .gte("start_time", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("salons").select("settings").eq("id", context.salon.id).single(),
  ]);

  const members = membersRes.data ?? [];
  const userIds = [...new Set(members.map((m) => m.user_id).filter(Boolean))] as string[];
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
  const invites = invitesRes.data ?? [];
  const appointments = countsRes.data ?? [];
  const appointmentCountByStylist: Record<string, number> = {};
  for (const a of appointments) {
    if (a.stylist_id) appointmentCountByStylist[a.stylist_id] = (appointmentCountByStylist[a.stylist_id] ?? 0) + 1;
  }
  const settings = (salonRes.data?.settings as Record<string, unknown>) ?? {};
  const customRoles = (settings.team_roles as string[]) ?? [];

  const dbError = membersRes.error?.message ?? invitesRes.error?.message ?? salonRes.error?.message;

  return (
    <main className="mx-auto w-full min-w-0 p-4 md:p-6">
      {dbError && (
        <p className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          Database error: {dbError}
        </p>
      )}
      <TeamView
        salonId={context.salon.id}
        members={members}
        memberEmails={profilesMap}
        invites={invites}
        appointmentCountByStylist={appointmentCountByStylist}
        isOwner={context.member.role === "owner"}
        customRoles={customRoles}
      />
    </main>
  );
}
