import { revalidatePath } from "next/cache";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getMutateClient } from "@/lib/supabase/mutate-client";
import {
  hasBlockingOverlapWithExisting,
  rangeToMinutes,
  type AppointmentBlockingInput,
} from "@/lib/diary-rules";
import { fetchAppointmentsForOverlapCheck, type OverlapAppointmentRow } from "./overlap-queries";

/** Values allowed by DB check on `appointments.status` (US spelling for canceled). */
export const APPOINTMENT_DB_STATUSES = ["scheduled", "completed", "no_show", "canceled"] as const;
export type AppointmentDbStatus = (typeof APPOINTMENT_DB_STATUSES)[number];

function normalizeAppointmentStatusInput(raw: string): AppointmentDbStatus | null {
  const s = raw.trim().toLowerCase();
  if (s === "cancelled") return "canceled";
  return (APPOINTMENT_DB_STATUSES as readonly string[]).includes(s) ? (s as AppointmentDbStatus) : null;
}

export type UpdateAppointmentInput = {
  start_time?: string;
  end_time?: string;
  stylist_id?: string;
  client_id?: string | null;
  service_id?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  notes?: string | null;
  send_reminder_sms?: boolean;
  send_review_request?: boolean;
  send_aftercare?: boolean;
  before_photo_url?: string | null;
  after_photo_url?: string | null;
  allowScheduleOverlap?: boolean;
  status?: AppointmentDbStatus | string;
};

/**
 * Core appointment PATCH used by the REST route (preferred for diary saves) and optionally by server actions.
 * Uses sync revalidatePath — safe in Route Handlers and avoids server-action response bugs.
 */
export async function executeAppointmentPatch(
  id: string,
  updates: UpdateAppointmentInput
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  const db = await getMutateClient();

  if (updates.start_time !== undefined || updates.end_time !== undefined || updates.stylist_id !== undefined) {
    const { data: current } = await db
      .from("appointments")
      .select("start_time, end_time, stylist_id")
      .eq("id", id)
      .eq("salon_id", context.salon.id)
      .single();

    if (!current) return { error: "Appointment not found" };

    const start = new Date(updates.start_time ?? current.start_time);
    const end = new Date(updates.end_time ?? current.end_time);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return { error: "Invalid date or time." };
    }
    const stylistId = updates.stylist_id ?? current.stylist_id;

    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const existing = await fetchAppointmentsForOverlapCheck(
      db,
      context.salon.id,
      stylistId,
      dayStart.toISOString(),
      dayEnd.toISOString()
    );

    const serviceIdForProc =
      updates.service_id !== undefined
        ? updates.service_id
        : (
            await db
              .from("appointments")
              .select("service_id")
              .eq("id", id)
              .eq("salon_id", context.salon.id)
              .single()
          ).data?.service_id;

    let newProcessing = 0;
    if (serviceIdForProc) {
      const { data: svc } = await db
        .from("services")
        .select("processing_time_minutes")
        .eq("id", serviceIdForProc)
        .eq("salon_id", context.salon.id)
        .maybeSingle();
      newProcessing = Number(svc?.processing_time_minutes) || 0;
    }

    const blockingExisting: AppointmentBlockingInput[] = (existing as OverlapAppointmentRow[])
      .filter((row) => row.id !== id)
      .map((row) => {
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
      !updates.allowScheduleOverlap &&
      hasBlockingOverlapWithExisting(blockingExisting, startMinutes, endMinutes, newProcessing)
    ) {
      return {
        error:
          "This would overlap with another appointment during hands-on time. Adjust time or use a service with processing time so another client can sit during developing. To keep this time anyway, tick “Save even if this overlaps another booking” directly below, then Save again.",
      };
    }
  }

  const payload: Record<string, unknown> = {};
  if (updates.start_time !== undefined) payload.start_time = updates.start_time;
  if (updates.end_time !== undefined) payload.end_time = updates.end_time;
  if (updates.stylist_id !== undefined) payload.stylist_id = updates.stylist_id;
  if (updates.client_id !== undefined) payload.client_id = updates.client_id;
  if (updates.service_id !== undefined) payload.service_id = updates.service_id;
  if (updates.guest_name !== undefined) payload.guest_name = updates.guest_name;
  if (updates.guest_email !== undefined) payload.guest_email = updates.guest_email;
  if (updates.guest_phone !== undefined) payload.guest_phone = updates.guest_phone;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.send_reminder_sms !== undefined) payload.send_reminder_sms = updates.send_reminder_sms;
  if (updates.send_review_request !== undefined) payload.send_review_request = updates.send_review_request;
  if (updates.send_aftercare !== undefined) payload.send_aftercare = updates.send_aftercare;
  if (updates.before_photo_url !== undefined) payload.before_photo_url = updates.before_photo_url;
  if (updates.after_photo_url !== undefined) payload.after_photo_url = updates.after_photo_url;
  if (updates.status !== undefined) {
    const st = normalizeAppointmentStatusInput(String(updates.status));
    if (!st) return { error: "Invalid appointment status." };
    payload.status = st;
  }

  if (updates.start_time !== undefined || updates.end_time !== undefined) {
    payload.reminder_sent_at = null;
  }

  if (Object.keys(payload).length === 0) return { error: null };

  let { error } = await db
    .from("appointments")
    .update(payload)
    .eq("id", id)
    .eq("salon_id", context.salon.id);

  if (error && "reminder_sent_at" in payload) {
    const msg = error.message ?? "";
    if (/reminder_sent_at|does not exist|42703|schema cache/i.test(msg)) {
      const retryPayload = { ...payload };
      delete retryPayload.reminder_sent_at;
      const second = await db
        .from("appointments")
        .update(retryPayload)
        .eq("id", id)
        .eq("salon_id", context.salon.id);
      error = second.error;
    }
  }

  if (error) return { error: error.message };

  let revalidateClientId: string | null = null;
  const hasContact = !!(updates.guest_email?.trim() || updates.guest_phone?.trim());
  if (hasContact) {
    const clientId =
      updates.client_id !== undefined
        ? updates.client_id
        : (await db.from("appointments").select("client_id").eq("id", id).eq("salon_id", context.salon.id).single()).data
            ?.client_id;
    if (clientId) {
      const clientUpdates: Record<string, unknown> = {};
      if (updates.guest_email?.trim()) clientUpdates.email = updates.guest_email.trim();
      if (updates.guest_phone?.trim()) clientUpdates.phone = updates.guest_phone.trim();
      if (Object.keys(clientUpdates).length > 0) {
        await db.from("clients").update(clientUpdates).eq("id", clientId).eq("salon_id", context.salon.id);
        revalidateClientId = clientId as string;
      }
    }
  }

  try {
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    if (revalidateClientId) {
      revalidatePath("/clients");
      revalidatePath(`/clients/${revalidateClientId}`);
    }
  } catch (e) {
    console.error("[executeAppointmentPatch] revalidatePath", e);
  }

  return { error: null };
}
