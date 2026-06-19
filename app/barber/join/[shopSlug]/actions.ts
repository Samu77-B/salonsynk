"use server";

import { createAdminClient } from "@core/supabase/admin";
import { sendJoinQueueSms } from "@modules/barber/lib/queue-auto-notify";
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
