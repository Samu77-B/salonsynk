import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getMutateClient } from "@/lib/supabase/mutate-client";
import { fetchAppointmentsForOverlapCheck, type OverlapAppointmentRow } from "./overlap-queries";
import {
  hasBlockingOverlapWithExisting,
  rangeToMinutes,
  type AppointmentBlockingInput,
} from "@/lib/diary-rules";
import { revalidatePath } from "next/cache";
import { sendClientBookingConfirmation } from "@/lib/booking-notifications";

export type CreateAppointmentInput = {
  salonId: string;
  stylistId: string;
  clientId: string | null;
  serviceId: string | null;
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

  let newProcessing = 0;
  if (input.serviceId) {
    const { data: svc } = await db
      .from("services")
      .select("processing_time_minutes")
      .eq("id", input.serviceId)
      .eq("salon_id", input.salonId)
      .maybeSingle();
    newProcessing = Number(svc?.processing_time_minutes) || 0;
  }

  const blockingExisting: AppointmentBlockingInput[] = (existing as OverlapAppointmentRow[]).map((row) => {
    const s = new Date(row.start_time);
    const e = new Date(row.end_time);
    const r = rangeToMinutes(s, e);
    const svc = row.services as { processing_time_minutes?: number } | { processing_time_minutes?: number }[] | null;
    const proc = Array.isArray(svc) ? svc[0]?.processing_time_minutes : svc?.processing_time_minutes;
    return {
      id: row.id,
      startMinutes: r.startMinutes,
      endMinutes: r.endMinutes,
      processingMinutes: Number(proc) || 0,
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

  const row: Record<string, unknown> = {
    salon_id: input.salonId,
    stylist_id: input.stylistId,
    client_id: input.clientId || null,
    service_id: input.serviceId || null,
    start_time: input.startTime,
    end_time: input.endTime,
    guest_name: input.guestName || null,
    guest_email: input.guestEmail || null,
    guest_phone: input.guestPhone || null,
    notes: input.notes || null,
    status: "scheduled",
  };
  if (input.sendReminderSms !== undefined) row.send_reminder_sms = input.sendReminderSms;
  if (input.sendReviewRequest !== undefined) row.send_review_request = input.sendReviewRequest;
  if (input.sendAftercare !== undefined) row.send_aftercare = input.sendAftercare;

  const { data: inserted, error } = await db.from("appointments").insert(row).select("id").single();

  if (error) return { error: error.message };
  const appointmentId = (inserted as { id?: string } | null)?.id;
  if (!appointmentId) return { error: "Could not read new appointment id." };

  let serviceName: string | null = null;
  if (input.serviceId) {
    const { data: svc } = await db
      .from("services")
      .select("name")
      .eq("id", input.serviceId)
      .eq("salon_id", input.salonId)
      .maybeSingle();
    serviceName = (svc as { name?: string } | null)?.name ?? null;
  }

  void sendClientBookingConfirmation({
    email: input.guestEmail,
    phone: input.guestPhone,
    salonName: context.salon.name,
    start,
    serviceName,
  });

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
