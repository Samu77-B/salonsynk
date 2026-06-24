import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { NailTeamView } from "./nail-team-view";
import { NailSalonBrandingForm } from "./nail-salon-branding-form";

export const dynamic = "force-dynamic";

export default async function NailTeamPage() {
  const context = await getCurrentUserNailSalon();
  if (!context) redirect("/onboarding");

  const isOwner = context.member.role === "owner" || context.member.id === "admin";
  if (!isOwner) redirect("/nail/queue");

  const admin = createAdminClient();

  const [salonRes, membersRes, servicesRes] = await Promise.all([
    admin.from("nail_salons").select("settings").eq("id", context.salon.id).single(),
    admin
      .from("nail_members")
      .select(
        "id, user_id, display_name, role, is_active, employment_type, avatar_url, passcode_hash, show_on_diary, station_number, is_accepting_walk_ins"
      )
      .eq("salon_id", context.salon.id)
      .order("role")
      .order("display_name"),
    admin
      .from("nail_services")
      .select("id, name, duration_minutes")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  const settings = (salonRes.data?.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | boolean | undefined>) ?? {};
  const brandingStr = (key: string) => {
    const v = branding[key];
    return typeof v === "string" ? v : "";
  };
  const customRoles = (settings.team_roles as string[]) ?? [];

  const rawMembers = membersRes.data ?? [];
  const members = rawMembers.map((m) => ({
    id: m.id as string,
    user_id: m.user_id as string | null,
    display_name: m.display_name as string | null,
    role: m.role as string,
    is_active: m.is_active as boolean,
    employment_type: m.employment_type as string | undefined,
    avatar_url: m.avatar_url as string | null,
    has_passcode: Boolean(m.passcode_hash),
    show_on_diary: m.show_on_diary as boolean | null,
    station_number: m.station_number as number | null,
    is_accepting_walk_ins: m.is_accepting_walk_ins as boolean,
  }));

  const memberIds = members.map((m) => m.id);
  let overridesData: { technician_id: string; service_id: string; duration_minutes: number }[] = [];
  if (memberIds.length > 0) {
    const { data } = await admin
      .from("nail_technician_service_overrides")
      .select("technician_id, service_id, duration_minutes")
      .in("technician_id", memberIds);
    overridesData = (data ?? []) as typeof overridesData;
  }

  const overridesByMember: Record<string, Record<string, number>> = {};
  for (const o of overridesData) {
    if (!overridesByMember[o.technician_id]) overridesByMember[o.technician_id] = {};
    overridesByMember[o.technician_id][o.service_id] = o.duration_minutes;
  }

  const userIds = [...new Set(members.map((m) => m.user_id).filter(Boolean))] as string[];
  const profilesMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      if (p.email) profilesMap[p.id] = p.email;
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: appointments } = await admin
    .from("nail_appointments")
    .select("technician_id")
    .eq("salon_id", context.salon.id)
    .gte("start_time", thirtyDaysAgo);

  const appointmentCountByTechnician: Record<string, number> = {};
  for (const a of appointments ?? []) {
    if (a.technician_id) {
      appointmentCountByTechnician[a.technician_id] =
        (appointmentCountByTechnician[a.technician_id] ?? 0) + 1;
    }
  }

  const salonServices = (servicesRes.data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    duration_minutes: s.duration_minutes as number,
  }));

  const dbError =
    salonRes.error?.message ?? membersRes.error?.message ?? servicesRes.error?.message;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/nail/queue" className="text-sm text-muted hover:text-foreground">
          ← Live queue
        </Link>
        <h1 className="text-xl font-bold mt-1">Team</h1>
        <p className="text-sm text-muted mt-1">
          Manage technicians, reception staff, diary columns, and walk-in queue visibility.
        </p>
      </div>

      {dbError && (
        <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          Database error: {dbError}
        </p>
      )}

      <NailSalonBrandingForm
        salonName={context.salon.name}
        initialCompanyName={brandingStr("company_name").trim() || context.salon.name}
        initialShowTitle={branding.show_title_on_queue !== false}
      />

      <NailTeamView
        salonId={context.salon.id}
        members={JSON.parse(JSON.stringify(members))}
        memberEmails={profilesMap}
        appointmentCountByTechnician={appointmentCountByTechnician}
        isOwner={isOwner}
        customRoles={customRoles}
        salonServices={salonServices}
        overridesByMember={overridesByMember}
        joinSlug={context.salon.slug}
      />
    </div>
  );
}
