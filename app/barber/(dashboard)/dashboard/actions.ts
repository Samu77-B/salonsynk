"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserShop } from "@modules/barber/lib/shop";

async function getShopScopedClient() {
  const context = await getCurrentUserShop();
  if (!context) throw new Error("No barber shop context");
  const isSuperAdmin = await getIsSuperAdmin();
  const supabase = isSuperAdmin
    ? (() => { try { return createAdminClient(); } catch { return null; } })()
    : null;
  return {
    supabase: supabase ?? await createClient(),
    shopId: context.shop.id,
  };
}

function revalidateQueue() {
  revalidatePath("/barber/dashboard", "page");
}

/* ------------------------------------------------------------------ */
/*  Add walk-in to queue                                              */
/* ------------------------------------------------------------------ */
export async function addToQueue(formData: FormData) {
  const { supabase, shopId } = await getShopScopedClient();

  const guestName = (formData.get("guest_name") as string)?.trim() || "Walk-in";
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
    service_id: serviceId,
    preferred_barber_id: preferredBarberId,
    position: nextPosition,
    status: "waiting",
    joined_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  revalidateQueue();
}

/* ------------------------------------------------------------------ */
/*  Start service — move from 'waiting' to 'in_chair'                */
/* ------------------------------------------------------------------ */
export async function startService(queueEntryId: string, barberId: string) {
  const { supabase, shopId } = await getShopScopedClient();

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
  revalidateQueue();
}

/* ------------------------------------------------------------------ */
/*  Complete service — mark done and record payment method            */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Mark as no-show / left                                            */
/* ------------------------------------------------------------------ */
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
