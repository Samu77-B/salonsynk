"use server";

import { createAdminClient } from "@core/supabase/admin";

export type JoinQueueResult = {
  success: boolean;
  position?: number;
  estimatedWait?: number;
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
  const preferredBarberId = (formData.get("preferred_barber_id") as string) || null;

  if (!guestName) {
    return { success: false, error: "Please enter your name." };
  }

  // Verify shop exists
  const { data: shop } = await supabase
    .from("barber_shops")
    .select("id, max_queue_size")
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

  // Get next position
  const { data: maxPos } = await supabase
    .from("barber_queue")
    .select("position")
    .eq("shop_id", shopId)
    .eq("status", "waiting")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (maxPos?.position ?? 0) + 1;

  // Estimate wait based on average service duration of those ahead
  const avgServiceMinutes = 20;
  const estimatedWait = currentSize * avgServiceMinutes;

  const { error } = await supabase.from("barber_queue").insert({
    shop_id: shopId,
    guest_name: guestName,
    guest_phone: guestPhone,
    service_id: serviceId,
    preferred_barber_id: preferredBarberId,
    position: nextPosition,
    status: "waiting",
    estimated_wait_minutes: estimatedWait,
    joined_at: new Date().toISOString(),
  });

  if (error) {
    return { success: false, error: "Could not join the queue. Please try again." };
  }

  return {
    success: true,
    position: nextPosition,
    estimatedWait,
  };
}
