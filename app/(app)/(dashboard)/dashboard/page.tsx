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
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [membersRes, servicesRes, clientsRes, appointmentsRes] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, display_name, role")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("role", { ascending: false }),
    supabase
      .from("services")
      .select("id, name, duration_minutes")
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
        stylist_id, service_id,
        clients(name, email, phone),
        services(name, duration_minutes),
        salon_members(display_name)
      `)
      .eq("salon_id", context.salon.id)
      .gte("start_time", weekStart.toISOString())
      .lt("start_time", weekEnd.toISOString())
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
