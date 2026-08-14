import { NextResponse } from "next/server";
import { createAdminClient } from "@core/supabase/admin";
import { sendBookingConfirmationSms } from "@modules/nail/lib/queue-auto-notify";
import {
  ANY_TECHNICIAN_BOOKING_VALUE,
  resolvePublicBookingTechnician,
} from "@modules/nail/lib/resolve-booking-technician";

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

    const salonId = optionalUuid(body.salonId);
    const guestName =
      typeof body.guestName === "string" ? body.guestName.trim() : "";
    const guestPhone =
      typeof body.guestPhone === "string" ? body.guestPhone.trim() || null : null;
    const technicianIdRaw =
      typeof body.technicianId === "string" && body.technicianId.trim()
        ? body.technicianId.trim()
        : ANY_TECHNICIAN_BOOKING_VALUE;
    const serviceId = optionalUuid(body.serviceId);
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const time = typeof body.time === "string" ? body.time.trim() : "";
    const notes =
      typeof body.notes === "string" ? body.notes.trim() || null : null;

    if (!salonId) {
      return NextResponse.json(
        { success: false, error: "Salon not found." },
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
      console.error("nail public book: admin client unavailable", err);
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable." },
        { status: 503 }
      );
    }

    const { data: salon, error: salonError } = await supabase
      .from("nail_salons")
      .select("id, name")
      .eq("id", salonId)
      .single();

    if (salonError || !salon) {
      console.error("nail public book: salon lookup failed", salonError);
      return NextResponse.json(
        { success: false, error: "Salon not found." },
        { status: 404 }
      );
    }

    let durationMinutes = 30;
    let serviceName: string | null = null;
    if (serviceId) {
      const { data: service } = await supabase
        .from("nail_services")
        .select("duration_minutes, name")
        .eq("id", serviceId)
        .eq("salon_id", salonId)
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
    const resolved = await resolvePublicBookingTechnician(
      supabase,
      salonId,
      technicianIdRaw,
      startTime.toISOString(),
      endTime.toISOString()
    );
    if (resolved.error || !resolved.technician) {
      return NextResponse.json(
        { success: false, error: resolved.error ?? "Could not assign a technician." },
        { status: 400 }
      );
    }
    const technician = resolved.technician;

    const { error: insertError } = await supabase.from("nail_appointments").insert({
      salon_id: salonId,
      technician_id: technician.id,
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
      console.error("nail public book: insert failed", insertError);
      return NextResponse.json(
        { success: false, error: "Could not save your booking. Please try again." },
        { status: 500 }
      );
    }

    const salonDisplayName = salon.name?.trim() || "the nail bar";
    const technicianDisplayName = technician.display_name?.trim() || null;
    const showTechnician = technician.showToClient && !!technicianDisplayName;
    let smsSent = false;
    if (guestPhone) {
      try {
        smsSent = await sendBookingConfirmationSms({
          guestPhone,
          guestName,
          salonName: salonDisplayName,
          technicianName: showTechnician ? technicianDisplayName : null,
          startTime: startTime.toISOString(),
          serviceName,
        });
      } catch (smsErr) {
        console.error("nail public book: SMS failed", smsErr);
      }
    }

    return NextResponse.json({
      success: true,
      startTime: startTime.toISOString(),
      technicianName: showTechnician ? technicianDisplayName ?? undefined : undefined,
      technicianAvatarUrl: showTechnician ? technician.avatar_url : null,
      showTechnician,
      smsSent,
    });
  } catch (err) {
    console.error("nail public book failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not save your booking. Please try again." },
      { status: 500 }
    );
  }
}
