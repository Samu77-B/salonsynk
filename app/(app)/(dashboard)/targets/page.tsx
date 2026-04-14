import { redirect } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { canViewReports } from "@/lib/dashboard-roles";
import { TargetsView } from "./targets-view";

export const dynamic = "force-dynamic";

export default async function TargetsPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const isSuperAdmin = await getIsSuperAdmin();
  const role = context.member.role ?? "";

  if (!canViewReports(isSuperAdmin, role)) {
    return (
      <main className="mx-auto w-full min-w-0 p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-3">Targets & Incentives</h1>
        <p className="text-sm text-muted">
          Targets are available to owners and manager roles only.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const isOwner = role === "owner" || isSuperAdmin;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [membersRes, targetsRes, weeklySalesRes, monthlySalesRes, weeklyApptsRes, monthlyApptsRes, incentivesRes, clientsRes] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, display_name, role, avatar_url")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("display_name"),
    supabase
      .from("staff_targets")
      .select("id, member_id, target_type, target_value, period, is_active")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true),
    supabase
      .from("sales_transactions")
      .select("amount_minor, salon_members(id)")
      .eq("salon_id", context.salon.id)
      .gte("paid_at", weekStart.toISOString())
      .lt("paid_at", weekEnd.toISOString()),
    supabase
      .from("sales_transactions")
      .select("amount_minor, salon_members(id)")
      .eq("salon_id", context.salon.id)
      .gte("paid_at", monthStart.toISOString())
      .lt("paid_at", monthEnd.toISOString()),
    supabase
      .from("appointments")
      .select("stylist_id")
      .eq("salon_id", context.salon.id)
      .eq("status", "completed")
      .gte("start_time", weekStart.toISOString())
      .lt("start_time", weekEnd.toISOString()),
    supabase
      .from("appointments")
      .select("stylist_id")
      .eq("salon_id", context.salon.id)
      .eq("status", "completed")
      .gte("start_time", monthStart.toISOString())
      .lt("start_time", monthEnd.toISOString()),
    supabase
      .from("client_incentives")
      .select("id, client_id, points, total_visits, tier, last_reward_at")
      .eq("salon_id", context.salon.id)
      .order("points", { ascending: false })
      .limit(50),
    supabase
      .from("clients")
      .select("id, name, email")
      .eq("salon_id", context.salon.id)
      .order("name"),
  ]);

  type SalesRow = { amount_minor: number; salon_members: { id: string } | { id: string }[] | null };

  function buildRevenueByMember(rows: SalesRow[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const member = Array.isArray(r.salon_members) ? r.salon_members[0] : r.salon_members;
      const id = member?.id;
      if (id) map[id] = (map[id] ?? 0) + Number(r.amount_minor ?? 0);
    }
    return map;
  }

  function buildApptsByMember(rows: { stylist_id: string | null }[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (r.stylist_id) map[r.stylist_id] = (map[r.stylist_id] ?? 0) + 1;
    }
    return map;
  }

  const weeklyRevenue = buildRevenueByMember((weeklySalesRes.data ?? []) as SalesRow[]);
  const monthlyRevenue = buildRevenueByMember((monthlySalesRes.data ?? []) as SalesRow[]);
  const weeklyAppts = buildApptsByMember(weeklyApptsRes.data ?? []);
  const monthlyAppts = buildApptsByMember(monthlyApptsRes.data ?? []);

  const members = (membersRes.data ?? []).map((m) => ({
    id: m.id as string,
    display_name: (m.display_name as string) || "Unnamed",
    role: m.role as string,
    avatar_url: (m.avatar_url as string | null) ?? null,
  }));

  const targets = (targetsRes.data ?? []).map((t) => ({
    id: t.id as string,
    member_id: t.member_id as string,
    target_type: t.target_type as "revenue" | "appointments" | "retail",
    target_value: t.target_value as number,
    period: t.period as "weekly" | "monthly",
    is_active: t.is_active as boolean,
  }));

  const progress: Record<string, { weeklyRevenue: number; monthlyRevenue: number; weeklyAppts: number; monthlyAppts: number }> = {};
  for (const m of members) {
    progress[m.id] = {
      weeklyRevenue: weeklyRevenue[m.id] ?? 0,
      monthlyRevenue: monthlyRevenue[m.id] ?? 0,
      weeklyAppts: weeklyAppts[m.id] ?? 0,
      monthlyAppts: monthlyAppts[m.id] ?? 0,
    };
  }

  const clientsMap: Record<string, { name: string; email: string | null }> = {};
  for (const c of clientsRes.data ?? []) {
    clientsMap[c.id] = { name: (c.name as string) || "Unnamed", email: c.email as string | null };
  }

  const incentives = (incentivesRes.data ?? []).map((i) => ({
    id: i.id as string,
    client_id: i.client_id as string,
    points: i.points as number,
    total_visits: i.total_visits as number,
    tier: i.tier as string,
    last_reward_at: i.last_reward_at as string | null,
  }));

  return (
    <main className="mx-auto w-full min-w-0 space-y-6 p-4 md:p-6">
      <Reveal>
        <div>
          <h1 className="text-2xl font-bold">Targets & Incentives</h1>
          <p className="text-sm text-muted">Staff performance targets and client loyalty</p>
        </div>
      </Reveal>
      <Reveal>
        <TargetsView
          salonId={context.salon.id}
          members={members}
          targets={targets}
          progress={progress}
          incentives={incentives}
          clientsMap={clientsMap}
          isOwner={isOwner}
        />
      </Reveal>
    </main>
  );
}
