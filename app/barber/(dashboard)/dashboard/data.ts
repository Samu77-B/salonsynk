import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { hasQueueManagerAccess } from "@core/queue/platform-queue-access";
import { resolveActingBarberId } from "@modules/barber/lib/resolve-barber-id";
import {
  parseManagerNotificationSettings,
  type BarberManagerNotificationSettings,
} from "@modules/barber/lib/manager-notifications";

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

export type TodayAppointment = {
  id: string;
  barber_id: string;
  service_id: string | null;
  start_time: string;
  end_time: string;
  status: "scheduled" | "in_chair" | "completed" | "no_show" | "canceled";
  guest_name: string | null;
  guest_phone: string | null;
  notes: string | null;
};

export type { BarberManagerNotificationSettings };

function todayBounds() {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(today + "T00:00:00");
  const end = new Date(today + "T23:59:59");
  return { start: start.toISOString(), end: end.toISOString() };
}

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

  const { start: todayStart, end: todayEnd } = todayBounds();

  const [queueResult, membersResult, servicesResult, todayStatsResult, todayAppointmentsResult, futureBookingsResult, shopSettingsResult] =
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

      supabase
        .from("barber_appointments")
        .select("id, barber_id, service_id, start_time, end_time, status, guest_name, guest_phone, notes")
        .eq("shop_id", shopId)
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd)
        .in("status", ["scheduled", "in_chair"])
        .order("start_time"),

      supabase
        .from("barber_appointments")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .eq("status", "scheduled")
        .gt("start_time", todayEnd),

      supabase
        .from("barber_shops")
        .select("settings")
        .eq("id", shopId)
        .maybeSingle(),
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

  const todayAppointments = (todayAppointmentsResult.data ?? []) as TodayAppointment[];
  const futureBookingsCount = futureBookingsResult.count ?? 0;
  const managerNotifications = parseManagerNotificationSettings(
    (shopSettingsResult.data?.settings as Record<string, unknown>) ?? null
  );

  const isSuperAdmin = await getIsSuperAdmin();
  const isManagerView = hasQueueManagerAccess(
    isSuperAdmin,
    context.member.role ?? "",
    context.member.id
  );

  return {
    shop: context.shop,
    member: { ...context.member, id: actingMemberId },
    isManagerView,
    queue,
    members,
    services,
    todayAppointments,
    futureBookingsCount,
    managerNotifications,
    stats: { todayServed, todayCash, todayCard, todayRevenue },
  };
}
