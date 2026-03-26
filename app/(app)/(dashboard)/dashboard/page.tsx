import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { redirect } from "next/navigation";
import { isMissingProcessingColumnError } from "@/lib/db/service-schema";
import { DiaryView } from "./diary-view";
import { GapFillerSection } from "./gap-filler-section";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const userSb = await createClient();
  const isSuperAdmin = await getIsSuperAdmin();
  /** Super admins may have no salon_members row; RLS would hide salon data. Scope all queries to context.salon.id. */
  const supabase = isSuperAdmin
    ? (() => {
        try {
          return createAdminClient();
        } catch {
          return userSb;
        }
      })()
    : userSb;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Load a wide window so Prev/Next week in the diary still shows appointments (not only "this" week).
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 21);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + 77);
  rangeEnd.setHours(0, 0, 0, 0);

  const servicesPromise = (async () => {
    const withProcessing = await supabase
      .from("services")
      .select("id, name, duration_minutes, processing_time_minutes")
      .eq("salon_id", context.salon.id)
      .order("name");
    if (!withProcessing.error) return withProcessing;
    if (!isMissingProcessingColumnError(withProcessing.error)) return withProcessing;
    return supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("salon_id", context.salon.id)
      .order("name");
  })();

  const [membersRes, servicesRes, clientsRes, appointmentsRes] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, display_name, role, calendar_color")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("role", { ascending: false }),
    servicesPromise,
    supabase
      .from("clients")
      .select("id, name, email, phone")
      .eq("salon_id", context.salon.id)
      .order("name"),
    (async () => {
      const fullSelect = `
        id, start_time, end_time, status, notes,
        client_id, guest_name, guest_email, guest_phone,
        stylist_id, service_id, send_reminder_sms, send_review_request, send_aftercare,
        deposit_payment_intent_id, before_photo_url, after_photo_url,
        clients(name, email, phone),
        services(name, duration_minutes, processing_time_minutes),
        salon_members(display_name)
      `;
      const minimalSelect = `
        id, start_time, end_time, status, notes,
        client_id, guest_name, guest_email, guest_phone,
        stylist_id, service_id,
        clients(name, email, phone),
        services(name, duration_minutes),
        salon_members(display_name)
      `;
      const query = (sel: string) =>
        supabase
          .from("appointments")
          .select(sel)
          .eq("salon_id", context.salon.id)
          .gte("start_time", rangeStart.toISOString())
          .lt("start_time", rangeEnd.toISOString())
          .order("start_time");

      const full = await query(fullSelect);
      if (!full.error) return full;
      return query(minimalSelect);
    })(),
  ]);

  const members = membersRes.data ?? [];
  const services = (servicesRes.data ?? []).map((s) => {
    const row = s as {
      id: string;
      name: string;
      duration_minutes: number;
      processing_time_minutes?: number | null;
    };
    return {
      id: row.id,
      name: row.name,
      duration_minutes: row.duration_minutes,
      processing_time_minutes: row.processing_time_minutes ?? 0,
    };
  });
  const clients = clientsRes.data ?? [];

  const clientPhotoMap: Record<string, string> = {};
  try {
    const clientIds = clients.map((c: { id: string }) => c.id);
    if (clientIds.length > 0) {
      const { data: clientProfilePhotos } = await supabase
        .from("client_photos")
        .select("client_id, url")
        .in("client_id", clientIds)
        .eq("slot", "profile");
      for (const p of clientProfilePhotos ?? []) {
        clientPhotoMap[(p as { client_id: string; url: string }).client_id] =
          (p as { client_id: string; url: string }).url;
      }
    }
  } catch {
    // client_photos table may not exist yet — gracefully degrade
  }

  const appointments = (appointmentsRes.data ?? []) as unknown as {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    notes: string | null;
    client_id: string | null;
    guest_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
    stylist_id: string;
    service_id: string | null;
    deposit_payment_intent_id?: string | null;
    before_photo_url?: string | null;
    after_photo_url?: string | null;
    send_reminder_sms?: boolean;
    send_review_request?: boolean;
    send_aftercare?: boolean;
    clients: { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null;
    services: { name: string; duration_minutes: number; processing_time_minutes?: number } | { name: string; duration_minutes: number; processing_time_minutes?: number }[] | null;
    salon_members: { display_name: string | null } | { display_name: string | null }[] | null;
  }[];

  return (
    <main className="p-4 md:p-6 min-w-0 space-y-6">
      <DiaryView
        salonId={context.salon.id}
        salonName={context.salon.name}
        members={members}
        services={services}
        clients={clients}
        appointments={appointments}
        clientPhotoMap={clientPhotoMap}
      />
      <GapFillerSection />
    </main>
  );
}
