import { NextResponse } from "next/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { canSendSms, sendSms } from "@/lib/sms";

export async function POST(request: Request) {
  const context = await getCurrentUserSalon();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = (await request.json()) as { appointmentId?: string };
  const appointmentId = body.appointmentId;
  if (!appointmentId) return NextResponse.json({ error: "Missing appointmentId" }, { status: 400 });

  const supabase = await createClient();
  const { data: apt } = await supabase
    .from("appointments")
    .select("id, start_time, client_id, guest_name, guest_phone, clients(name, phone)")
    .eq("id", appointmentId)
    .eq("salon_id", context.salon.id)
    .single();

  if (!apt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

  const client = Array.isArray(apt.clients) ? apt.clients[0] : apt.clients;
  const phone = (client as { phone?: string | null })?.phone ?? apt.guest_phone;
  const clientName = (client as { name?: string | null })?.name ?? apt.guest_name ?? "there";

  if (!phone) {
    return NextResponse.json({ error: "No phone number on file for this client" }, { status: 422 });
  }

  if (!canSendSms()) {
    return NextResponse.json({ error: "SMS is not configured. Set up Twilio in your environment variables." }, { status: 422 });
  }

  const startDate = new Date(apt.start_time);
  const timeStr = startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const message = `Hi ${clientName}, we're running a little behind schedule for your ${timeStr} appointment at ${context.salon.name}. We apologise for the delay and will be with you as soon as possible.`;

  const result = await sendSms(phone, message);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
