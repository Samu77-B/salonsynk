"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import {
  assertCanManageInChairEntry,
  assertCanStartQueueEntry,
  hasQueueManagerAccess,
} from "@core/queue/platform-queue-access";
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
  if (!context) return { error: "No barber shop context. Sign in again and retry." } as const;
  const isSuperAdmin = await getIsSuperAdmin();
  const isManagerView = hasQueueManagerAccess(
    isSuperAdmin,
    context.member.role ?? "",
    context.member.id
  );
  const supabase = isSuperAdmin
    ? (() => { try { return createAdminClient(); } catch { return null; } })()
    : null;

  let actingMemberId = context.member.id;
  if (actingMemberId === "admin" || !/^[0-9a-f-]{36}$/i.test(actingMemberId)) {
    const client = supabase ?? (await createClient());
    const resolved = await resolveActingBarberId(client, context.shop.id, actingMemberId);
    if (resolved.barberId) actingMemberId = resolved.barberId;
  }

  return {
    supabase: supabase ?? (await createClient()),
    shopId: context.shop.id,
    shopName: context.shop.name,
    memberId: actingMemberId,
    isManagerView,
  } as const;
}

function revalidateQueue() {
  revalidatePath("/barber/dashboard", "page");
}

async function fetchQueueEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  queueEntryId: string
) {
  const { data, error } = await supabase
    .from("barber_queue")
    .select(
      "id, guest_name, guest_phone, called_at, next_sms_sent_at, status, preferred_barber_id, assigned_barber_id"
    )
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
    const scoped = await getShopScopedClient();
    if ("error" in scoped) return { error: scoped.error };
    const { supabase, shopId, shopName, isManagerView } = scoped;
    if (!isManagerView) return { error: "Only managers can send queue notifications" };
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
    const scoped = await getShopScopedClient();
    if ("error" in scoped) return { error: scoped.error };
    const { supabase, shopId, isManagerView } = scoped;
    if (!isManagerView) return { error: "Only managers can send queue messages" };
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
    const scoped = await getShopScopedClient();
    if ("error" in scoped) return { error: scoped.error };
    const { supabase, shopId, isManagerView } = scoped;
    if (!isManagerView) return { error: "Only managers can add customers from the desk" };

    const guestName = (formData.get("guest_name") as string)?.trim() || "Walk-in";
    const guestPhone = (formData.get("guest_phone") as string)?.trim() || null;
    const serviceIdRaw = (formData.get("service_id") as string)?.trim();
    const serviceId =
      serviceIdRaw && /^[0-9a-f-]{36}$/i.test(serviceIdRaw) ? serviceIdRaw : null;
    const preferredRaw = (formData.get("preferred_barber_id") as string)?.trim();
    const preferredBarberId =
      preferredRaw && /^[0-9a-f-]{36}$/i.test(preferredRaw) ? preferredRaw : null;

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
    const scoped = await getShopScopedClient();
    if ("error" in scoped) return { error: scoped.error };
    const { supabase, shopId, shopName, isManagerView } = scoped;

    const resolved = await resolveActingBarberId(supabase, shopId, barberId);
    if (resolved.error || !resolved.barberId) {
      return { error: resolved.error ?? "Could not resolve barber" };
    }

    const entry = await fetchQueueEntry(supabase, shopId, queueEntryId);
    if (!entry) return { error: "Queue entry not found" };

    const startError = assertCanStartQueueEntry(
      {
        preferred_staff_id: entry.preferred_barber_id,
        status: entry.status,
      },
      resolved.barberId,
      isManagerView
    );
    if (startError) return { error: startError };

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
    const scoped = await getShopScopedClient();
    if ("error" in scoped) return { error: scoped.error };
    const { supabase, shopId, shopName, memberId, isManagerView } = scoped;

    const { data: entry, error: fetchErr } = await supabase
      .from("barber_queue")
      .select("service_id, assigned_barber_id, client_id, guest_name, status")
      .eq("id", queueEntryId)
      .eq("shop_id", shopId)
      .single();

    if (fetchErr || !entry) return { error: fetchErr?.message ?? "Entry not found" };

    const touchError = assertCanManageInChairEntry(
      { assigned_staff_id: entry.assigned_barber_id },
      memberId,
      isManagerView
    );
    if (touchError) return { error: touchError };

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
    const scoped = await getShopScopedClient();
    if ("error" in scoped) return { error: scoped.error };
    const { supabase, shopId, shopName, memberId, isManagerView } = scoped;

    if (!isManagerView) {
      const { data: entry } = await supabase
        .from("barber_queue")
        .select("assigned_barber_id, status, preferred_barber_id")
        .eq("id", queueEntryId)
        .eq("shop_id", shopId)
        .single();

      if (entry?.status === "in_chair") {
        const touchError = assertCanManageInChairEntry(
          { assigned_staff_id: entry.assigned_barber_id },
          memberId,
          false
        );
        if (touchError) return { error: touchError };
      } else if (entry?.status === "waiting") {
        const startError = assertCanStartQueueEntry(
          {
            preferred_staff_id: entry.preferred_barber_id,
            status: entry.status,
          },
          memberId,
          false
        );
        if (startError) return { error: startError };
      }
    }

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
