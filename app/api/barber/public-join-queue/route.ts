import { NextResponse } from "next/server";
import { createAdminClient } from "@core/supabase/admin";
import { sendJoinQueueSms } from "@modules/barber/lib/queue-auto-notify";
import { notifyBarberManagerBySms } from "@modules/barber/lib/manager-notifications";
import { getNextQueuePosition } from "@modules/barber/lib/queue-positions";
import { AVG_SERVICE_MINUTES } from "@modules/barber/lib/queue-sms-messages";

export const dynamic = "force-dynamic";

function optionalUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) return null;
  return trimmed;
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request." },
        { status: 400 }
      );
    }

    const shopId = optionalUuid(body.shopId);
    const guestName =
      typeof body.guestName === "string" ? body.guestName.trim() : "";
    const guestPhone =
      typeof body.guestPhone === "string" ? body.guestPhone.trim() || null : null;
    const serviceId = optionalUuid(body.serviceId);
    const preferredBarberId = optionalUuid(body.preferredBarberId);

    if (!shopId) {
      return NextResponse.json(
        { success: false, error: "Shop not found." },
        { status: 400 }
      );
    }
    if (!guestName) {
      return NextResponse.json(
        { success: false, error: "Please enter your name." },
        { status: 400 }
      );
    }

    let supabase;
    try {
      supabase = createAdminClient();
    } catch (err) {
      console.error("public join-queue: admin client unavailable", err);
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable." },
        { status: 503 }
      );
    }

    const { data: shop, error: shopError } = await supabase
      .from("barber_shops")
      .select("id, name, max_queue_size, settings")
      .eq("id", shopId)
      .single();

    if (shopError || !shop) {
      console.error("public join-queue: shop lookup failed", shopError);
      return NextResponse.json(
        { success: false, error: "Shop not found." },
        { status: 404 }
      );
    }

    const { count, error: countError } = await supabase
      .from("barber_queue")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "waiting");

    if (countError) {
      console.error("public join-queue: count failed", countError);
      return NextResponse.json(
        { success: false, error: "Could not join the queue. Please try again." },
        { status: 500 }
      );
    }

    const currentSize = count ?? 0;
    const maxSize = typeof shop.max_queue_size === "number" ? shop.max_queue_size : 20;
    if (maxSize > 0 && currentSize >= maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "The queue is full right now. Please try again shortly.",
        },
        { status: 409 }
      );
    }

    const nextPosition = await getNextQueuePosition(supabase, shopId);
    const estimatedWait = currentSize * AVG_SERVICE_MINUTES;

    const { data: inserted, error: insertError } = await supabase
      .from("barber_queue")
      .insert({
        shop_id: shopId,
        guest_name: guestName,
        guest_phone: guestPhone,
        service_id: serviceId,
        preferred_barber_id: preferredBarberId,
        position: nextPosition,
        status: "waiting",
        estimated_wait_minutes: estimatedWait,
        joined_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      console.error("public join-queue: insert failed", insertError);
      return NextResponse.json(
        { success: false, error: "Could not join the queue. Please try again." },
        { status: 500 }
      );
    }

    if (guestPhone) {
      try {
        const displayName = shop.name?.trim() || "the barber shop";
        await sendJoinQueueSms(
          supabase,
          shopId,
          displayName,
          inserted.id,
          nextPosition,
          guestPhone,
          guestName
        );
      } catch (smsErr) {
        console.error("public join-queue: SMS failed", smsErr);
      }
    }

    try {
      const displayName = shop.name?.trim() || "the barber shop";
      await notifyBarberManagerBySms({
        supabase,
        shopId,
        shopName: displayName,
        kind: "queue_join",
        guestName,
        detail: `#${nextPosition} in queue`,
        settings: (shop.settings as Record<string, unknown>) ?? null,
      });
    } catch (managerSmsErr) {
      console.error("public join-queue: manager SMS failed", managerSmsErr);
    }

    return NextResponse.json({
      success: true,
      position: nextPosition,
      estimatedWait,
      smsQueued: !!guestPhone,
    });
  } catch (err) {
    console.error("public join-queue failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not join the queue. Please try again." },
      { status: 500 }
    );
  }
}
