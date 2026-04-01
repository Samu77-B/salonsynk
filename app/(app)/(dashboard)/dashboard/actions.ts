"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { getMutateClient } from "@/lib/supabase/mutate-client";
import { fetchAppointmentsForOverlapCheck, type OverlapAppointmentRow } from "@/lib/appointments/overlap-queries";
import {
  executeAppointmentPatch,
  type UpdateAppointmentInput,
  type AppointmentDbStatus,
  APPOINTMENT_DB_STATUSES,
} from "@/lib/appointments/patch-appointment";
import { findClientsForEmptySlots, type SlotWithCandidates } from "@/lib/gap-filler";
import {
  hasBlockingOverlapWithExisting,
  rangeToMinutes,
  type AppointmentBlockingInput,
} from "@/lib/diary-rules";
import { revalidatePath } from "next/cache";
import { after, connection } from "next/server";
import { sendClientBookingConfirmation } from "@/lib/booking-notifications";

export type { UpdateAppointmentInput, AppointmentDbStatus };
export { APPOINTMENT_DB_STATUSES };

/** Run cache updates after the server action response is sent (avoids Next.js RSC / digest conflicts). */
function runAfterResponse(fn: () => void) {
  after(() => {
    try {
      fn();
    } catch (e) {
      console.error("[salonsynk] runAfterResponse task failed", e);
    }
  });
}

function catchActionError(e: unknown, label: string): { error: string } {
  console.error(`[salonsynk] ${label}`, e);
  const msg = e instanceof Error ? e.message : String(e);
  return { error: msg.trim() ? msg : "Something went wrong. Please try again." };
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
  await connection();
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
      runAfterResponse(() => {
        revalidatePath("/clients");
        revalidatePath(`/clients/${input.clientId}`);
      });
    }
  }

  runAfterResponse(() => {
    revalidatePath("/dashboard");
  });
  return { error: null };
}

export async function updateAppointment(id: string, updates: UpdateAppointmentInput) {
  try {
    await connection();
    return await executeAppointmentPatch(id, updates);
  } catch (e) {
    return catchActionError(e, "updateAppointment");
  }
}

export async function deleteAppointment(id: string) {
  try {
    await connection();
    const context = await getCurrentUserSalon();
    if (!context) return { error: "Unauthorized" };

    const db = await getMutateClient();

    const { error } = await db
      .from("appointments")
      .delete()
      .eq("id", id)
      .eq("salon_id", context.salon.id);

    if (error) return { error: error.message };
    runAfterResponse(() => {
      revalidatePath("/dashboard");
    });
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
  await connection();
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

  runAfterResponse(() => {
    revalidatePath("/dashboard");
  });
  return { error: null, url };
}

export async function getEmptySlotCandidates(): Promise<{ error?: string; data?: SlotWithCandidates[] }> {
  await connection();
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
