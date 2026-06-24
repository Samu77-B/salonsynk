"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { resolveActingTechnicianId } from "@modules/nail/lib/resolve-technician-id";
import { autoNotifyQueueAfterAdvance } from "@modules/nail/lib/queue-auto-notify";
import { compactQueuePositions, getNextQueuePosition } from "@modules/nail/lib/queue-positions";
import {
  queueSmsBody,
  sendNailQueueSms,
  type QueueSmsTemplate,
} from "@modules/nail/lib/queue-sms";

type ActionResult = { error?: string };

async function getSalonScopedClient() {
  const context = await getCurrentUserNailSalon();
  if (!context) throw new Error("No nail salon context");
  const isSuperAdmin = await getIsSuperAdmin();
  const supabase = isSuperAdmin
    ? (() => { try { return createAdminClient(); } catch { return null; } })()
    : null;
  return {
    supabase: supabase ?? (await createClient()),
    salonId: context.salon.id,
    salonName: context.salon.name,
    memberId: context.member.id,
  };
}

function revalidateQueue() {
  revalidatePath("/nail/queue", "page");
}

async function fetchQueueEntry(
  supabase: Awaited<ReturnType<typeof getSalonScopedClient>>["supabase"],
  salonId: string,
  queueEntryId: string
) {
  const { data, error } = await supabase
    .from("nail_queue")
    .select("id, guest_name, guest_phone, called_at, next_sms_sent_at, status")
    .eq("id", queueEntryId)
    .eq("salon_id", salonId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function notifyQueueCustomer(
  queueEntryId: string,
  template: QueueSmsTemplate = "next"
): Promise<{ error?: string; sent?: boolean }> {
  try {
    const { supabase, salonId, salonName } = await getSalonScopedClient();
    const entry = await fetchQueueEntry(supabase, salonId, queueEntryId);
    if (!entry) return { error: "Queue entry not found" };
    if (!entry.guest_phone?.trim()) return { error: "No phone number for this customer" };

    const body = queueSmsBody(template, {
      clientName: entry.guest_name ?? "there",
      shopName: salonName,
    });
    const sms = await sendNailQueueSms(entry.guest_phone, body);
    if (sms.error) return { error: sms.error, sent: false };

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("nail_queue")
      .update({
        called_at: entry.called_at ?? now,
        ...(template === "next" && sms.sent ? { next_sms_sent_at: now } : {}),
      })
      .eq("id", queueEntryId)
      .eq("salon_id", salonId);

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
    const { supabase, salonId } = await getSalonScopedClient();
    const entry = await fetchQueueEntry(supabase, salonId, queueEntryId);
    if (!entry) return { error: "Queue entry not found" };
    if (!entry.guest_phone?.trim()) return { error: "No phone number for this customer" };

    const trimmed = message.trim();
    if (!trimmed) return { error: "Message is empty" };

    const sms = await sendNailQueueSms(entry.guest_phone, trimmed);
    if (sms.error) return { error: sms.error, sent: false };

    revalidateQueue();
    return { sent: sms.sent };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send message" };
  }
}

export async function addToQueue(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, salonId } = await getSalonScopedClient();

    const guestName = (formData.get("guest_name") as string)?.trim() || "Walk-in";
    const guestPhone = (formData.get("guest_phone") as string)?.trim() || null;
    const serviceId = (formData.get("service_id") as string) || null;
    const preferredTechnicianId = (formData.get("preferred_technician_id") as string) || null;

    const nextPosition = await getNextQueuePosition(supabase, salonId);

    const { error } = await supabase.from("nail_queue").insert({
      salon_id: salonId,
      guest_name: guestName,
      guest_phone: guestPhone,
      service_id: serviceId,
      preferred_technician_id: preferredTechnicianId,
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
  technicianId: string
): Promise<ActionResult> {
  try {
    const { supabase, salonId, salonName } = await getSalonScopedClient();

    const resolved = await resolveActingTechnicianId(supabase, salonId, technicianId);
    if (resolved.error || !resolved.technicianId) {
      return { error: resolved.error ?? "Could not resolve technician" };
    }

    const entry = await fetchQueueEntry(supabase, salonId, queueEntryId);

    const { error } = await supabase
      .from("nail_queue")
      .update({
        status: "in_chair",
        assigned_technician_id: resolved.technicianId,
        called_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      })
      .eq("id", queueEntryId)
      .eq("salon_id", salonId)
      .eq("status", "waiting");

    if (error) return { error: error.message };

    if (entry?.guest_phone?.trim() && !entry.next_sms_sent_at) {
      const body = queueSmsBody("ready", {
        clientName: entry.guest_name ?? "there",
        shopName: salonName,
      });
      const sms = await sendNailQueueSms(entry.guest_phone, body);
      if (sms.sent) {
        await supabase
          .from("nail_queue")
          .update({ next_sms_sent_at: new Date().toISOString() })
          .eq("id", queueEntryId)
          .eq("salon_id", salonId);
      }
    }

    await compactQueuePositions(supabase, salonId);
    await autoNotifyQueueAfterAdvance(supabase, salonId, salonName);

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
    const { supabase, salonId, salonName } = await getSalonScopedClient();

    const { data: entry, error: fetchErr } = await supabase
      .from("nail_queue")
      .select("service_id, assigned_technician_id, client_id, guest_name")
      .eq("id", queueEntryId)
      .eq("salon_id", salonId)
      .single();

    if (fetchErr || !entry) return { error: fetchErr?.message ?? "Entry not found" };

    const { error } = await supabase
      .from("nail_queue")
      .update({
        status: "completed",
        payment_method: paymentMethod,
        amount_paid_minor: amountMinor ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", queueEntryId)
      .eq("salon_id", salonId);

    if (error) return { error: error.message };

    if (amountMinor && amountMinor > 0) {
      await supabase.from("nail_sales_transactions").insert({
        salon_id: salonId,
        technician_id: entry.assigned_technician_id,
        client_id: entry.client_id,
        queue_entry_id: queueEntryId,
        amount_minor: amountMinor,
        currency: "gbp",
        payment_method: paymentMethod,
        service_ids: entry.service_id ? [entry.service_id] : [],
      });
    }

    await compactQueuePositions(supabase, salonId);
    await autoNotifyQueueAfterAdvance(supabase, salonId, salonName);

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
    const { supabase, salonId, salonName } = await getSalonScopedClient();

    const { error } = await supabase
      .from("nail_queue")
      .update({ status: reason, completed_at: new Date().toISOString() })
      .eq("id", queueEntryId)
      .eq("salon_id", salonId);

    if (error) return { error: error.message };

    await compactQueuePositions(supabase, salonId);
    await autoNotifyQueueAfterAdvance(supabase, salonId, salonName);
    revalidateQueue();
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not remove from queue" };
  }
}
