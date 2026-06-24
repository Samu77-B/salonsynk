import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getMutateClient } from "@core/supabase/mutate-client";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import {
  dedupeOrderedServiceIds,
  syncNailAppointmentServices,
  syncNailAppointmentServiceBillLines,
  type NailAppointmentServiceBillLine,
} from "@modules/nail/lib/appointments/appointment-lines";
import {
  fetchNailAppointmentsForOverlapCheck,
  processingMinutesFromNailOverlapRow,
  type NailOverlapAppointmentRow,
} from "@modules/nail/lib/appointments/overlap-queries";
import {
  hasBlockingOverlapWithExisting,
  rangeToMinutes,
  type AppointmentBlockingInput,
} from "@/lib/diary-rules";

export const NAIL_APPOINTMENT_DB_STATUSES = ["scheduled", "completed", "no_show", "canceled"] as const;
export type NailAppointmentDbStatus = (typeof NAIL_APPOINTMENT_DB_STATUSES)[number];

function normalizeNailAppointmentStatusInput(raw: string): NailAppointmentDbStatus | null {
  const s = raw.trim().toLowerCase();
  if (s === "cancelled") return "canceled";
  return (NAIL_APPOINTMENT_DB_STATUSES as readonly string[]).includes(s) ? (s as NailAppointmentDbStatus) : null;
}

export type UpdateNailAppointmentInput = {
  start_time?: string;
  end_time?: string;
  technician_id?: string;
  client_id?: string | null;
  service_id?: string | null;
  serviceIds?: string[];
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  notes?: string | null;
  allowScheduleOverlap?: boolean;
  status?: NailAppointmentDbStatus | string;
  bill_total_minor?: number | null;
  deposit_amount_minor?: number | null;
  serviceBillLines?: NailAppointmentServiceBillLine[];
};

export async function executePatchNailAppointment(
  id: string,
  updates: UpdateNailAppointmentInput
): Promise<{ error: string | null }> {
  const context = await getCurrentUserNailSalon();
  if (!context) return { error: "Unauthorized" };
  const salonId = context.salon.id;

  const db = await getMutateClient();
  const nextStatus =
    updates.status !== undefined ? normalizeNailAppointmentStatusInput(String(updates.status)) : null;

  if (
    updates.start_time !== undefined ||
    updates.end_time !== undefined ||
    updates.technician_id !== undefined ||
    updates.service_id !== undefined ||
    updates.serviceIds !== undefined ||
    updates.serviceBillLines !== undefined
  ) {
    const { data: current } = await db
      .from("nail_appointments")
      .select("start_time, end_time, technician_id")
      .eq("id", id)
      .eq("salon_id", salonId)
      .single();

    if (!current) return { error: "Appointment not found" };

    const start = new Date(updates.start_time ?? current.start_time);
    const end = new Date(updates.end_time ?? current.end_time);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return { error: "Invalid date or time." };
    }
    const technicianId = updates.technician_id ?? current.technician_id;

    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const existing = await fetchNailAppointmentsForOverlapCheck(
      db,
      salonId,
      technicianId,
      dayStart.toISOString(),
      dayEnd.toISOString()
    );

    async function resolveProcessingServiceIds(): Promise<string[]> {
      if (updates.serviceIds !== undefined) return dedupeOrderedServiceIds(updates.serviceIds);
      if (updates.serviceBillLines !== undefined) {
        return dedupeOrderedServiceIds(updates.serviceBillLines.map((l) => l.serviceId));
      }
      if (updates.service_id !== undefined) return updates.service_id ? [updates.service_id] : [];
      const { data: lines } = await db
        .from("nail_appointment_services")
        .select("service_id, sort_order")
        .eq("appointment_id", id)
        .order("sort_order", { ascending: true });
      const fromJn = (lines ?? [])
        .map((l: { service_id?: string | null }) => l.service_id)
        .filter((x): x is string => typeof x === "string" && x.length > 0);
      if (fromJn.length > 0) return dedupeOrderedServiceIds(fromJn);
      const fk = (
        await db.from("nail_appointments").select("service_id").eq("id", id).eq("salon_id", salonId).single()
      ).data?.service_id as string | null | undefined;
      return fk ? [fk] : [];
    }

    const procIds = await resolveProcessingServiceIds();
    let newProcessing = 0;
    if (procIds.length > 0) {
      const { data: procRows } = await db
        .from("nail_services")
        .select("id, processing_time_minutes")
        .in("id", procIds)
        .eq("salon_id", salonId);
      if (procRows && procRows.length === procIds.length) {
        const pmap = Object.fromEntries(
          procRows.map((r) => [
            (r as { id: string }).id,
            Number((r as { processing_time_minutes?: number }).processing_time_minutes) || 0,
          ])
        );
        newProcessing = Math.max(...procIds.map((sid) => pmap[sid] ?? 0));
      }
    }

    const blockingExisting: AppointmentBlockingInput[] = (existing as NailOverlapAppointmentRow[])
      .filter((row) => row.id !== id)
      .map((row) => {
        const s = new Date(row.start_time);
        const e = new Date(row.end_time);
        const r = rangeToMinutes(s, e);
        return {
          id: row.id,
          startMinutes: r.startMinutes,
          endMinutes: r.endMinutes,
          processingMinutes: processingMinutesFromNailOverlapRow(row),
        };
      });

    const { startMinutes, endMinutes } = rangeToMinutes(start, end);
    if (
      !updates.allowScheduleOverlap &&
      hasBlockingOverlapWithExisting(blockingExisting, startMinutes, endMinutes, newProcessing)
    ) {
      return {
        error:
          "This would overlap with another appointment during hands-on time. Adjust time or tick “Save even if this overlaps another booking” below, then Save again.",
      };
    }
  }

  const payload: Record<string, unknown> = {};
  if (updates.start_time !== undefined) payload.start_time = updates.start_time;
  if (updates.end_time !== undefined) payload.end_time = updates.end_time;
  if (updates.technician_id !== undefined) payload.technician_id = updates.technician_id;
  if (updates.client_id !== undefined) payload.client_id = updates.client_id;
  if (updates.serviceIds !== undefined) {
    const o = dedupeOrderedServiceIds(updates.serviceIds);
    payload.service_id = o.length > 0 ? o[0] : null;
  } else if (updates.serviceBillLines !== undefined) {
    const o = dedupeOrderedServiceIds(updates.serviceBillLines.map((l) => l.serviceId));
    payload.service_id = o.length > 0 ? o[0] : null;
  } else if (updates.service_id !== undefined) payload.service_id = updates.service_id;
  if (updates.guest_name !== undefined) payload.guest_name = updates.guest_name;
  if (updates.guest_email !== undefined) payload.guest_email = updates.guest_email;
  if (updates.guest_phone !== undefined) payload.guest_phone = updates.guest_phone;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.status !== undefined) {
    const st = normalizeNailAppointmentStatusInput(String(updates.status));
    if (!st) return { error: "Invalid appointment status." };
    payload.status = st;
  }
  if (updates.bill_total_minor !== undefined) payload.bill_total_minor = updates.bill_total_minor;
  if (updates.deposit_amount_minor !== undefined) payload.deposit_amount_minor = updates.deposit_amount_minor;

  if (Object.keys(payload).length === 0 && updates.serviceIds === undefined && updates.serviceBillLines === undefined) {
    return { error: null };
  }

  const { error } = await db.from("nail_appointments").update(payload).eq("id", id).eq("salon_id", salonId);

  if (error) return { error: error.message };

  if (updates.serviceIds !== undefined) {
    const syncRes = await syncNailAppointmentServices(db, id, dedupeOrderedServiceIds(updates.serviceIds));
    if (syncRes.error) return { error: syncRes.error };
  } else if (updates.serviceBillLines !== undefined) {
    const syncRes = await syncNailAppointmentServiceBillLines(db, id, updates.serviceBillLines);
    if (syncRes.error) return { error: syncRes.error };
  }

  if (updates.guest_email?.trim() || updates.guest_phone?.trim()) {
    const clientId =
      updates.client_id !== undefined
        ? updates.client_id
        : (await db.from("nail_appointments").select("client_id").eq("id", id).eq("salon_id", salonId).single()).data
            ?.client_id;
    if (clientId) {
      const clientUpdates: Record<string, unknown> = {};
      if (updates.guest_email?.trim()) clientUpdates.email = updates.guest_email.trim();
      if (updates.guest_phone?.trim()) clientUpdates.phone = updates.guest_phone.trim();
      if (Object.keys(clientUpdates).length > 0) {
        await db.from("nail_clients").update(clientUpdates).eq("id", clientId).eq("salon_id", salonId);
      }
    }
  }

  after(() => {
    try {
      revalidatePath("/nail/diary");
    } catch (e) {
      console.error("[executePatchNailAppointment] revalidatePath", e);
    }
  });

  return { error: null };
}
