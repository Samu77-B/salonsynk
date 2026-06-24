import type { SupabaseClient } from "@supabase/supabase-js";
import { maxProcessingFromOverlapRow } from "./appointment-lines";

export type NailOverlapAppointmentRow = {
  id: string;
  start_time: string;
  end_time: string;
  services?: unknown;
  nail_appointment_services?: unknown;
};

const SELECT_WITH_LINES = `
  id, start_time, end_time,
  nail_services(processing_time_minutes),
  nail_appointment_services(sort_order, nail_services(processing_time_minutes))
`;

const SELECT_LEGACY = `
  id, start_time, end_time, nail_services(processing_time_minutes)
`;

export async function fetchNailAppointmentsForOverlapCheck(
  db: SupabaseClient,
  salonId: string,
  technicianId: string,
  dayStartIso: string,
  dayEndIso: string
) {
  const withLines = await db
    .from("nail_appointments")
    .select(SELECT_WITH_LINES)
    .eq("salon_id", salonId)
    .eq("technician_id", technicianId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);

  if (!withLines.error) return withLines.data ?? [];

  const minimal = await db
    .from("nail_appointments")
    .select(SELECT_LEGACY)
    .eq("salon_id", salonId)
    .eq("technician_id", technicianId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);

  if (!minimal.error) return minimal.data ?? [];

  const bare = await db
    .from("nail_appointments")
    .select("id, start_time, end_time")
    .eq("salon_id", salonId)
    .eq("technician_id", technicianId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);
  return bare.data ?? [];
}

export function processingMinutesFromNailOverlapRow(row: NailOverlapAppointmentRow): number {
  const adapted = {
    ...row,
    appointment_services: row.nail_appointment_services,
    services: row.services,
  };
  return maxProcessingFromOverlapRow(adapted);
}
