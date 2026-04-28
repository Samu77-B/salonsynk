import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getMutateClient } from "@/lib/supabase/mutate-client";
import { requireStaffElevationOrError } from "@/lib/staff-elevation";
import { dedupeOrderedServiceIds, syncAppointmentServices } from "./appointment-service-lines";
import {
  hasBlockingOverlapWithExisting,
  rangeToMinutes,
  type AppointmentBlockingInput,
} from "@/lib/diary-rules";
import { fetchAppointmentsForOverlapCheck, processingMinutesFromOverlapRow, type OverlapAppointmentRow } from "./overlap-queries";

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
  /** Full visit line-items; updates appointments.service_id (first item) + junction rows. */
  serviceIds?: string[];
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
  change_charge_minor?: number;
};

/**
 * Core appointment PATCH used by the REST route and server actions.
 * Revalidation is deferred with `after()` so diary server actions (e.g. status changes) do not hit Next.js digest/RSC races.
 */
export async function executeAppointmentPatch(
  id: string,
  updates: UpdateAppointmentInput
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };
  const salonId = context.salon.id;

  // Staff can "check in" (mark completed) without step-up, but any sensitive changes require elevation.
  const nextStatus =
    updates.status !== undefined ? normalizeAppointmentStatusInput(String(updates.status)) : null;
  const isCheckInOnly = nextStatus === "completed" && Object.keys({ ...updates, status: undefined }).length === 0;
  const sensitive =
    !isCheckInOnly &&
    (updates.start_time !== undefined ||
      updates.end_time !== undefined ||
      updates.stylist_id !== undefined ||
      updates.client_id !== undefined ||
      updates.service_id !== undefined ||
      updates.serviceIds !== undefined ||
      updates.guest_email !== undefined ||
      updates.guest_phone !== undefined ||
      updates.status !== undefined);

  if (sensitive) {
    const elevationError = await requireStaffElevationOrError({
      salonId,
      memberRole: context.member.role ?? "",
    });
    if (elevationError) return { error: elevationError };
  }

  const db = await getMutateClient();

  if (
    updates.start_time !== undefined ||
    updates.end_time !== undefined ||
    updates.stylist_id !== undefined ||
    updates.service_id !== undefined ||
    updates.serviceIds !== undefined
  ) {
    const { data: current } = await db
      .from("appointments")
      .select("start_time, end_time, stylist_id")
      .eq("id", id)
      .eq("salon_id", salonId)
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
      salonId,
      stylistId,
      dayStart.toISOString(),
      dayEnd.toISOString()
    );

    async function resolveProcessingServiceIds(): Promise<string[]> {
      if (updates.serviceIds !== undefined) return dedupeOrderedServiceIds(updates.serviceIds);
      if (updates.service_id !== undefined) return updates.service_id ? [updates.service_id] : [];
      const { data: lines } = await db
        .from("appointment_services")
        .select("service_id, sort_order")
        .eq("appointment_id", id)
        .order("sort_order", { ascending: true });
      const fromJn = (lines ?? [])
        .map((l: { service_id?: string | null }) => l.service_id)
        .filter((x): x is string => typeof x === "string" && x.length > 0);
      if (fromJn.length > 0) return dedupeOrderedServiceIds(fromJn);
      const fk = (
        await db.from("appointments").select("service_id").eq("id", id).eq("salon_id", salonId).single()
      ).data?.service_id as string | null | undefined;
      return fk ? [fk] : [];
    }

    const procIds = await resolveProcessingServiceIds();
    let newProcessing = 0;
    if (procIds.length > 0) {
      const { data: procRows } = await db
        .from("services")
        .select("id, processing_time_minutes")
        .in("id", procIds)
        .eq("salon_id", salonId);
      if (procRows && procRows.length === procIds.length) {
        const pmap = Object.fromEntries(
          procRows.map((r) => [(r as { id: string }).id, Number((r as { processing_time_minutes?: number }).processing_time_minutes) || 0])
        );
        newProcessing = Math.max(...procIds.map((sid) => pmap[sid] ?? 0));
      }
    }

    const blockingExisting: AppointmentBlockingInput[] = (existing as OverlapAppointmentRow[])
      .filter((row) => row.id !== id)
      .map((row) => {
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
  if (updates.serviceIds !== undefined) {
    const o = dedupeOrderedServiceIds(updates.serviceIds);
    payload.service_id = o.length > 0 ? o[0] : null;
  } else if (updates.service_id !== undefined) payload.service_id = updates.service_id;
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
  if (updates.change_charge_minor !== undefined) {
    payload.change_charge_minor = updates.change_charge_minor;
  }

  if (updates.start_time !== undefined || updates.end_time !== undefined) {
    payload.reminder_sent_at = null;
  }

  if (Object.keys(payload).length === 0 && updates.serviceIds === undefined) return { error: null };

  let { error } = await db
    .from("appointments")
    .update(payload)
    .eq("id", id)
    .eq("salon_id", salonId);

  if (error) {
    const msg = error.message ?? "";
    if (/reminder_sent_at|change_charge_minor|does not exist|42703|schema cache/i.test(msg)) {
      const retryPayload = { ...payload };
      delete retryPayload.reminder_sent_at;
      delete retryPayload.change_charge_minor;
      const second = await db
        .from("appointments")
        .update(retryPayload)
        .eq("id", id)
        .eq("salon_id", salonId);
      error = second.error;
    }
  }

  if (error) return { error: error.message };

  if (updates.serviceIds !== undefined) {
    const syncRes = await syncAppointmentServices(db, id, dedupeOrderedServiceIds(updates.serviceIds));
    if (syncRes.error) return { error: syncRes.error };
  }

  let revalidateClientId: string | null = null;
  const hasContact = !!(updates.guest_email?.trim() || updates.guest_phone?.trim());
  if (hasContact) {
    const clientId =
      updates.client_id !== undefined
        ? updates.client_id
        : (await db.from("appointments").select("client_id").eq("id", id).eq("salon_id", salonId).single()).data
            ?.client_id;
    if (clientId) {
      const clientUpdates: Record<string, unknown> = {};
      if (updates.guest_email?.trim()) clientUpdates.email = updates.guest_email.trim();
      if (updates.guest_phone?.trim()) clientUpdates.phone = updates.guest_phone.trim();
      if (Object.keys(clientUpdates).length > 0) {
        await db.from("clients").update(clientUpdates).eq("id", clientId).eq("salon_id", salonId);
        revalidateClientId = clientId as string;
      }
    }
  }

  const clientIdForRevalidate = revalidateClientId;
  after(() => {
    try {
      revalidatePath("/dashboard");
      revalidatePath("/reports");
      if (clientIdForRevalidate) {
        revalidatePath("/clients");
        revalidatePath(`/clients/${clientIdForRevalidate}`);
      }
    } catch (e) {
      console.error("[executeAppointmentPatch] revalidatePath", e);
    }
  });

  return { error: null };
}
