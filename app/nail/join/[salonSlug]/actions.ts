"use server";

import { createAdminClient } from "@core/supabase/admin";
import { sendJoinQueueSms } from "@modules/nail/lib/queue-auto-notify";
import { getNextQueuePosition } from "@modules/nail/lib/queue-positions";
import { AVG_SERVICE_MINUTES } from "@modules/nail/lib/queue-sms-messages";

export type JoinQueueResult = {
  success: boolean;
  position?: number;
  estimatedWait?: number;
  /** True when the customer entered a mobile (may receive queue SMS). */
  smsQueued?: boolean;
  error?: string;
};

export async function publicJoinQueue(
  salonId: string,
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
  const preferredRaw = (formData.get("preferred_technician_id") as string)?.trim();
  const preferredTechnicianId = preferredRaw || null;

  if (!guestName) {
    return { success: false, error: "Please enter your name." };
  }

  const { data: salon } = await supabase
    .from("nail_salons")
    .select("id, name, max_queue_size")
    .eq("id", salonId)
    .single();

  if (!salon) {
    return { success: false, error: "Salon not found." };
  }

  const { count } = await supabase
    .from("nail_queue")
    .select("id", { count: "exact", head: true })
    .eq("salon_id", salonId)
    .eq("status", "waiting");

  const currentSize = count ?? 0;
  if (salon.max_queue_size > 0 && currentSize >= salon.max_queue_size) {
    return { success: false, error: "The queue is full right now. Please try again shortly." };
  }

  const nextPosition = await getNextQueuePosition(supabase, salonId);
  const estimatedWait = currentSize * AVG_SERVICE_MINUTES;

  const { data: inserted, error } = await supabase
    .from("nail_queue")
    .insert({
      salon_id: salonId,
      guest_name: guestName,
      guest_phone: guestPhone,
      service_id: serviceId,
      preferred_technician_id: preferredTechnicianId,
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
    const displayName = salon.name?.trim() || "the nail bar";
    await sendJoinQueueSms(
      supabase,
      salonId,
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
