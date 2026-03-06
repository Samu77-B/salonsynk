import { createClient } from "@supabase/supabase-js";
import { sendAppointmentReminder } from "./email";
import { canSendSms, canSendWhatsApp, sendSms, sendWhatsApp } from "./sms";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type AppointmentRow = {
  id: string;
  start_time: string;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  clients: { email?: string; phone?: string } | null;
  salons: { name?: string } | null;
};

/**
 * Get appointments starting within the next hoursAhead (e.g. 24 for tomorrow).
 */
export async function getUpcomingAppointmentsForReminder(hoursAhead: number) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const from = new Date();
  const to = new Date(from.getTime() + hoursAhead * 60 * 60 * 1000);
  const { data } = await supabase
    .from("appointments")
    .select("id, start_time, guest_email, guest_name, guest_phone, clients(email, phone), salons(name)")
    .eq("status", "scheduled")
    .gte("start_time", from.toISOString())
    .lte("start_time", to.toISOString());
  return (data ?? []) as unknown as AppointmentRow[];
}

export async function sendReminders(hoursAhead = 24) {
  const appointments = await getUpcomingAppointmentsForReminder(hoursAhead);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const a of appointments) {
    const email = a.guest_email ?? a.clients?.email ?? null;
    const phone = a.guest_phone ?? a.clients?.phone ?? null;
    const start = new Date(a.start_time);
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
      results.push({ id: a.id, ok: true });
    }
  }
  return results;
}
