import { createClient } from "@supabase/supabase-js";
import { sendAppointmentReminder } from "./email";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Get appointments starting within the next hoursAhead (e.g. 24 for tomorrow).
 */
export async function getUpcomingAppointmentsForReminder(hoursAhead: number) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const from = new Date();
  const to = new Date(from.getTime() + hoursAhead * 60 * 60 * 1000);
  const { data } = await supabase
    .from("appointments")
    .select("id, start_time, guest_email, guest_name, clients(email), salons(name)")
    .eq("status", "scheduled")
    .gte("start_time", from.toISOString())
    .lte("start_time", to.toISOString());
  return data ?? [];
}

export async function sendReminders(hoursAhead = 24) {
  const appointments = await getUpcomingAppointmentsForReminder(hoursAhead);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const a of appointments as unknown as { id: string; start_time: string; guest_email: string | null; guest_name: string | null; clients: { email: string } | null; salons: { name: string } | null }[]) {
    const email = a.guest_email ?? (a.clients as { email?: string } | null)?.email ?? null;
    if (!email) {
      results.push({ id: a.id, ok: false, error: "No email" });
      continue;
    }
    const start = new Date(a.start_time);
    const salonName = (a.salons as { name?: string } | null)?.name ?? "Salon";
    const { error } = await sendAppointmentReminder(email, {
      clientName: a.guest_name ?? undefined,
      date: start.toLocaleDateString("en-GB"),
      time: start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      salonName,
    });
    results.push({ id: a.id, ok: !error, error: error ? String(error) : undefined });
  }
  return results;
}
