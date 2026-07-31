"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserSalon } from "@core/supabase/salon";
import { resolveActingStylistId } from "@modules/salon-walk-in/lib/resolve-stylist-id";
import { autoNotifyQueueAfterAdvance } from "@modules/salon-walk-in/lib/queue-auto-notify";
import { compactQueuePositions, getNextQueuePosition } from "@modules/salon-walk-in/lib/queue-positions";
import {
  queueSmsBody,
  sendSalonQueueSms,
  type QueueSmsTemplate,
} from "@modules/salon-walk-in/lib/queue-sms";

type ActionResult = { error?: string };

async function getSalonScopedClient() {
  const context = await getCurrentUserSalon();
  if (!context) throw new Error("No salon context");
  const isSuperAdmin = await getIsSuperAdmin();
  const supabase = isSuperAdmin
    ? (() => {
        try {
          return createAdminClient();
        } catch {
          return null;
        }
      })()
    : null;
  return {
    supabase: supabase ?? (await createClient()),
    salonId: context.salon.id,
    salonName: context.salon.name,
    memberId: context.member.id,
  };
}

function revalidateQueue() {
  revalidatePath("/queue", "page");
}

async function fetchQueueEntry(
  supabase: Awaited<ReturnType<typeof getSalonScopedClient>>["supabase"],
  salonId: string,
  queueEntryId: string
) {
  const { data, error } = await supabase
    .from("salon_queue")
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
    const sms = await sendSalonQueueSms(entry.guest_phone, body);
    if (sms.error) return { error: sms.error, sent: false };

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("salon_queue")
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

    const sms = await sendSalonQueueSms(entry.guest_phone, trimmed);
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
    const preferredStylistId = (formData.get("preferred_stylist_id") as string) || null;

    const nextPosition = await getNextQueuePosition(supabase, salonId);

    const { error } = await supabase.from("salon_queue").insert({
      salon_id: salonId,
      guest_name: guestName,
      guest_phone: guestPhone,
      service_id: serviceId,
      preferred_stylist_id: preferredStylistId,
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
  stylistId: string
): Promise<ActionResult> {
  try {
    const { supabase, salonId, salonName } = await getSalonScopedClient();

    const resolved = await resolveActingStylistId(supabase, salonId, stylistId);
    if (resolved.error || !resolved.stylistId) {
      return { error: resolved.error ?? "Could not resolve stylist" };
    }

    const entry = await fetchQueueEntry(supabase, salonId, queueEntryId);

    const { error } = await supabase
      .from("salon_queue")
      .update({
        status: "in_chair",
        assigned_stylist_id: resolved.stylistId,
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
      const sms = await sendSalonQueueSms(entry.guest_phone, body);
      if (sms.sent) {
        await supabase
          .from("salon_queue")
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
      .from("salon_queue")
      .select("service_id, assigned_stylist_id, client_id, guest_name")
      .eq("id", queueEntryId)
      .eq("salon_id", salonId)
      .single();

    if (fetchErr || !entry) return { error: fetchErr?.message ?? "Entry not found" };

    const { error } = await supabase
      .from("salon_queue")
      .update({
        status: "completed",
        payment_method: paymentMethod,
        amount_paid_minor: amountMinor ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", queueEntryId)
      .eq("salon_id", salonId);

    if (error) return { error: error.message };

    if (amountMinor && amountMinor > 0 && entry.assigned_stylist_id) {
      const { data: salon } = await supabase
        .from("salons")
        .select("payment_gateway")
        .eq("id", salonId)
        .single();
      const gateway = (salon?.payment_gateway as string) || "other_pos";

      const { data: stylist } = await supabase
        .from("salon_members")
        .select("employment_type")
        .eq("id", entry.assigned_stylist_id)
        .single();

      await supabase.from("sales_transactions").insert({
        salon_id: salonId,
        stylist_id: entry.assigned_stylist_id,
        client_id: entry.client_id,
        stripe_payment_intent_id: `walkin_queue_${queueEntryId}`.slice(0, 255),
        payment_gateway: gateway,
        amount_minor: amountMinor,
        currency: "gbp",
        employment_type: (stylist?.employment_type as string) || "EMPLOYEE",
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
      .from("salon_queue")
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
