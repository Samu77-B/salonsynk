import type { SupabaseClient } from "@supabase/supabase-js";

/** Deduplicate while preserving order. */
export function dedupeOrderedServiceIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = typeof id === "string" ? id.trim() : "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export type AppointmentServiceBillLine = {
  serviceId: string;
  priceOverrideMinor?: number | null;
  assignedStylistId?: string | null;
};

/**
 * Replace junction rows with optional per-line billing fields.
 */
export async function syncAppointmentServiceBillLines(
  db: SupabaseClient,
  appointmentId: string,
  lines: AppointmentServiceBillLine[]
): Promise<{ error: string | null }> {
  const ordered = dedupeOrderedServiceIds(lines.map((l) => l.serviceId));
  const { error: delErr } = await db.from("appointment_services").delete().eq("appointment_id", appointmentId);
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
    if (line?.assignedStylistId) row.assigned_stylist_id = line.assignedStylistId;
    return row;
  });

  const { error } = await db.from("appointment_services").insert(rows);
  if (error) {
    const msg = error.message ?? "";
    if (/price_override_minor|assigned_stylist_id|does not exist|42703/i.test(msg)) {
      return syncAppointmentServices(db, appointmentId, ordered);
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function syncAppointmentServices(
  db: SupabaseClient,
  appointmentId: string,
  serviceIdsOrdered: string[]
): Promise<{ error: string | null }> {
  const { error: delErr } = await db.from("appointment_services").delete().eq("appointment_id", appointmentId);
  if (delErr) {
    const msg = delErr.message ?? "";
    if (/relation|does not exist|42P01/i.test(msg)) return { error: null };
    return { error: delErr.message };
  }
  if (serviceIdsOrdered.length === 0) return { error: null };
  const { error } = await db.from("appointment_services").insert(
    serviceIdsOrdered.map((service_id, sort_order) => ({
      appointment_id: appointmentId,
      service_id,
      sort_order,
    }))
  );
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Max processing minutes across linked services (junction + legacy FK).
 */
export function maxProcessingFromOverlapRow(row: unknown): number {
  const r = row as {
    services?: { processing_time_minutes?: number } | { processing_time_minutes?: number }[] | null;
    appointment_services?: unknown;
  };

  let maxP = 0;
  const top = r.services as { processing_time_minutes?: number } | { processing_time_minutes?: number }[] | undefined;
  const topProc = Array.isArray(top) ? top[0]?.processing_time_minutes : top?.processing_time_minutes;
  maxP = Math.max(maxP, Number(topProc) || 0);

  const lines = r.appointment_services;
  const arr = Array.isArray(lines) ? lines : [];
  for (const line of arr) {
    const l = line as { services?: { processing_time_minutes?: number } | null };
    const svc = l.services as { processing_time_minutes?: number } | undefined;
    maxP = Math.max(maxP, Number(svc?.processing_time_minutes) || 0);
  }
  return maxP;
}
