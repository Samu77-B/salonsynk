import { requireSalonFeature } from "@/lib/salon-features.server";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";
import { redirect } from "next/navigation";
import { fetchSalonMembersAdaptiveSelect } from "@/lib/show-on-diary";
import { TeamView, type Member } from "./team-view";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { context } = await requireSalonFeature("team");

  const isSuperAdmin = await getIsSuperAdmin();
  if (!isManagerRole(isSuperAdmin, context.member.role ?? "")) redirect("/dashboard");

  const supabase = await createClient();
  const membersQuery = async () => {
    const BASE =
      "id, user_id, display_name, role, is_active, holiday_ranges, employment_type, avatar_url";
    const r = await fetchSalonMembersAdaptiveSelect(supabase, context!.salon.id, [
      `${BASE}, passcode_hash, show_on_diary`,
      `${BASE}, passcode_hash`,
      `${BASE}, show_on_diary`,
      BASE,
    ], { activeOnly: false });
    return { data: r.data, error: r.error };
  };

  const [membersRes, invitesRes, countsRes, salonRes, servicesRes] = await Promise.all([
    membersQuery(),
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
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("salon_id", context.salon.id)
      .order("name"),
  ]);

  const rawMembers = (membersRes.data ?? []) as Record<string, unknown>[];
  const members: Member[] = rawMembers.map((m) => {
    const row = { ...m, has_passcode: Boolean(m.passcode_hash) } as Member & { passcode_hash?: unknown };
    delete (row as Record<string, unknown>).passcode_hash;
    return row as Member;
  });
  const salonServices = (servicesRes.data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    duration_minutes: s.duration_minutes as number,
  }));

  const memberIds = members.map((m) => m.id as string);
  let overridesData: { stylist_id: string; service_id: string; custom_duration_minutes: number }[] = [];
  if (memberIds.length > 0) {
    try {
      const { data } = await supabase
        .from("stylist_service_overrides")
        .select("stylist_id, service_id, custom_duration_minutes")
        .in("stylist_id", memberIds);
      overridesData = (data ?? []) as typeof overridesData;
    } catch {
      // table may not exist yet
    }
  }
  const overridesByMember: Record<string, Record<string, number>> = {};
  for (const o of overridesData) {
    if (!overridesByMember[o.stylist_id]) overridesByMember[o.stylist_id] = {};
    overridesByMember[o.stylist_id][o.service_id] = o.custom_duration_minutes;
  }

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
        salonServices={salonServices}
        overridesByMember={overridesByMember}
      />
    </main>
  );
}
