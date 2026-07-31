"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { sendBookingConfirmationSms } from "@modules/barber/lib/queue-auto-notify";

async function getShopScopedClient() {
  const context = await getCurrentUserShop();
  if (!context) throw new Error("No barber shop context");
  const isSuperAdmin = await getIsSuperAdmin();
  const supabase = isSuperAdmin
    ? (() => { try { return createAdminClient(); } catch { return null; } })()
    : null;
  return {
    supabase: supabase ?? (await createClient()),
    shopId: context.shop.id,
    shopName: context.shop.name,
  };
}

function revalidateAppointments() {
  revalidatePath("/barber/appointments", "page");
  revalidatePath("/barber/dashboard", "page");
}

export async function createBarberAppointment(formData: FormData): Promise<{ error?: string }> {
  const { supabase, shopId, shopName } = await getShopScopedClient();

  const guestName = (formData.get("guest_name") as string)?.trim();
  const guestPhone = (formData.get("guest_phone") as string)?.trim() || null;
  const guestEmail = (formData.get("guest_email") as string)?.trim() || null;
  const barberId = (formData.get("barber_id") as string)?.trim();
  const serviceId = (formData.get("service_id") as string)?.trim() || null;
  const date = (formData.get("date") as string)?.trim();
  const time = (formData.get("time") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!guestName) return { error: "Client name is required" };
  if (!barberId) return { error: "Select a barber" };
  if (!date || !time) return { error: "Date and time are required" };

  const { data: barber } = await supabase
    .from("barber_members")
    .select("display_name")
    .eq("id", barberId)
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .single();

  if (!barber) return { error: "Select a barber from this shop" };

  let durationMinutes = 30;
  let serviceName: string | null = null;
  if (serviceId) {
    const { data: service } = await supabase
      .from("barber_services")
      .select("duration_minutes, name")
      .eq("id", serviceId)
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .single();
    if (!service) return { error: "Select a service from this shop" };
    if (service.duration_minutes) durationMinutes = service.duration_minutes;
    if (service.name) serviceName = service.name;
  }

  const startTime = new Date(`${date}T${time}:00`);
  if (Number.isNaN(startTime.getTime())) return { error: "Invalid date or time" };

  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

  const { error } = await supabase.from("barber_appointments").insert({
    shop_id: shopId,
    barber_id: barberId,
    service_id: serviceId,
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
    await sendBookingConfirmationSms({
      guestPhone,
      guestName,
      shopName: shopName?.trim() || "the barber shop",
      barberName: barber?.display_name ?? "your barber",
      startTime: startTime.toISOString(),
      serviceName,
    });
  }

  revalidateAppointments();
  return {};
}

export async function updateBarberAppointmentStatus(
  appointmentId: string,
  status: "scheduled" | "in_chair" | "completed" | "no_show" | "canceled"
): Promise<{ error?: string }> {
  const { supabase, shopId } = await getShopScopedClient();

  const { error } = await supabase
    .from("barber_appointments")
    .update({ status })
    .eq("id", appointmentId)
    .eq("shop_id", shopId);

  if (error) return { error: error.message };
  revalidateAppointments();
  return {};
}

export async function deleteBarberAppointment(appointmentId: string): Promise<{ error?: string }> {
  return updateBarberAppointmentStatus(appointmentId, "canceled");
}
