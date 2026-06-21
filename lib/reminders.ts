import { createClient } from "@supabase/supabase-js";
import { sendAppointmentReminder } from "./email";
import { canSendSms, canSendWhatsApp, sendSms, sendWhatsApp } from "./sms";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

import { DEFAULT_REMINDER_HOURS } from "./appointment-automation";

const DEFAULT_REMINDER_HOURS_FALLBACK: number[] = [...DEFAULT_REMINDER_HOURS];

type AppointmentRow = {
  id: string;
  salon_id: string;
  start_time: string;
  send_reminder_sms?: boolean;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  clients: { email?: string; phone?: string } | null;
  salons: { name?: string; settings?: Record<string, unknown> } | null;
};

/**
 * Load salon-configured reminder intervals, then fetch appointments that
 * fall inside any of those windows and haven't been reminded yet.
 *
 * The hoursAhead parameter acts as a maximum ceiling (e.g. 48) — the cron
 * caller should pass the largest possible interval so we never miss a window.
 */
export async function getUpcomingAppointmentsForReminder(hoursAhead: number) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const to = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const { data } = await supabase
    .from("appointments")
    .select("id, salon_id, start_time, send_reminder_sms, guest_email, guest_name, guest_phone, clients(email, phone), salons(name, settings)")
    .eq("status", "scheduled")
    .eq("send_reminder_sms", true)
    .is("reminder_sent_at", null)
    .gte("start_time", now.toISOString())
    .lte("start_time", to.toISOString());
  return (data ?? []) as unknown as AppointmentRow[];
}

function getReminderHoursForSalon(settings: Record<string, unknown> | undefined | null): number[] {
  if (!settings) return DEFAULT_REMINDER_HOURS_FALLBACK;
  const hours = settings.reminder_hours;
  if (Array.isArray(hours) && hours.length > 0) {
    return hours.filter((h): h is number => typeof h === "number" && [12, 24, 48].includes(h));
  }
  return DEFAULT_REMINDER_HOURS_FALLBACK;
}

/**
 * Should this appointment receive a reminder right now?
 * True if the appointment starts within any of the salon's configured intervals
 * (e.g. within 12h, 24h, or 48h from now).
 */
function shouldSendNow(appointmentStart: Date, salonReminderHours: number[], now: Date): boolean {
  const msUntilStart = appointmentStart.getTime() - now.getTime();
  if (msUntilStart < 0) return false;
  const hoursUntilStart = msUntilStart / (60 * 60 * 1000);
  for (const h of salonReminderHours) {
    if (hoursUntilStart <= h) return true;
  }
  return false;
}

export async function sendReminders(hoursAhead = 48) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const appointments = await getUpcomingAppointmentsForReminder(hoursAhead);
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const a of appointments) {
    const salonSettings = a.salons?.settings ?? null;
    const salonHours = getReminderHoursForSalon(salonSettings);
    const start = new Date(a.start_time);

    if (!shouldSendNow(start, salonHours, now)) continue;

    const email = a.guest_email ?? a.clients?.email ?? null;
    const phone = a.guest_phone ?? a.clients?.phone ?? null;
    const salonName = a.salons?.name ?? "Salon";
    const dateStr = start.toLocaleDateString("en-GB");
    const timeStr = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const message = `Reminder: your appointment at ${salonName} is on ${dateStr} at ${timeStr}.`;

    let sent = false;
    let lastError: string | undefined;

    if (phone && (canSendWhatsApp() || canSendSms())) {
      if (canSendWhatsApp()) {
        const { error } = await sendWhatsApp(phone, message);
        if (!error) {
          sent = true;
        } else {
          lastError = error;
        }
      }
      if (!sent && canSendSms()) {
        const { error } = await sendSms(phone, message);
        if (!error) sent = true;
        else lastError = error;
      }
    }
    if (!sent && email) {
      const { error } = await sendAppointmentReminder(email, {
        clientName: a.guest_name ?? undefined,
        date: dateStr,
        time: timeStr,
        salonName,
      });
      if (!error) sent = true;
      else lastError = error;
    }

    if (!sent) {
      results.push({ id: a.id, ok: false, error: lastError ?? "No email or phone / channels not configured" });
    } else {
      await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", a.id);
      results.push({ id: a.id, ok: true });
    }
  }
  return results;
}
