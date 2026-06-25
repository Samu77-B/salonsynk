import { formatSalonDateLabel, formatSalonTimeLabel } from "@/lib/ai/salon-time";
import { createClient } from "@/lib/supabase/server";
import { triggerBookingConfirmation, triggerAftercareOnComplete } from "@/lib/appointment-automation";
import { sendClientBookingConfirmation } from "@/lib/booking-notifications";
import { sendAppointmentReminder } from "@/lib/email";
import { canSendSms, canSendWhatsApp, sendSms, sendWhatsApp } from "@/lib/sms";
import { executeAppointmentPatch } from "@/lib/appointments/patch-appointment";
import { executeDeleteAppointment } from "@/lib/appointments/delete-appointment";

type AppointmentContactRow = {
  id: string;
  salon_id: string;
  start_time: string;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  clients: { email?: string; phone?: string; name?: string } | null;
  salons: { name?: string } | null;
  services: { name?: string } | null;
  appointment_services?: { services?: { name?: string } | null }[];
};

async function loadAppointmentForSalon(appointmentId: string, salonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, salon_id, start_time, guest_email, guest_name, guest_phone, clients(email, phone, name), salons(name), services(name), appointment_services(sort_order, services(name))"
    )
    .eq("id", appointmentId)
    .eq("salon_id", salonId)
    .maybeSingle();
  if (error || !data) return { error: error?.message ?? "Appointment not found" };
  return { row: data as unknown as AppointmentContactRow };
}

function contactFromRow(row: AppointmentContactRow) {
  return {
    email: row.guest_email ?? row.clients?.email ?? null,
    phone: row.guest_phone ?? row.clients?.phone ?? null,
    name: row.guest_name ?? row.clients?.name ?? "there",
  };
}

function serviceLabel(row: AppointmentContactRow): string | null {
  const fromLines = (row.appointment_services ?? [])
    .map((l) => l.services?.name)
    .filter(Boolean) as string[];
  if (fromLines.length > 0) return fromLines.join(" · ");
  return row.services?.name ?? null;
}

export async function synkaiSendBookingConfirmation(
  appointmentId: string,
  salonId: string
): Promise<{ ok: boolean; error?: string; channel?: string }> {
  const loaded = await loadAppointmentForSalon(appointmentId, salonId);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const row = loaded.row;
  const contact = contactFromRow(row);
  if (!contact.email && !contact.phone) {
    return { ok: false, error: "No email or phone on file for this client." };
  }

  const start = new Date(row.start_time);
  const result = await sendClientBookingConfirmation({
    email: contact.email,
    phone: contact.phone,
    salonName: row.salons?.name ?? "Salon",
    start,
    serviceName: serviceLabel(row),
  });

  if (result.emailError) return { ok: false, error: result.emailError };

  await triggerBookingConfirmation(appointmentId);
  return { ok: true, channel: contact.email ? "email" : "sms" };
}

export async function synkaiSendAppointmentReminder(
  appointmentId: string,
  salonId: string
): Promise<{ ok: boolean; error?: string; channel?: string }> {
  const loaded = await loadAppointmentForSalon(appointmentId, salonId);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const row = loaded.row;
  const contact = contactFromRow(row);
  if (!contact.email && !contact.phone) {
    return { ok: false, error: "No email or phone on file for this client." };
  }

  const start = new Date(row.start_time);
  const dateStr = formatSalonDateLabel(start);
  const timeStr = formatSalonTimeLabel(start);
  const salonName = row.salons?.name ?? "Salon";
  const smsBody = `Reminder: your appointment at ${salonName} is on ${dateStr} at ${timeStr}.`;

  let sent = false;
  let lastError: string | undefined;
  let channel: string | undefined;

  if (contact.phone && (canSendWhatsApp() || canSendSms())) {
    if (canSendWhatsApp()) {
      const { error } = await sendWhatsApp(contact.phone, smsBody);
      if (!error) {
        sent = true;
        channel = "whatsapp";
      } else lastError = error;
    }
    if (!sent && canSendSms()) {
      const { error } = await sendSms(contact.phone, smsBody);
      if (!error) {
        sent = true;
        channel = "sms";
      } else lastError = error;
    }
  }

  if (!sent && contact.email) {
    const { error } = await sendAppointmentReminder(contact.email, {
      clientName: contact.name,
      date: dateStr,
      time: timeStr,
      salonName,
    });
    if (!error) {
      sent = true;
      channel = "email";
    } else lastError = error;
  }

  if (!sent) {
    return { ok: false, error: lastError ?? "SMS/email is not configured or no contact channel available." };
  }

  const supabase = await createClient();
  await supabase
    .from("appointments")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("salon_id", salonId);

  return { ok: true, channel };
}

export async function synkaiSendAftercare(
  appointmentId: string,
  salonId: string
): Promise<{ ok: boolean; error?: string; channel?: string }> {
  const result = await triggerAftercareOnComplete(appointmentId);
  if (result.sent) return { ok: true };

  const loaded = await loadAppointmentForSalon(appointmentId, salonId);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const supabase = await createClient();
  await supabase.from("appointments").update({ send_aftercare: true }).eq("id", appointmentId).eq("salon_id", salonId);
  const retry = await triggerAftercareOnComplete(appointmentId);
  if (retry.sent) return { ok: true };
  return { ok: false, error: retry.error ?? "Could not send aftercare — check client contact details and Twilio/Resend config." };
}

export async function synkaiSendRunningLate(
  appointmentId: string,
  salonId: string,
  salonName: string
): Promise<{ ok: boolean; error?: string }> {
  const loaded = await loadAppointmentForSalon(appointmentId, salonId);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const row = loaded.row;
  const contact = contactFromRow(row);
  if (!contact.phone) return { ok: false, error: "No phone number on file for this client." };
  if (!canSendSms()) return { ok: false, error: "SMS is not configured (Twilio)." };

  const start = new Date(row.start_time);
  const timeStr = formatSalonTimeLabel(start);
  const message = `Hi ${contact.name}, we're running a little behind schedule for your ${timeStr} appointment at ${salonName}. We apologise for the delay and will be with you as soon as possible.`;

  const result = await sendSms(contact.phone, message);
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}

export async function synkaiCancelAppointment(
  appointmentId: string,
  salonId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("salon_id", salonId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Appointment not found." };

  const result = await executeAppointmentPatch(appointmentId, { status: "canceled" });
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}

export async function synkaiDeleteAppointment(
  appointmentId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await executeDeleteAppointment(appointmentId);
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}
