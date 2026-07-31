"use server";

import { createAdminClient } from "@core/supabase/admin";
import { sendJoinQueueSms } from "@modules/salon-walk-in/lib/queue-auto-notify";
import { getNextQueuePosition } from "@modules/salon-walk-in/lib/queue-positions";
import { AVG_SERVICE_MINUTES } from "@modules/salon-walk-in/lib/queue-sms";

export type JoinQueueResult = {
  success: boolean;
  position?: number;
  estimatedWait?: number;
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
  const preferredRaw = (formData.get("preferred_stylist_id") as string)?.trim();
  const preferredStylistId = preferredRaw || null;

  if (!guestName) {
    return { success: false, error: "Please enter your name." };
  }

  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, max_queue_size, settings")
    .eq("id", salonId)
    .single();

  if (!salon) {
    return { success: false, error: "Salon not found." };
  }

  const { count } = await supabase
    .from("salon_queue")
    .select("id", { count: "exact", head: true })
    .eq("salon_id", salonId)
    .eq("status", "waiting");

  const currentSize = count ?? 0;
  const maxSize = (salon as { max_queue_size?: number }).max_queue_size ?? 20;
  if (maxSize > 0 && currentSize >= maxSize) {
    return { success: false, error: "The queue is full right now. Please try again shortly." };
  }

  const nextPosition = await getNextQueuePosition(supabase, salonId);
  const estimatedWait = currentSize * AVG_SERVICE_MINUTES;

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const displayName = branding.company_name?.trim() || salon.name;

  const { data: inserted, error } = await supabase
    .from("salon_queue")
    .insert({
      salon_id: salonId,
      guest_name: guestName,
      guest_phone: guestPhone,
      service_id: serviceId,
      preferred_stylist_id: preferredStylistId,
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
