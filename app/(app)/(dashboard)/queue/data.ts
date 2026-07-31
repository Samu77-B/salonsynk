import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserSalon } from "@core/supabase/salon";
import { resolveActingStylistId } from "@modules/salon-walk-in/lib/resolve-stylist-id";

export type QueueEntry = {
  id: string;
  salon_id: string;
  guest_name: string | null;
  guest_phone: string | null;
  service_id: string | null;
  preferred_stylist_id: string | null;
  assigned_stylist_id: string | null;
  position: number;
  status: "waiting" | "in_chair" | "completed" | "no_show" | "left";
  payment_method: "card" | "cash" | "other" | null;
  amount_paid_minor: number | null;
  joined_at: string;
  called_at: string | null;
  next_sms_sent_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  estimated_wait_minutes: number | null;
};

export type StylistMember = {
  id: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  is_accepting_walk_ins: boolean;
  avatar_url: string | null;
};

export type SalonServiceOption = {
  id: string;
  name: string;
  duration_minutes: number;
  price_minor: number;
};

export async function getSalonQueueData() {
  const context = await getCurrentUserSalon();
  if (!context) return null;

  const salonId = context.salon.id;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  const [queueResult, membersResult, servicesResult, todayStatsResult] = await Promise.all([
    supabase
      .from("salon_queue")
      .select("*")
      .eq("salon_id", salonId)
      .in("status", ["waiting", "in_chair"])
      .order("position", { ascending: true }),

    supabase
      .from("salon_members")
      .select("id, display_name, role, is_active, is_accepting_walk_ins, avatar_url")
      .eq("salon_id", salonId)
      .eq("is_active", true),

    supabase
      .from("services")
      .select("id, name, duration_minutes, price_minor")
      .eq("salon_id", salonId)
      .order("name"),

    supabase
      .from("salon_queue")
      .select("id, status, payment_method, amount_paid_minor")
      .eq("salon_id", salonId)
      .eq("status", "completed")
      .gte("completed_at", new Date().toISOString().slice(0, 10)),
  ]);

  const queue = (queueResult.data ?? []) as QueueEntry[];
  const members = (membersResult.data ?? []) as StylistMember[];
  const services = (servicesResult.data ?? []) as SalonServiceOption[];

  const todayCompleted = todayStatsResult.data ?? [];
  const todayServed = todayCompleted.length;
  const todayCash = todayCompleted.filter((e) => e.payment_method === "cash").length;
  const todayCard = todayCompleted.filter((e) => e.payment_method === "card").length;
  const todayRevenue = todayCompleted.reduce(
    (sum, e) => sum + ((e as { amount_paid_minor?: number }).amount_paid_minor ?? 0),
    0
  );

  let actingMemberId = context.member.id;
  if (actingMemberId === "admin") {
    const resolved = await resolveActingStylistId(supabase, salonId, actingMemberId);
    if (resolved.stylistId) actingMemberId = resolved.stylistId;
  }

  return {
    salon: context.salon,
    member: { ...context.member, id: actingMemberId },
    queue,
    members,
    services,
    stats: { todayServed, todayCash, todayCard, todayRevenue },
  };
}
