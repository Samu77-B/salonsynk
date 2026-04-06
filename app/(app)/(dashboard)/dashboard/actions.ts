"use server";

import { connection } from "next/server";
import {
  executeCreateAppointment,
  type CreateAppointmentInput,
  type CreateAppointmentResult,
} from "@/lib/appointments/create-appointment";
import { executeDeleteAppointment } from "@/lib/appointments/delete-appointment";
import {
  executeGetEmptySlotCandidates,
  type SlotWithCandidates,
} from "@/lib/appointments/gap-filler-query";
import {
  executeAppointmentPatch,
  type UpdateAppointmentInput,
  type AppointmentDbStatus,
  APPOINTMENT_DB_STATUSES,
} from "@/lib/appointments/patch-appointment";
import { uploadAppointmentPhotoInner } from "./actions-photo";

export type { CreateAppointmentInput, CreateAppointmentResult };
export type { UpdateAppointmentInput, AppointmentDbStatus };
export { APPOINTMENT_DB_STATUSES };

function catchActionError(e: unknown, label: string): { error: string } {
  console.error(`[salonsynk] ${label}`, e);
  const msg = e instanceof Error ? e.message : String(e);
  return { error: msg.trim() ? msg : "Something went wrong. Please try again." };
}

export async function createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
  try {
    return await executeCreateAppointment(input);
  } catch (e) {
    return catchActionError(e, "createAppointment");
  }
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
    return await executeDeleteAppointment(id);
  } catch (e) {
    return catchActionError(e, "deleteAppointment");
  }
}

export async function uploadAppointmentPhoto(
  appointmentId: string,
  field: "before" | "after",
  formData: FormData
): Promise<{ error: string | null; url?: string }> {
  try {
    await connection();
    return await uploadAppointmentPhotoInner(appointmentId, field, formData);
  } catch (e) {
    return catchActionError(e, "uploadAppointmentPhoto") as { error: string; url?: string };
  }
}

export async function getEmptySlotCandidates(): Promise<{ error?: string; data?: SlotWithCandidates[] }> {
  try {
    return await executeGetEmptySlotCandidates();
  } catch (e) {
    return catchActionError(e, "getEmptySlotCandidates");
  }
}
