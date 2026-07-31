import type { SupabaseClient } from "@supabase/supabase-js";
import { canSendSms } from "@core/utils/sms";
import { queueJoinedSmsBody, queueSmsBody, sendSalonQueueSms } from "./queue-sms";

export async function sendJoinQueueSms(
  supabase: SupabaseClient,
  salonId: string,
  salonName: string,
  entryId: string,
  position: number,
  guestPhone: string,
  guestName: string | null
): Promise<void> {
  if (!canSendSms() || !guestPhone.trim()) return;

  const body = queueJoinedSmsBody({
    clientName: guestName ?? "there",
    shopName: salonName,
    position,
  });
  const sms = await sendSalonQueueSms(guestPhone, body);
  if (!sms.sent) return;

  const now = new Date().toISOString();
  const update: Record<string, string> = {};
  if (position <= 1) update.next_sms_sent_at = now;
  if (position === 2) update.almost_next_sms_sent_at = now;

  if (Object.keys(update).length > 0) {
    await supabase
      .from("salon_queue")
      .update(update)
      .eq("id", entryId)
      .eq("salon_id", salonId);
  }
}

export async function autoNotifyQueueAfterAdvance(
  supabase: SupabaseClient,
  salonId: string,
  salonName: string
): Promise<void> {
  if (!canSendSms()) return;

  const { data: waiting } = await supabase
    .from("salon_queue")
    .select(
      "id, guest_name, guest_phone, next_sms_sent_at, almost_next_sms_sent_at, called_at"
    )
    .eq("salon_id", salonId)
    .eq("status", "waiting")
    .order("position", { ascending: true })
    .limit(2);

  if (!waiting?.length) return;

  const front = waiting[0];
  if (front?.guest_phone?.trim() && !front.next_sms_sent_at) {
    const body = queueSmsBody("next", {
      clientName: front.guest_name ?? "there",
      shopName: salonName,
    });
    const sms = await sendSalonQueueSms(front.guest_phone, body);
    if (sms.sent) {
      const now = new Date().toISOString();
      await supabase
        .from("salon_queue")
        .update({
          next_sms_sent_at: now,
          called_at: front.called_at ?? now,
        })
        .eq("id", front.id)
        .eq("salon_id", salonId);
    }
  }

  const second = waiting[1];
  if (second?.guest_phone?.trim() && !second.almost_next_sms_sent_at) {
    const body = queueSmsBody("almost_next", {
      clientName: second.guest_name ?? "there",
      shopName: salonName,
    });
    const sms = await sendSalonQueueSms(second.guest_phone, body);
    if (sms.sent) {
      await supabase
        .from("salon_queue")
        .update({ almost_next_sms_sent_at: new Date().toISOString() })
        .eq("id", second.id)
        .eq("salon_id", salonId);
    }
  }
}
