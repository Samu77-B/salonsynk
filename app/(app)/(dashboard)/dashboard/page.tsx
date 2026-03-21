import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DiaryView } from "./diary-view";
import { GapFillerSection } from "./gap-filler-section";

export default async function DashboardPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Load a wide window so Prev/Next week in the diary still shows appointments (not only "this" week).
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 21);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + 77);
  rangeEnd.setHours(0, 0, 0, 0);

  const [membersRes, servicesRes, clientsRes, appointmentsRes] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, display_name, role, calendar_color")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("role", { ascending: false }),
    supabase
      .from("services")
      .select("id, name, duration_minutes, processing_time_minutes")
      .eq("salon_id", context.salon.id),
    supabase
      .from("clients")
      .select("id, name, email, phone")
      .eq("salon_id", context.salon.id)
      .order("name"),
    supabase
      .from("appointments")
      .select(`
        id, start_time, end_time, status, notes,
        client_id, guest_name, guest_email, guest_phone,
        stylist_id, service_id, send_reminder_sms, send_review_request, send_aftercare,
        deposit_payment_intent_id, before_photo_url, after_photo_url,
        clients(name, email, phone),
        services(name, duration_minutes, processing_time_minutes),
        salon_members(display_name)
      `)
      .eq("salon_id", context.salon.id)
      .gte("start_time", rangeStart.toISOString())
      .lt("start_time", rangeEnd.toISOString())
      .order("start_time"),
  ]);

  const members = membersRes.data ?? [];
  const services = servicesRes.data ?? [];
  const clients = clientsRes.data ?? [];
  const appointments = appointmentsRes.data ?? [];

  return (
    <main className="p-4 md:p-6 min-w-0 space-y-6">
      <DiaryView
        salonId={context.salon.id}
        salonName={context.salon.name}
        members={members}
        services={services}
        clients={clients}
        appointments={appointments}
      />
      <GapFillerSection />
    </main>
  );
}
