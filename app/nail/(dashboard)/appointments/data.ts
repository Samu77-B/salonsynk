import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";

export type NailAppointment = {
  id: string;
  salon_id: string;
  technician_id: string;
  service_id: string | null;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "no_show" | "canceled";
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  notes: string | null;
  source: string;
};

export type NailBookingMember = {
  id: string;
  display_name: string | null;
  station_number: number | null;
};

export type NailBookingService = {
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

export async function getNailAppointmentsData(dateStr: string) {
  const context = await getCurrentUserNailSalon();
  if (!context) return null;

  const isSuperAdmin = await getIsSuperAdmin();
  const userSb = await createClient();
  let supabase;
  try {
    supabase = isSuperAdmin ? createAdminClient() : userSb;
  } catch {
    supabase = userSb;
  }

  const salonId = context.salon.id;
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const { start, end } = dayBounds(date);
  const nowIso = new Date().toISOString();
  const futureCap = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const [appointmentsResult, upcomingResult, membersResult, servicesResult] = await Promise.all([
    supabase
      .from("nail_appointments")
      .select("*")
      .eq("salon_id", salonId)
      .gte("start_time", start)
      .lte("start_time", end)
      .neq("status", "canceled")
      .order("start_time"),

    supabase
      .from("nail_appointments")
      .select("*")
      .eq("salon_id", salonId)
      .eq("status", "scheduled")
      .gt("start_time", nowIso)
      .lte("start_time", futureCap)
      .order("start_time")
      .limit(25),

    supabase
      .from("nail_members")
      .select("id, display_name, station_number")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("display_name"),

    supabase
      .from("nail_services")
      .select("id, name, duration_minutes, price_minor")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
  ]);

  return {
    salon: context.salon,
    date,
    appointments: (appointmentsResult.data ?? []) as NailAppointment[],
    upcomingAppointments: (upcomingResult.data ?? []) as NailAppointment[],
    members: (membersResult.data ?? []) as NailBookingMember[],
    services: (servicesResult.data ?? []) as NailBookingService[],
  };
}
