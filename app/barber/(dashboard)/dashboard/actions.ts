"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import {
  queueSmsBody,
  sendBarberQueueSms,
  type QueueSmsTemplate,
} from "@modules/barber/lib/queue-sms";

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

function revalidateQueue() {
  revalidatePath("/barber/dashboard", "page");
}

async function fetchQueueEntry(supabase: Awaited<ReturnType<typeof getShopScopedClient>>["supabase"], shopId: string, queueEntryId: string) {
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
  await supabase
    .from("barber_queue")
    .update({
      called_at: entry.called_at ?? now,
      ...(template === "next" && sms.sent ? { next_sms_sent_at: now } : {}),
    })
    .eq("id", queueEntryId)
    .eq("shop_id", shopId);

  revalidateQueue();
  return { sent: sms.sent };
}

export async function sendQueueCustomMessage(
  queueEntryId: string,
  message: string
): Promise<{ error?: string; sent?: boolean }> {
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
}

export async function addToQueue(formData: FormData) {
  const { supabase, shopId } = await getShopScopedClient();

  const guestName = (formData.get("guest_name") as string)?.trim() || "Walk-in";
  const guestPhone = (formData.get("guest_phone") as string)?.trim() || null;
  const serviceId = (formData.get("service_id") as string) || null;
  const preferredBarberId = (formData.get("preferred_barber_id") as string) || null;

  const { data: maxPos } = await supabase
    .from("barber_queue")
    .select("position")
    .eq("shop_id", shopId)
    .eq("status", "waiting")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (maxPos?.position ?? 0) + 1;

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

  if (error) throw new Error(error.message);
  revalidateQueue();
}

export async function startService(queueEntryId: string, barberId: string) {
  const { supabase, shopId, shopName } = await getShopScopedClient();

  const entry = await fetchQueueEntry(supabase, shopId, queueEntryId);

  const { error } = await supabase
    .from("barber_queue")
    .update({
      status: "in_chair",
      assigned_barber_id: barberId,
      called_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    })
    .eq("id", queueEntryId)
    .eq("shop_id", shopId)
    .eq("status", "waiting");

  if (error) throw new Error(error.message);

  if (entry?.guest_phone?.trim() && !entry.next_sms_sent_at) {
    const body = queueSmsBody("ready", {
      clientName: entry.guest_name ?? "there",
      shopName,
    });
    await sendBarberQueueSms(entry.guest_phone, body);
    await supabase
      .from("barber_queue")
      .update({ next_sms_sent_at: new Date().toISOString() })
      .eq("id", queueEntryId)
      .eq("shop_id", shopId);
  }

  revalidateQueue();
}

export async function completeService(
  queueEntryId: string,
  paymentMethod: "card" | "cash" | "other",
  amountMinor?: number
) {
  const { supabase, shopId } = await getShopScopedClient();

  const { data: entry, error: fetchErr } = await supabase
    .from("barber_queue")
    .select("service_id, assigned_barber_id, client_id, guest_name")
    .eq("id", queueEntryId)
    .eq("shop_id", shopId)
    .single();

  if (fetchErr || !entry) throw new Error(fetchErr?.message ?? "Entry not found");

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

  if (error) throw new Error(error.message);

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

  revalidateQueue();
}

export async function removeFromQueue(
  queueEntryId: string,
  reason: "no_show" | "left" = "left"
) {
  const { supabase, shopId } = await getShopScopedClient();

  const { error } = await supabase
    .from("barber_queue")
    .update({ status: reason, completed_at: new Date().toISOString() })
    .eq("id", queueEntryId)
    .eq("shop_id", shopId);

  if (error) throw new Error(error.message);
  revalidateQueue();
}
