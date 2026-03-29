"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { findClientsForEmptySlots, type SlotWithCandidates } from "@/lib/gap-filler";
import {
  hasBlockingOverlapWithExisting,
  rangeToMinutes,
  type AppointmentBlockingInput,
} from "@/lib/diary-rules";
import { revalidatePath } from "next/cache";
import { sendClientBookingConfirmation } from "@/lib/booking-notifications";

function revalidateDashboardAndReports() {
  try {
    revalidatePath("/dashboard");
  } catch (e) {
    console.error("[salonsynk] revalidatePath(/dashboard)", e);
  }
  try {
    revalidatePath("/reports");
  } catch (e) {
    console.error("[salonsynk] revalidatePath(/reports)", e);
  }
}

function catchActionError(e: unknown, label: string): { error: string } {
  console.error(`[salonsynk] ${label}`, e);
  const msg = e instanceof Error ? e.message : String(e);
  return { error: msg.trim() ? msg : "Something went wrong. Please try again." };
}

/** Super admins often view a salon via cookie without a salon_members row; RLS would block inserts. */
async function getMutateClient(): Promise<SupabaseClient> {
  const userSb = await createClient();
  if (!(await getIsSuperAdmin())) return userSb;
  try {
    return createAdminClient();
  } catch {
    return userSb;
  }
}

type OverlapAppointmentRow = {
  id: string;
  start_time: string;
  end_time: string;
  services?: { processing_time_minutes?: number } | { processing_time_minutes?: number }[] | null;
};

async function fetchAppointmentsForOverlapCheck(
  db: SupabaseClient,
  salonId: string,
  stylistId: string,
  dayStartIso: string,
  dayEndIso: string
) {
  const withSvc = await db
    .from("appointments")
    .select("id, start_time, end_time, services(processing_time_minutes)")
    .eq("salon_id", salonId)
    .eq("stylist_id", stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);
  if (!withSvc.error) return withSvc.data ?? [];
  const minimal = await db
    .from("appointments")
    .select("id, start_time, end_time")
    .eq("salon_id", salonId)
    .eq("stylist_id", stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);
  return minimal.data ?? [];
}

export type CreateAppointmentInput = {
  salonId: string;
  stylistId: string;
  clientId: string | null;
  serviceId: string | null;
  startTime: string; // ISO
  endTime: string;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  notes?: string | null;
  sendReminderSms?: boolean;
  sendReviewRequest?: boolean;
  sendAftercare?: boolean;
  /** Skip hands-on overlap check (salon staff only — e.g. walk-in squeezed in). */
  allowScheduleOverlap?: boolean;
};

export async function createAppointment(input: CreateAppointmentInput) {
  try {
    return await createAppointmentInner(input);
  } catch (e) {
    return catchActionError(e, "createAppointment");
  }
}

async function createAppointmentInner(input: CreateAppointmentInput) {
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
        "This would overlap with another appointment during hands-on time. If the service has processing time (e.g. colour developing), another booking can sit in that window — set processing minutes on the service in Settings. To add a walk-in anyway, tick “Add even if this overlaps another booking” directly below, then press Add again.",
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

  const { error } = await db.from("appointments").insert(row);

  if (error) return { error: error.message };

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
      } catch (re) {
        console.error("[salonsynk] revalidatePath /clients (create)", re);
      }
    }
  }

  try {
    revalidatePath("/dashboard");
  } catch (re) {
    console.error("[salonsynk] revalidatePath /dashboard (create)", re);
  }
  return { error: null };
}

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
  /** Skip hands-on overlap check when changing time/stylist (salon staff only). */
  allowScheduleOverlap?: boolean;
  status?: AppointmentDbStatus | string;
};

export async function updateAppointment(id: string, updates: UpdateAppointmentInput) {
  try {
    return await updateAppointmentInner(id, updates);
  } catch (e) {
    return catchActionError(e, "updateAppointment");
  }
}

async function updateAppointmentInner(id: string, updates: UpdateAppointmentInput) {
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

  // Avoid `.select()` after update: some PostgREST/RLS setups omit RETURNING and can confuse the client or yield empty rows.
  const { error } = await db
    .from("appointments")
    .update(payload)
    .eq("id", id)
    .eq("salon_id", context.salon.id);

  if (error) return { error: error.message };

  const hasContact = !!(updates.guest_email?.trim() || updates.guest_phone?.trim());
  if (hasContact) {
    const clientId =
      updates.client_id !== undefined
        ? updates.client_id
        : (await db.from("appointments").select("client_id").eq("id", id).eq("salon_id", context.salon.id).single()).data?.client_id;
    if (clientId) {
      const clientUpdates: Record<string, unknown> = {};
      if (updates.guest_email?.trim()) clientUpdates.email = updates.guest_email.trim();
      if (updates.guest_phone?.trim()) clientUpdates.phone = updates.guest_phone.trim();
      if (Object.keys(clientUpdates).length > 0) {
        await db.from("clients").update(clientUpdates).eq("id", clientId).eq("salon_id", context.salon.id);
        try {
          revalidatePath("/clients");
          revalidatePath(`/clients/${clientId}`);
        } catch (e) {
          console.error("[salonsynk] revalidatePath /clients", e);
        }
      }
    }
  }

  revalidateDashboardAndReports();
  return { error: null };
}

export async function deleteAppointment(id: string) {
  try {
    const context = await getCurrentUserSalon();
    if (!context) return { error: "Unauthorized" };

    const db = await getMutateClient();

    const { error } = await db
      .from("appointments")
      .delete()
      .eq("id", id)
      .eq("salon_id", context.salon.id);

    if (error) return { error: error.message };
    try {
      revalidatePath("/dashboard");
    } catch (e) {
      console.error("[salonsynk] revalidatePath(/dashboard) after delete", e);
    }
    return { error: null };
  } catch (e) {
    return catchActionError(e, "deleteAppointment");
  }
}

const PHOTO_BUCKET = "appointment-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function uploadAppointmentPhoto(
  appointmentId: string,
  field: "before" | "after",
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  const db = await getMutateClient();

  const { data: apt } = await db
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("salon_id", context.salon.id)
    .single();
  if (!apt) return { error: "Appointment not found" };

  const raw = formData.get("photo");
  if (!raw || typeof raw !== "object" || !("size" in raw)) return { error: "No file provided" };
  const size = Number((raw as Blob).size) || 0;
  const type = String((raw as File).type || "").toLowerCase();
  if (size === 0) return { error: "No file provided" };
  if (size > MAX_PHOTO_BYTES) return { error: "Photo must be under 5 MB" };
  if (!ALLOWED_PHOTO_TYPES.includes(type)) return { error: "Allowed: JPEG, PNG, WebP, HEIC" };

  const ext = (raw as File).name?.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${context.salon.id}/${appointmentId}-${field}.${ext}`;

  const arrayBuffer = await (raw as Blob).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Storage not configured" };
  }

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, buffer, { upsert: true, contentType: type });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  const url = urlData.publicUrl;

  const col = field === "before" ? "before_photo_url" : "after_photo_url";
  await db
    .from("appointments")
    .update({ [col]: url })
    .eq("id", appointmentId)
    .eq("salon_id", context.salon.id);

  revalidatePath("/dashboard");
  return { error: null, url };
}

export async function getEmptySlotCandidates(): Promise<{ error?: string; data?: SlotWithCandidates[] }> {
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };
  const supabase = await createClient();
  try {
    const data = await findClientsForEmptySlots(supabase, context.salon.id);
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
