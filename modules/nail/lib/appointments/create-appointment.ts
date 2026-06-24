import { revalidatePath } from "next/cache";
import { getMutateClient } from "@core/supabase/mutate-client";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import {
  dedupeOrderedServiceIds,
  syncNailAppointmentServices,
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

export type CreateNailAppointmentInput = {
  salonId: string;
  technicianId: string;
  clientId: string | null;
  serviceId: string | null;
  serviceIds?: string[];
  startTime: string;
  endTime: string;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  notes?: string | null;
  allowScheduleOverlap?: boolean;
};

export type CreateNailAppointmentResult =
  | { error: string }
  | { error: null; appointmentId: string };

export async function executeCreateNailAppointment(
  input: CreateNailAppointmentInput
): Promise<CreateNailAppointmentResult> {
  const context = await getCurrentUserNailSalon();
  if (!context || context.salon.id !== input.salonId) return { error: "Unauthorized" };

  const db = await getMutateClient();

  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return { error: "Invalid date or time." };
  }

  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const existing = await fetchNailAppointmentsForOverlapCheck(
    db,
    input.salonId,
    input.technicianId,
    dayStart.toISOString(),
    dayEnd.toISOString()
  );

  const orderedSvc = dedupeOrderedServiceIds(
    input.serviceIds !== undefined ? input.serviceIds : input.serviceId ? [input.serviceId] : []
  );

  let newProcessing = 0;
  if (orderedSvc.length > 0) {
    const { data: procRows, error: procErr } = await db
      .from("nail_services")
      .select("id, processing_time_minutes")
      .in("id", orderedSvc)
      .eq("salon_id", input.salonId);
    if (procErr || !procRows || procRows.length !== orderedSvc.length) {
      return { error: "One or more services are invalid for this salon." };
    }
    const pmap = Object.fromEntries(
      procRows.map((r) => [
        (r as { id: string }).id,
        Number((r as { processing_time_minutes?: number }).processing_time_minutes) || 0,
      ])
    );
    newProcessing = Math.max(...orderedSvc.map((sid) => pmap[sid] ?? 0));
  }

  const blockingExisting: AppointmentBlockingInput[] = (existing as NailOverlapAppointmentRow[]).map((row) => {
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
    !input.allowScheduleOverlap &&
    hasBlockingOverlapWithExisting(blockingExisting, startMinutes, endMinutes, newProcessing)
  ) {
    return {
      error:
        "This would overlap with another appointment during hands-on time. If the service has processing time, another booking can sit in that window — set processing minutes on the service in Settings. To add anyway, tick “Add even if this overlaps another booking” below, then press Add again.",
    };
  }

  const primaryServiceId = orderedSvc[0] ?? input.serviceId ?? null;

  const row: Record<string, unknown> = {
    salon_id: input.salonId,
    technician_id: input.technicianId,
    client_id: input.clientId || null,
    service_id: primaryServiceId,
    start_time: input.startTime,
    end_time: input.endTime,
    guest_name: input.guestName || null,
    guest_email: input.guestEmail || null,
    guest_phone: input.guestPhone || null,
    notes: input.notes || null,
    status: "scheduled",
    source: "diary",
  };

  const { data: inserted, error } = await db.from("nail_appointments").insert(row).select("id").single();

  if (error) return { error: error.message };
  const appointmentId = (inserted as { id?: string } | null)?.id;
  if (!appointmentId) return { error: "Could not read new appointment id." };

  const syn = await syncNailAppointmentServices(db, appointmentId, orderedSvc);
  if (syn.error) {
    await db.from("nail_appointments").delete().eq("id", appointmentId);
    return { error: syn.error };
  }

  if (input.clientId && (input.guestEmail?.trim() || input.guestPhone?.trim())) {
    const clientUpdates: Record<string, unknown> = {};
    if (input.guestEmail?.trim()) clientUpdates.email = input.guestEmail.trim();
    if (input.guestPhone?.trim()) clientUpdates.phone = input.guestPhone.trim();
    if (Object.keys(clientUpdates).length > 0) {
      await db
        .from("nail_clients")
        .update(clientUpdates)
        .eq("id", input.clientId)
        .eq("salon_id", input.salonId);
    }
  }

  try {
    revalidatePath("/nail/diary");
  } catch {
    /* revalidatePath may not be available in Route Handler context */
  }

  return { error: null, appointmentId };
}
