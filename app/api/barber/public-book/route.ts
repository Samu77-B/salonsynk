import { NextResponse } from "next/server";
import { createAdminClient } from "@core/supabase/admin";
import { sendBookingConfirmationSms } from "@modules/barber/lib/queue-auto-notify";
import {
  ANY_BARBER_BOOKING_VALUE,
  resolvePublicBookingBarber,
} from "@modules/barber/lib/resolve-booking-barber";

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
    const barberIdRaw =
      typeof body.barberId === "string" && body.barberId.trim()
        ? body.barberId.trim()
        : ANY_BARBER_BOOKING_VALUE;
    const serviceId = optionalUuid(body.serviceId);
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const time = typeof body.time === "string" ? body.time.trim() : "";
    const notes =
      typeof body.notes === "string" ? body.notes.trim() || null : null;

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
    if (!date || !time) {
      return NextResponse.json(
        { success: false, error: "Please pick a date and time." },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      return NextResponse.json(
        { success: false, error: "Please choose today or a future date." },
        { status: 400 }
      );
    }

    let supabase;
    try {
      supabase = createAdminClient();
    } catch (err) {
      console.error("public book: admin client unavailable", err);
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable." },
        { status: 503 }
      );
    }

    const { data: shop, error: shopError } = await supabase
      .from("barber_shops")
      .select("id, name")
      .eq("id", shopId)
      .single();

    if (shopError || !shop) {
      console.error("public book: shop lookup failed", shopError);
      return NextResponse.json(
        { success: false, error: "Shop not found." },
        { status: 404 }
      );
    }

    let durationMinutes = 30;
    let serviceName: string | null = null;
    if (serviceId) {
      const { data: service } = await supabase
        .from("barber_services")
        .select("duration_minutes, name")
        .eq("id", serviceId)
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .single();
      if (!service) {
        return NextResponse.json(
          { success: false, error: "That service is not available." },
          { status: 400 }
        );
      }
      if (service.duration_minutes) durationMinutes = service.duration_minutes;
      if (service.name) serviceName = service.name;
    }

    const startTime = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startTime.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date or time." },
        { status: 400 }
      );
    }
    if (startTime.getTime() < Date.now() - 60_000) {
      return NextResponse.json(
        { success: false, error: "Please choose a time in the future." },
        { status: 400 }
      );
    }

    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    const resolved = await resolvePublicBookingBarber(
      supabase,
      shopId,
      barberIdRaw,
      startTime.toISOString(),
      endTime.toISOString()
    );
    if (resolved.error || !resolved.barber) {
      return NextResponse.json(
        { success: false, error: resolved.error ?? "Could not assign a barber." },
        { status: 400 }
      );
    }
    const barber = resolved.barber;

    const { error: insertError } = await supabase.from("barber_appointments").insert({
      shop_id: shopId,
      barber_id: barber.id,
      service_id: serviceId,
      guest_name: guestName,
      guest_phone: guestPhone,
      notes,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: "scheduled",
      source: "booking",
    });

    if (insertError) {
      console.error("public book: insert failed", insertError);
      return NextResponse.json(
        { success: false, error: "Could not save your booking. Please try again." },
        { status: 500 }
      );
    }

    const shopDisplayName = shop.name?.trim() || "the barber shop";
    const barberDisplayName = barber.display_name?.trim() || null;
    const showBarber = barber.showToClient && !!barberDisplayName;
    let smsSent = false;
    if (guestPhone) {
      try {
        smsSent = await sendBookingConfirmationSms({
          guestPhone,
          guestName,
          shopName: shopDisplayName,
          barberName: showBarber ? barberDisplayName : null,
          startTime: startTime.toISOString(),
          serviceName,
        });
      } catch (smsErr) {
        console.error("public book: SMS failed", smsErr);
      }
    }

    return NextResponse.json({
      success: true,
      startTime: startTime.toISOString(),
      barberName: showBarber ? barberDisplayName ?? undefined : undefined,
      barberAvatarUrl: showBarber ? barber.avatar_url : null,
      showBarber,
      smsSent,
    });
  } catch (err) {
    console.error("public book failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not save your booking. Please try again." },
      { status: 500 }
    );
  }
}
