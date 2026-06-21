import { createClient } from "@supabase/supabase-js";
import { sendClientBookingConfirmation } from "./booking-notifications";
import { sendAftercareEmail } from "./email";
import { canSendSms, canSendWhatsApp, sendSms, sendWhatsApp } from "./sms";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DEFAULT_AFTERCARE =
  "Thanks for visiting! We hope you love your new look. Avoid heat styling for 24h if you had colour. Use sulphate-free products. Contact us if you have any questions.";

type AppointmentContactRow = {
  id: string;
  end_time: string;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  send_aftercare?: boolean;
  aftercare_sent_at?: string | null;
  clients: { email?: string; phone?: string; name?: string } | null;
  salons: { name?: string; settings?: { aftercare_message?: string } } | null;
};

function serviceAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Send immediate booking confirmation and record confirmation_sent_at.
 */
export async function triggerBookingConfirmation(appointmentId: string): Promise<void> {
  const db = serviceAdmin();
  const { data } = await db
    .from("appointments")
    .select(
      "id, start_time, guest_email, guest_phone, guest_name, confirmation_sent_at, clients(email, phone), salons(name), services(name), appointment_services(sort_order, services(name))"
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!data || data.confirmation_sent_at) return;

  const row = data as {
    start_time: string;
    guest_email: string | null;
    guest_phone: string | null;
    clients: { email?: string; phone?: string } | null;
    salons: { name?: string } | null;
    services: { name?: string } | null;
    appointment_services?: { services?: { name?: string } | null }[];
  };

  const start = new Date(row.start_time);
  const serviceNames = (row.appointment_services ?? [])
    .map((l) => l.services?.name)
    .filter(Boolean) as string[];
  const serviceName =
    serviceNames.length > 0
      ? serviceNames.join(" · ")
      : row.services?.name ?? null;

  await sendClientBookingConfirmation({
    email: row.guest_email ?? row.clients?.email ?? null,
    phone: row.guest_phone ?? row.clients?.phone ?? null,
    salonName: row.salons?.name ?? "Salon",
    start,
    serviceName,
  });

  await db
    .from("appointments")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", appointmentId);
}

/**
 * Send aftercare immediately when an appointment is marked complete.
 */
export async function triggerAftercareOnComplete(appointmentId: string): Promise<{ sent: boolean; error?: string }> {
  const db = serviceAdmin();
  const { data } = await db
    .from("appointments")
    .select(
      "id, end_time, guest_email, guest_name, guest_phone, send_aftercare, aftercare_sent_at, clients(email, phone, name), salons(name, settings)"
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!data) return { sent: false, error: "Appointment not found" };
  const row = data as unknown as AppointmentContactRow;
  if (!row.send_aftercare || row.aftercare_sent_at) return { sent: false };

  const email = row.guest_email ?? row.clients?.email ?? null;
  const phone = row.guest_phone ?? row.clients?.phone ?? null;
  const salonName = row.salons?.name ?? "the salon";
  const customMsg = (row.salons?.settings as { aftercare_message?: string } | undefined)?.aftercare_message;
  const message = customMsg?.trim() || `${salonName}: ${DEFAULT_AFTERCARE}`;

  let sent = false;
  let lastError: string | undefined;

  if (phone && (canSendWhatsApp() || canSendSms())) {
    if (canSendWhatsApp()) {
      const { error } = await sendWhatsApp(phone, message);
      if (!error) sent = true;
      else lastError = error;
    }
    if (!sent && canSendSms()) {
      const { error } = await sendSms(phone, message);
      if (!error) sent = true;
      else lastError = error;
    }
  }
  if (!sent && email) {
    const { error } = await sendAftercareEmail(email, message, salonName);
    if (!error) sent = true;
    else lastError = error;
  }

  if (sent) {
    await db
      .from("appointments")
      .update({ aftercare_sent_at: new Date().toISOString() })
      .eq("id", appointmentId);
    return { sent: true };
  }

  return { sent: false, error: lastError ?? "No contact channel available" };
}

/** Default reminder windows include 48 hours before appointment. */
export const DEFAULT_REMINDER_HOURS = [24, 48] as const;
