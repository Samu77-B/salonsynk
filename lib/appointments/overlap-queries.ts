import type { SupabaseClient } from "@supabase/supabase-js";

export type OverlapAppointmentRow = {
  id: string;
  start_time: string;
  end_time: string;
  services?: { processing_time_minutes?: number } | { processing_time_minutes?: number }[] | null;
};

export async function fetchAppointmentsForOverlapCheck(
  db: SupabaseClient,
  salonId: string,
  stylistId: string,
  dayStartIso: string,
  dayEndIso: string
) {
  const withSvc = await db
    .from("appointments")
    .select("id, start_time, end_time, services(processing_time_minutes)")
    .eq("salon_id", salonId)
    .eq("stylist_id", stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);
  if (!withSvc.error) return withSvc.data ?? [];
  const minimal = await db
    .from("appointments")
    .select("id, start_time, end_time")
    .eq("salon_id", salonId)
    .eq("stylist_id", stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);
  return minimal.data ?? [];
}
