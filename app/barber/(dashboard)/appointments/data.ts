import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserShop } from "@modules/barber/lib/shop";

export type BarberAppointment = {
  id: string;
  shop_id: string;
  barber_id: string;
  service_id: string | null;
  start_time: string;
  end_time: string;
  status: "scheduled" | "in_chair" | "completed" | "no_show" | "canceled";
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  notes: string | null;
  source: string;
};

export type BarberMember = {
  id: string;
  display_name: string | null;
  chair_number: number | null;
};

export type BarberService = {
  id: string;
  name: string;
  duration_minutes: number;
  price_minor: number;
};

function dayBounds(dateStr: string) {
  const start = new Date(dateStr + "T00:00:00");
  const end = new Date(dateStr + "T23:59:59");
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getBarberAppointmentsData(dateStr: string) {
  const context = await getCurrentUserShop();
  if (!context) return null;

  const isSuperAdmin = await getIsSuperAdmin();
  const userSb = await createClient();
  let supabase;
  try {
    supabase = isSuperAdmin ? createAdminClient() : userSb;
  } catch {
    supabase = userSb;
  }

  const shopId = context.shop.id;
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const { start, end } = dayBounds(date);
  const nowIso = new Date().toISOString();
  const futureCap = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const [appointmentsResult, upcomingResult, membersResult, servicesResult] = await Promise.all([
    supabase
      .from("barber_appointments")
      .select("*")
      .eq("shop_id", shopId)
      .gte("start_time", start)
      .lte("start_time", end)
      .neq("status", "canceled")
      .order("start_time"),

    supabase
      .from("barber_appointments")
      .select("*")
      .eq("shop_id", shopId)
      .eq("status", "scheduled")
      .gt("start_time", nowIso)
      .lte("start_time", futureCap)
      .order("start_time")
      .limit(25),

    supabase
      .from("barber_members")
      .select("id, display_name, chair_number")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("display_name"),

    supabase
      .from("barber_services")
      .select("id, name, duration_minutes, price_minor")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
  ]);

  return {
    shop: context.shop,
    date,
    appointments: (appointmentsResult.data ?? []) as BarberAppointment[],
    upcomingAppointments: (upcomingResult.data ?? []) as BarberAppointment[],
    members: (membersResult.data ?? []) as BarberMember[],
    services: (servicesResult.data ?? []) as BarberService[],
  };
}
