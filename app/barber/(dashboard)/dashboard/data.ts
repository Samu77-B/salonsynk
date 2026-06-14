import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { resolveActingBarberId } from "@modules/barber/lib/resolve-barber-id";

export type QueueEntry = {
  id: string;
  shop_id: string;
  guest_name: string | null;
  guest_phone: string | null;
  service_id: string | null;
  preferred_barber_id: string | null;
  assigned_barber_id: string | null;
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

export type BarberMember = {
  id: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  is_accepting_walk_ins: boolean;
  chair_number: number | null;
  avatar_url: string | null;
};

export type BarberService = {
  id: string;
  name: string;
  duration_minutes: number;
  price_minor: number;
};

export async function getBarberDashboardData() {
  const context = await getCurrentUserShop();
  if (!context) return null;

  const shopId = context.shop.id;

  // Use admin client for reliable reads (public joins bypass RLS; members still need to see them).
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  const [queueResult, membersResult, servicesResult, todayStatsResult] =
    await Promise.all([
      supabase
        .from("barber_queue")
        .select("*")
        .eq("shop_id", shopId)
        .in("status", ["waiting", "in_chair"])
        .order("position", { ascending: true }),

      supabase
        .from("barber_members")
        .select("id, display_name, role, is_active, is_accepting_walk_ins, chair_number, avatar_url")
        .eq("shop_id", shopId)
        .eq("is_active", true),

      supabase
        .from("barber_services")
        .select("id, name, duration_minutes, price_minor")
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),

      supabase
        .from("barber_queue")
        .select("id, status, payment_method, amount_paid_minor")
        .eq("shop_id", shopId)
        .eq("status", "completed")
        .gte("completed_at", new Date().toISOString().slice(0, 10)),
    ]);

  const queue = (queueResult.data ?? []) as QueueEntry[];
  const members = (membersResult.data ?? []) as BarberMember[];
  const services = (servicesResult.data ?? []) as BarberService[];

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
    const resolved = await resolveActingBarberId(supabase, shopId, actingMemberId);
    if (resolved.barberId) actingMemberId = resolved.barberId;
  }

  return {
    shop: context.shop,
    member: { ...context.member, id: actingMemberId },
    queue,
    members,
    services,
    stats: { todayServed, todayCash, todayCard, todayRevenue },
  };
}
