import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getMutateClient } from "@/lib/supabase/mutate-client";
import {
  fetchAppointmentsForOverlapCheck,
  processingMinutesFromOverlapRow,
  type OverlapAppointmentRow,
} from "./overlap-queries";
import { dedupeOrderedServiceIds, syncAppointmentServices } from "./appointment-service-lines";
import {
  hasBlockingOverlapWithExisting,
  rangeToMinutes,
  type AppointmentBlockingInput,
} from "@/lib/diary-rules";
import { revalidatePath } from "next/cache";
import { sendClientBookingConfirmation } from "@/lib/booking-notifications";
import { triggerBookingConfirmation } from "@/lib/appointment-automation";

export type CreateAppointmentInput = {
  salonId: string;
  stylistId: string;
  clientId: string | null;
  serviceId: string | null;
  /** When set, replaces single serviceId — combined visit; first service is mirrored to appointments.service_id. */
  serviceIds?: string[];
  startTime: string;
  endTime: string;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  notes?: string | null;
  sendReminderSms?: boolean;
  sendReviewRequest?: boolean;
  sendAftercare?: boolean;
  allowScheduleOverlap?: boolean;
  /** Client prefers minimal conversation (stored as silent_service on the row). */
  silentService?: boolean;
};

export type CreateAppointmentResult =
  | { error: string }
  | { error: null; appointmentId: string };

export async function executeCreateAppointment(
  input: CreateAppointmentInput
): Promise<CreateAppointmentResult> {
  const context = await getCurrentUserSalon();
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

  const existing = await fetchAppointmentsForOverlapCheck(
    db,
    input.salonId,
    input.stylistId,
    dayStart.toISOString(),
    dayEnd.toISOString()
  );

  const orderedSvc = dedupeOrderedServiceIds(
    input.serviceIds !== undefined ? input.serviceIds : input.serviceId ? [input.serviceId] : []
  );

  let newProcessing = 0;
  if (orderedSvc.length > 0) {
    const { data: procRows, error: procErr } = await db
      .from("services")
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

  const blockingExisting: AppointmentBlockingInput[] = (existing as OverlapAppointmentRow[]).map((row) => {
    const s = new Date(row.start_time);
    const e = new Date(row.end_time);
    const r = rangeToMinutes(s, e);
    return {
      id: row.id,
      startMinutes: r.startMinutes,
      endMinutes: r.endMinutes,
      processingMinutes: processingMinutesFromOverlapRow(row),
    };
  });

  const { startMinutes, endMinutes } = rangeToMinutes(start, end);
  if (
    !input.allowScheduleOverlap &&
    hasBlockingOverlapWithExisting(blockingExisting, startMinutes, endMinutes, newProcessing)
  ) {
    return {
      error:
        "This would overlap with another appointment during hands-on time. If the service has processing time (e.g. colour developing), another booking can sit in that window \u2014 set processing minutes on the service in Settings. To add a walk-in anyway, tick \u201cAdd even if this overlaps another booking\u201d directly below, then press Add again.",
    };
  }

  const primaryServiceId = orderedSvc[0] ?? input.serviceId ?? null;

  const row: Record<string, unknown> = {
    salon_id: input.salonId,
    stylist_id: input.stylistId,
    client_id: input.clientId || null,
    service_id: primaryServiceId,
    start_time: input.startTime,
    end_time: input.endTime,
    guest_name: input.guestName || null,
    guest_email: input.guestEmail || null,
    guest_phone: input.guestPhone || null,
    notes: input.notes || null,
    status: "scheduled",
    silent_service: input.silentService === true,
  };
  if (input.sendReminderSms !== undefined) row.send_reminder_sms = input.sendReminderSms;
  if (input.sendReviewRequest !== undefined) row.send_review_request = input.sendReviewRequest;
  if (input.sendAftercare !== undefined) row.send_aftercare = input.sendAftercare;

  const { data: inserted, error } = await db.from("appointments").insert(row).select("id").single();

  if (error) return { error: error.message };
  const appointmentId = (inserted as { id?: string } | null)?.id;
  if (!appointmentId) return { error: "Could not read new appointment id." };

  let serviceName: string | null = null;
  const nameIds = orderedSvc.length > 0 ? orderedSvc : input.serviceId ? [input.serviceId] : [];
  if (nameIds.length > 0) {
    const { data: nameRows } = await db
      .from("services")
      .select("id, name")
      .in("id", nameIds)
      .eq("salon_id", input.salonId);
    const nmap = Object.fromEntries(
      (nameRows ?? []).map((n) => [(n as { id: string }).id, (n as { name?: string }).name ?? ""])
    );
    const namesOrdered = nameIds.map((id) => nmap[id]).filter(Boolean);
    serviceName =
      namesOrdered.length === 0
        ? null
        : namesOrdered.length <= 4
          ? namesOrdered.join(" · ")
          : `${namesOrdered.slice(0, 4).join(" · ")}…`;
  }

  const syn = await syncAppointmentServices(db, appointmentId, orderedSvc);
  if (syn.error) {
    await db.from("appointments").delete().eq("id", appointmentId);
    return { error: syn.error };
  }

  void sendClientBookingConfirmation({
    email: input.guestEmail,
    phone: input.guestPhone,
    salonName: context.salon.name,
    start,
    serviceName,
  });
  void triggerBookingConfirmation(appointmentId);

  if (input.clientId && (input.guestEmail?.trim() || input.guestPhone?.trim())) {
    const clientUpdates: Record<string, unknown> = {};
    if (input.guestEmail?.trim()) clientUpdates.email = input.guestEmail.trim();
    if (input.guestPhone?.trim()) clientUpdates.phone = input.guestPhone.trim();
    if (Object.keys(clientUpdates).length > 0) {
      await db
        .from("clients")
        .update(clientUpdates)
        .eq("id", input.clientId)
        .eq("salon_id", input.salonId);
      try {
        revalidatePath("/clients");
        revalidatePath(`/clients/${input.clientId}`);
      } catch { /* revalidatePath may not be available in Route Handler context */ }
    }
  }

  try {
    revalidatePath("/dashboard");
  } catch { /* revalidatePath may not be available in Route Handler context */ }

  return { error: null, appointmentId };
}
