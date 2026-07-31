import type { SupabaseClient } from "@supabase/supabase-js";
import { canSendSms } from "@core/utils/sms";
import {
  queueJoinedSmsBody,
  queueSmsBody,
  bookingConfirmationSmsBody,
  sendBarberQueueSms,
} from "./queue-sms";

/** Text a customer when they join the queue with their position and estimated wait. */
export async function sendJoinQueueSms(
  supabase: SupabaseClient,
  shopId: string,
  shopName: string,
  entryId: string,
  position: number,
  guestPhone: string,
  guestName: string | null
): Promise<void> {
  if (!canSendSms() || !guestPhone.trim()) return;

  const body = queueJoinedSmsBody({
    clientName: guestName ?? "there",
    shopName,
    position,
  });
  const sms = await sendBarberQueueSms(guestPhone, body);
  if (!sms.sent) return;

  const now = new Date().toISOString();
  const update: Record<string, string> = {};
  if (position <= 1) update.next_sms_sent_at = now;
  if (position === 2) update.almost_next_sms_sent_at = now;

  if (Object.keys(update).length > 0) {
    await supabase
      .from("barber_queue")
      .update(update)
      .eq("id", entryId)
      .eq("shop_id", shopId);
  }
}

/** Text a customer when they book a future appointment. */
export async function sendBookingConfirmationSms(opts: {
  guestPhone: string;
  guestName: string | null;
  shopName: string;
  barberName?: string | null;
  startTime: string;
  serviceName?: string | null;
}): Promise<boolean> {
  if (!canSendSms() || !opts.guestPhone.trim()) return false;

  const body = bookingConfirmationSmsBody({
    clientName: opts.guestName ?? "there",
    shopName: opts.shopName,
    barberName: opts.barberName,
    startTime: opts.startTime,
    serviceName: opts.serviceName,
  });
  const sms = await sendBarberQueueSms(opts.guestPhone, body);
  return sms.sent;
}

/**
 * Text waiting customers after the queue advances:
 * - #1 gets "you'll be up next" (once)
 * - #2 gets ~20 minutes warning (once)
 */
export async function autoNotifyQueueAfterAdvance(
  supabase: SupabaseClient,
  shopId: string,
  shopName: string
): Promise<void> {
  if (!canSendSms()) return;

  const { data: waiting } = await supabase
    .from("barber_queue")
    .select(
      "id, guest_name, guest_phone, next_sms_sent_at, almost_next_sms_sent_at, called_at"
    )
    .eq("shop_id", shopId)
    .eq("status", "waiting")
    .order("position", { ascending: true })
    .limit(2);

  if (!waiting?.length) return;

  const front = waiting[0];
  if (front?.guest_phone?.trim() && !front.next_sms_sent_at) {
    const body = queueSmsBody("next", {
      clientName: front.guest_name ?? "there",
      shopName,
    });
    const sms = await sendBarberQueueSms(front.guest_phone, body);
    if (sms.sent) {
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
  }

  const second = waiting[1];
  if (second?.guest_phone?.trim() && !second.almost_next_sms_sent_at) {
    const body = queueSmsBody("almost_next", {
      clientName: second.guest_name ?? "there",
      shopName,
    });
    const sms = await sendBarberQueueSms(second.guest_phone, body);
    if (sms.sent) {
      await supabase
        .from("barber_queue")
        .update({ almost_next_sms_sent_at: new Date().toISOString() })
        .eq("id", second.id)
        .eq("shop_id", shopId);
    }
  }
}

/** @deprecated Use autoNotifyQueueAfterAdvance */
export const autoNotifyQueueFront = autoNotifyQueueAfterAdvance;
