"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@core/supabase/admin";
import { sendJoinQueueSms, sendBookingConfirmationSms } from "@modules/barber/lib/queue-auto-notify";
import { getNextQueuePosition } from "@modules/barber/lib/queue-positions";
import { AVG_SERVICE_MINUTES } from "@modules/barber/lib/queue-sms-messages";

export type JoinQueueResult = {
  success: boolean;
  position?: number;
  estimatedWait?: number;
  /** True when the customer entered a mobile (may receive queue SMS). */
  smsQueued?: boolean;
  error?: string;
};

export type BookAppointmentResult = {
  success: boolean;
  startTime?: string;
  barberName?: string;
  /** True when a confirmation SMS was sent (phone provided and Twilio configured). */
  smsSent?: boolean;
  error?: string;
};

export async function publicBookAppointment(
  shopId: string,
  formData: FormData
): Promise<BookAppointmentResult> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return { success: false, error: "Service temporarily unavailable." };
  }

  const guestName = (formData.get("guest_name") as string)?.trim();
  const guestPhone = (formData.get("guest_phone") as string)?.trim() || null;
  const barberId = (formData.get("barber_id") as string)?.trim();
  const serviceId = (formData.get("service_id") as string)?.trim() || null;
  const date = (formData.get("date") as string)?.trim();
  const time = (formData.get("time") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!guestName) return { success: false, error: "Please enter your name." };
  if (!barberId) return { success: false, error: "Please choose a barber." };
  if (!date || !time) return { success: false, error: "Please pick a date and time." };

  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return { success: false, error: "Please choose today or a future date." };

  const { data: shop } = await supabase
    .from("barber_shops")
    .select("id, name")
    .eq("id", shopId)
    .single();

  if (!shop) return { success: false, error: "Shop not found." };

  const { data: barber } = await supabase
    .from("barber_members")
    .select("id, display_name")
    .eq("id", barberId)
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .eq("is_accepting_walk_ins", true)
    .single();

  if (!barber) return { success: false, error: "That barber is not available." };

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
    if (!service) return { success: false, error: "That service is not available." };
    if (service.duration_minutes) durationMinutes = service.duration_minutes;
    if (service.name) serviceName = service.name;
  }

  const startTime = new Date(`${date}T${time}:00`);
  if (Number.isNaN(startTime.getTime())) {
    return { success: false, error: "Invalid date or time." };
  }

  if (startTime.getTime() < Date.now() - 60_000) {
    return { success: false, error: "Please choose a time in the future." };
  }

  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

  const { error } = await supabase.from("barber_appointments").insert({
    shop_id: shopId,
    barber_id: barberId,
    service_id: serviceId,
    guest_name: guestName,
    guest_phone: guestPhone,
    notes,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    status: "scheduled",
    source: "booking",
  });

  if (error) return { success: false, error: "Could not save your booking. Please try again." };

  revalidatePath("/barber/appointments", "page");
  revalidatePath("/barber/dashboard", "page");

  const shopDisplayName = shop.name?.trim() || "the barber shop";
  const barberDisplayName = barber.display_name ?? "your barber";
  let smsSent = false;
  if (guestPhone) {
    smsSent = await sendBookingConfirmationSms({
      guestPhone,
      guestName: guestName,
      shopName: shopDisplayName,
      barberName: barberDisplayName,
      startTime: startTime.toISOString(),
      serviceName,
    });
  }

  return {
    success: true,
    startTime: startTime.toISOString(),
    barberName: barberDisplayName,
    smsSent,
  };
}

export async function publicJoinQueue(
  shopId: string,
  formData: FormData
): Promise<JoinQueueResult> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return { success: false, error: "Service temporarily unavailable." };
  }

  const guestName = (formData.get("guest_name") as string)?.trim();
  const guestPhone = (formData.get("guest_phone") as string)?.trim() || null;
  const serviceId = (formData.get("service_id") as string) || null;
  const preferredRaw = (formData.get("preferred_barber_id") as string)?.trim();
  const preferredBarberId = preferredRaw || null;

  if (!guestName) {
    return { success: false, error: "Please enter your name." };
  }

  // Verify shop exists
  const { data: shop } = await supabase
    .from("barber_shops")
    .select("id, name, max_queue_size")
    .eq("id", shopId)
    .single();

  if (!shop) {
    return { success: false, error: "Shop not found." };
  }

  // Check queue capacity
  const { count } = await supabase
    .from("barber_queue")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("status", "waiting");

  const currentSize = count ?? 0;
  if (shop.max_queue_size > 0 && currentSize >= shop.max_queue_size) {
    return { success: false, error: "The queue is full right now. Please try again shortly." };
  }

  const nextPosition = await getNextQueuePosition(supabase, shopId);

  // Estimate wait based on average service duration of those ahead
  const estimatedWait = currentSize * AVG_SERVICE_MINUTES;

  const { data: inserted, error } = await supabase
    .from("barber_queue")
    .insert({
      shop_id: shopId,
      guest_name: guestName,
      guest_phone: guestPhone,
      service_id: serviceId,
      preferred_barber_id: preferredBarberId,
      position: nextPosition,
      status: "waiting",
      estimated_wait_minutes: estimatedWait,
      joined_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Could not join the queue. Please try again." };
  }

  if (inserted?.id && guestPhone) {
    const displayName = shop.name?.trim() || "the barber shop";
    await sendJoinQueueSms(
      supabase,
      shopId,
      displayName,
      inserted.id,
      nextPosition,
      guestPhone,
      guestName
    );
  }

  return {
    success: true,
    position: nextPosition,
    estimatedWait,
    smsQueued: !!guestPhone,
  };
}
