"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
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
};

export async function createAppointment(input: CreateAppointmentInput) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== input.salonId) return { error: "Unauthorized" };

  const { error } = await supabase.from("appointments").insert({
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
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateAppointment(
  id: string,
  updates: { start_time?: string; end_time?: string; stylist_id?: string }
) {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("appointments")
    .update(updates)
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
