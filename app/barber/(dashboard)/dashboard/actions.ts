"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { resolveActingBarberId } from "@modules/barber/lib/resolve-barber-id";
import { autoNotifyQueueAfterAdvance } from "@modules/barber/lib/queue-auto-notify";
import { compactQueuePositions, getNextQueuePosition } from "@modules/barber/lib/queue-positions";
import {
  queueSmsBody,
  sendBarberQueueSms,
  type QueueSmsTemplate,
} from "@modules/barber/lib/queue-sms";

type ActionResult = { error?: string };

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
    memberId: context.member.id,
  };
}

function revalidateQueue() {
  revalidatePath("/barber/dashboard", "page");
}

async function fetchQueueEntry(
  supabase: Awaited<ReturnType<typeof getShopScopedClient>>["supabase"],
  shopId: string,
  queueEntryId: string
) {
  const { data, error } = await supabase
    .from("barber_queue")
    .select("id, guest_name, guest_phone, called_at, next_sms_sent_at, status")
    .eq("id", queueEntryId)
    .eq("shop_id", shopId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function notifyQueueCustomer(
  queueEntryId: string,
  template: QueueSmsTemplate = "next"
): Promise<{ error?: string; sent?: boolean }> {
  try {
    const { supabase, shopId, shopName } = await getShopScopedClient();
    const entry = await fetchQueueEntry(supabase, shopId, queueEntryId);
    if (!entry) return { error: "Queue entry not found" };
    if (!entry.guest_phone?.trim()) return { error: "No phone number for this customer" };

    const body = queueSmsBody(template, {
      clientName: entry.guest_name ?? "there",
      shopName,
    });
    const sms = await sendBarberQueueSms(entry.guest_phone, body);
    if (sms.error) return { error: sms.error, sent: false };

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("barber_queue")
      .update({
        called_at: entry.called_at ?? now,
        ...(template === "next" && sms.sent ? { next_sms_sent_at: now } : {}),
      })
      .eq("id", queueEntryId)
      .eq("shop_id", shopId);

    if (updateError) return { error: updateError.message };

    revalidateQueue();
    return { sent: sms.sent };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send notification" };
  }
}

export async function sendQueueCustomMessage(
  queueEntryId: string,
  message: string
): Promise<{ error?: string; sent?: boolean }> {
  try {
    const { supabase, shopId } = await getShopScopedClient();
    const entry = await fetchQueueEntry(supabase, shopId, queueEntryId);
    if (!entry) return { error: "Queue entry not found" };
    if (!entry.guest_phone?.trim()) return { error: "No phone number for this customer" };

    const trimmed = message.trim();
    if (!trimmed) return { error: "Message is empty" };

    const sms = await sendBarberQueueSms(entry.guest_phone, trimmed);
    if (sms.error) return { error: sms.error, sent: false };

    revalidateQueue();
    return { sent: sms.sent };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send message" };
  }
}

export async function addToQueue(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, shopId } = await getShopScopedClient();

    const guestName = (formData.get("guest_name") as string)?.trim() || "Walk-in";
    const guestPhone = (formData.get("guest_phone") as string)?.trim() || null;
    const serviceId = (formData.get("service_id") as string) || null;
    const preferredBarberId = (formData.get("preferred_barber_id") as string) || null;

    const nextPosition = await getNextQueuePosition(supabase, shopId);

    const { error } = await supabase.from("barber_queue").insert({
      shop_id: shopId,
      guest_name: guestName,
      guest_phone: guestPhone,
      service_id: serviceId,
      preferred_barber_id: preferredBarberId,
      position: nextPosition,
      status: "waiting",
      joined_at: new Date().toISOString(),
    });

    if (error) return { error: error.message };
    revalidateQueue();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not add to queue" };
  }
}

export async function startService(
  queueEntryId: string,
  barberId: string
): Promise<ActionResult> {
  try {
    const { supabase, shopId, shopName } = await getShopScopedClient();

    const resolved = await resolveActingBarberId(supabase, shopId, barberId);
    if (resolved.error || !resolved.barberId) {
      return { error: resolved.error ?? "Could not resolve barber" };
    }

    const entry = await fetchQueueEntry(supabase, shopId, queueEntryId);

    const { error } = await supabase
      .from("barber_queue")
      .update({
        status: "in_chair",
        assigned_barber_id: resolved.barberId,
        called_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      })
      .eq("id", queueEntryId)
      .eq("shop_id", shopId)
      .eq("status", "waiting");

    if (error) return { error: error.message };

    if (entry?.guest_phone?.trim() && !entry.next_sms_sent_at) {
      const body = queueSmsBody("ready", {
        clientName: entry.guest_name ?? "there",
        shopName,
      });
      const sms = await sendBarberQueueSms(entry.guest_phone, body);
      if (sms.sent) {
        await supabase
          .from("barber_queue")
          .update({ next_sms_sent_at: new Date().toISOString() })
          .eq("id", queueEntryId)
          .eq("shop_id", shopId);
      }
    }

    await compactQueuePositions(supabase, shopId);
    await autoNotifyQueueAfterAdvance(supabase, shopId, shopName);

    revalidateQueue();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not start service" };
  }
}

export async function completeService(
  queueEntryId: string,
  paymentMethod: "card" | "cash" | "other",
  amountMinor?: number
): Promise<ActionResult> {
  try {
    const { supabase, shopId, shopName } = await getShopScopedClient();

    const { data: entry, error: fetchErr } = await supabase
      .from("barber_queue")
      .select("service_id, assigned_barber_id, client_id, guest_name")
      .eq("id", queueEntryId)
      .eq("shop_id", shopId)
      .single();

    if (fetchErr || !entry) return { error: fetchErr?.message ?? "Entry not found" };

    const { error } = await supabase
      .from("barber_queue")
      .update({
        status: "completed",
        payment_method: paymentMethod,
        amount_paid_minor: amountMinor ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", queueEntryId)
      .eq("shop_id", shopId);

    if (error) return { error: error.message };

    if (amountMinor && amountMinor > 0) {
      await supabase.from("barber_sales_transactions").insert({
        shop_id: shopId,
        barber_id: entry.assigned_barber_id,
        client_id: entry.client_id,
        queue_entry_id: queueEntryId,
        amount_minor: amountMinor,
        currency: "gbp",
        payment_method: paymentMethod,
        service_ids: entry.service_id ? [entry.service_id] : [],
      });
    }

    await compactQueuePositions(supabase, shopId);
    await autoNotifyQueueAfterAdvance(supabase, shopId, shopName);

    revalidateQueue();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not complete service" };
  }
}

export async function removeFromQueue(
  queueEntryId: string,
  reason: "no_show" | "left" = "left"
): Promise<ActionResult> {
  try {
    const { supabase, shopId, shopName } = await getShopScopedClient();

    const { error } = await supabase
      .from("barber_queue")
      .update({ status: reason, completed_at: new Date().toISOString() })
      .eq("id", queueEntryId)
      .eq("shop_id", shopId);

    if (error) return { error: error.message };

    await compactQueuePositions(supabase, shopId);
    await autoNotifyQueueAfterAdvance(supabase, shopId, shopName);
    revalidateQueue();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not remove from queue" };
  }
}
