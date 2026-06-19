import type { SupabaseClient } from "@supabase/supabase-js";
import { canSendSms } from "@core/utils/sms";
import { queueSmsBody, sendBarberQueueSms } from "./queue-sms";

/**
 * Text the first waiting customer if they have a mobile and haven't been notified yet.
 * Call after someone leaves the queue or completes so the new front gets "you're next".
 */
export async function autoNotifyQueueFront(
  supabase: SupabaseClient,
  shopId: string,
  shopName: string
): Promise<void> {
  if (!canSendSms()) return;

  const { data: front } = await supabase
    .from("barber_queue")
    .select("id, guest_name, guest_phone, next_sms_sent_at, called_at")
    .eq("shop_id", shopId)
    .eq("status", "waiting")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!front?.guest_phone?.trim() || front.next_sms_sent_at) return;

  const body = queueSmsBody("next", {
    clientName: front.guest_name ?? "there",
    shopName,
  });
  const sms = await sendBarberQueueSms(front.guest_phone, body);
  if (!sms.sent) return;

  const now = new Date().toISOString();
  await supabase
    .from("barber_queue")
    .update({
      next_sms_sent_at: now,
      called_at: front.called_at ?? now,
    })
    .eq("id", front.id)
    .eq("shop_id", shopId);
}

/** Notify a specific queue entry if they are first in line and eligible. */
export async function autoNotifyIfQueueFront(
  supabase: SupabaseClient,
  shopId: string,
  shopName: string,
  entryId: string
): Promise<void> {
  if (!canSendSms()) return;

  const { data: front } = await supabase
    .from("barber_queue")
    .select("id")
    .eq("shop_id", shopId)
    .eq("status", "waiting")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (front?.id !== entryId) return;
  await autoNotifyQueueFront(supabase, shopId, shopName);
}
