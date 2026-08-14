"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { sendBookingConfirmationSms } from "@modules/nail/lib/queue-auto-notify";

async function getSalonScopedClient(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; salonId: string; salonName: string }
  | { error: string }
> {
  const context = await getCurrentUserNailSalon();
  if (!context) return { error: "No nail salon context. Sign in again and retry." };
  const isSuperAdmin = await getIsSuperAdmin();
  const supabase = isSuperAdmin
    ? (() => {
        try {
          return createAdminClient();
        } catch {
          return null;
        }
      })()
    : null;
  return {
    supabase: supabase ?? (await createClient()),
    salonId: context.salon.id,
    salonName: context.salon.name,
  };
}

function revalidateAppointments() {
  revalidatePath("/nail/appointments", "page");
  revalidatePath("/nail/queue", "page");
}

export async function createNailAppointment(formData: FormData): Promise<{ error?: string }> {
  try {
    const scoped = await getSalonScopedClient();
    if ("error" in scoped) return { error: scoped.error };
    const { supabase, salonId, salonName } = scoped;

    const guestName = (formData.get("guest_name") as string)?.trim();
    const guestPhone = (formData.get("guest_phone") as string)?.trim() || null;
    const guestEmail = (formData.get("guest_email") as string)?.trim() || null;
    const technicianId = (formData.get("technician_id") as string)?.trim();
    const serviceId = (formData.get("service_id") as string)?.trim() || null;
    const date = (formData.get("date") as string)?.trim();
    const time = (formData.get("time") as string)?.trim();
    const notes = (formData.get("notes") as string)?.trim() || null;

    if (!guestName) return { error: "Client name is required" };
    if (!technicianId) return { error: "Select a technician" };
    if (!date || !time) return { error: "Date and time are required" };

    const { data: technician } = await supabase
      .from("nail_members")
      .select("display_name")
      .eq("id", technicianId)
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .single();

    if (!technician) return { error: "Select a technician from this salon" };

    let durationMinutes = 30;
    let serviceName: string | null = null;
    if (serviceId) {
      const { data: service } = await supabase
        .from("nail_services")
        .select("duration_minutes, name")
        .eq("id", serviceId)
        .eq("salon_id", salonId)
        .eq("is_active", true)
        .single();
      if (!service) return { error: "Select a service from this salon" };
      if (service.duration_minutes) durationMinutes = service.duration_minutes;
      if (service.name) serviceName = service.name;
    }

    const startTime = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startTime.getTime())) return { error: "Invalid date or time" };

    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

    const { error } = await supabase.from("nail_appointments").insert({
      salon_id: salonId,
      technician_id: technicianId,
      service_id: serviceId || null,
      guest_name: guestName,
      guest_phone: guestPhone,
      guest_email: guestEmail,
      notes,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: "scheduled",
      source: "booking",
    });

    if (error) return { error: error.message };

    if (guestPhone) {
      try {
        await sendBookingConfirmationSms({
          guestPhone,
          guestName,
          salonName: salonName?.trim() || "the nail bar",
          technicianName: technician?.display_name ?? "your technician",
          startTime: startTime.toISOString(),
          serviceName,
        });
      } catch (smsErr) {
        console.error("createNailAppointment SMS failed:", smsErr);
      }
    }

    revalidateAppointments();
    return {};
  } catch (err) {
    console.error("createNailAppointment failed:", err);
    return { error: "Could not save booking. Please try again." };
  }
}

export async function updateNailAppointmentStatus(
  appointmentId: string,
  status: "scheduled" | "completed" | "no_show" | "canceled"
): Promise<{ error?: string }> {
  try {
    const scoped = await getSalonScopedClient();
    if ("error" in scoped) return { error: scoped.error };
    const { supabase, salonId } = scoped;

    const { error } = await supabase
      .from("nail_appointments")
      .update({ status })
      .eq("id", appointmentId)
      .eq("salon_id", salonId);

    if (error) return { error: error.message };
    revalidateAppointments();
    return {};
  } catch (err) {
    console.error("updateNailAppointmentStatus failed:", err);
    return { error: "Could not update booking. Please try again." };
  }
}

export async function deleteNailAppointment(appointmentId: string): Promise<{ error?: string }> {
  return updateNailAppointmentStatus(appointmentId, "canceled");
}
