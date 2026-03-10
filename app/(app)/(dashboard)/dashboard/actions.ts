"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { findClientsForEmptySlots, type SlotWithCandidates } from "@/lib/gap-filler";
import { revalidatePath } from "next/cache";

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
};

export async function createAppointment(input: CreateAppointmentInput) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== input.salonId) return { error: "Unauthorized" };

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

  const { error } = await supabase.from("appointments").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null };
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
};

export async function updateAppointment(id: string, updates: UpdateAppointmentInput) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

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

  const { error } = await supabase
    .from("appointments")
    .update(payload)
    .eq("id", id)
    .in("salon_id", [context.salon.id]);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteAppointment(id: string) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id)
    .in("salon_id", [context.salon.id]);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null };
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
