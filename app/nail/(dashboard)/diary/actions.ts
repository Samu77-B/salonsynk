"use server";

import { connection } from "next/server";
import {
  executeCreateNailAppointment,
  type CreateNailAppointmentInput,
  type CreateNailAppointmentResult,
} from "@modules/nail/lib/appointments/create-appointment";
import { executeDeleteNailAppointment } from "@modules/nail/lib/appointments/delete-appointment";
import {
  executePatchNailAppointment,
  type UpdateNailAppointmentInput,
  type NailAppointmentDbStatus,
  NAIL_APPOINTMENT_DB_STATUSES,
} from "@modules/nail/lib/appointments/patch-appointment";

export type CreateAppointmentInput = CreateNailAppointmentInput;
export type CreateAppointmentResult = CreateNailAppointmentResult;
export type UpdateAppointmentInput = UpdateNailAppointmentInput;
export type AppointmentDbStatus = NailAppointmentDbStatus;
export { NAIL_APPOINTMENT_DB_STATUSES as APPOINTMENT_DB_STATUSES };

function catchActionError(e: unknown, label: string): { error: string } {
  console.error(`[nailsynk] ${label}`, e);
  const msg = e instanceof Error ? e.message : String(e);
  return { error: msg.trim() ? msg : "Something went wrong. Please try again." };
}

export async function createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
  try {
    return await executeCreateNailAppointment(input);
  } catch (e) {
    return catchActionError(e, "createAppointment");
  }
}

export async function updateAppointment(id: string, updates: UpdateAppointmentInput) {
  try {
    await connection();
    return await executePatchNailAppointment(id, updates);
  } catch (e) {
    return catchActionError(e, "updateAppointment");
  }
}

export async function deleteAppointment(id: string) {
  try {
    return await executeDeleteNailAppointment(id);
  } catch (e) {
    return catchActionError(e, "deleteAppointment");
  }
}
