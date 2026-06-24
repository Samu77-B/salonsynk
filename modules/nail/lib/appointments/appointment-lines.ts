import type { SupabaseClient } from "@supabase/supabase-js";

export { dedupeOrderedServiceIds, maxProcessingFromOverlapRow } from "@/lib/appointments/appointment-service-lines";

export type NailAppointmentServiceBillLine = {
  serviceId: string;
  priceOverrideMinor?: number | null;
  assignedTechnicianId?: string | null;
};

export async function syncNailAppointmentServiceBillLines(
  db: SupabaseClient,
  appointmentId: string,
  lines: NailAppointmentServiceBillLine[]
): Promise<{ error: string | null }> {
  const { dedupeOrderedServiceIds } = await import("@/lib/appointments/appointment-service-lines");
  const ordered = dedupeOrderedServiceIds(lines.map((l) => l.serviceId));
  const { error: delErr } = await db.from("nail_appointment_services").delete().eq("appointment_id", appointmentId);
  if (delErr) {
    const msg = delErr.message ?? "";
    if (/relation|does not exist|42P01/i.test(msg)) return { error: null };
    return { error: delErr.message };
  }
  if (ordered.length === 0) return { error: null };

  const lineByService = new Map(lines.map((l) => [l.serviceId, l]));
  const rows = ordered.map((service_id, sort_order) => {
    const line = lineByService.get(service_id);
    const row: Record<string, unknown> = {
      appointment_id: appointmentId,
      service_id,
      sort_order,
    };
    if (line?.priceOverrideMinor != null) row.price_override_minor = line.priceOverrideMinor;
    if (line?.assignedTechnicianId) row.assigned_technician_id = line.assignedTechnicianId;
    return row;
  });

  const { error } = await db.from("nail_appointment_services").insert(rows);
  if (error) {
    const msg = error.message ?? "";
    if (/price_override_minor|assigned_technician_id|does not exist|42703/i.test(msg)) {
      return syncNailAppointmentServices(db, appointmentId, ordered);
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function syncNailAppointmentServices(
  db: SupabaseClient,
  appointmentId: string,
  serviceIdsOrdered: string[]
): Promise<{ error: string | null }> {
  const { error: delErr } = await db.from("nail_appointment_services").delete().eq("appointment_id", appointmentId);
  if (delErr) {
    const msg = delErr.message ?? "";
    if (/relation|does not exist|42P01/i.test(msg)) return { error: null };
    return { error: delErr.message };
  }
  if (serviceIdsOrdered.length === 0) return { error: null };
  const { error } = await db.from("nail_appointment_services").insert(
    serviceIdsOrdered.map((service_id, sort_order) => ({
      appointment_id: appointmentId,
      service_id,
      sort_order,
    }))
  );
  if (error) return { error: error.message };
  return { error: null };
}
