import type { SupabaseClient } from "@supabase/supabase-js";
import { maxProcessingFromOverlapRow } from "./appointment-service-lines";

export type OverlapAppointmentRow = {
  id: string;
  start_time: string;
  end_time: string;
  services?: unknown;
  appointment_services?: unknown;
};

const SELECT_WITH_LINES = `
  id, start_time, end_time,
  services(processing_time_minutes),
  appointment_services(sort_order, services(processing_time_minutes))
`;

const SELECT_LEGACY = `
  id, start_time, end_time, services(processing_time_minutes)
`;

export async function fetchAppointmentsForOverlapCheck(
  db: SupabaseClient,
  salonId: string,
  stylistId: string,
  dayStartIso: string,
  dayEndIso: string
) {
  const withLines = await db
    .from("appointments")
    .select(SELECT_WITH_LINES)
    .eq("salon_id", salonId)
    .eq("stylist_id", stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);

  if (!withLines.error) return withLines.data ?? [];

  const minimal = await db
    .from("appointments")
    .select(SELECT_LEGACY)
    .eq("salon_id", salonId)
    .eq("stylist_id", stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);

  if (!minimal.error) return minimal.data ?? [];

  const bare = await db
    .from("appointments")
    .select("id, start_time, end_time")
    .eq("salon_id", salonId)
    .eq("stylist_id", stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);
  return bare.data ?? [];
}

/** Prefer max processing among junction-linked services vs legacy FK. */
export function processingMinutesFromOverlapRow(row: OverlapAppointmentRow): number {
  return maxProcessingFromOverlapRow(row as unknown);
}
