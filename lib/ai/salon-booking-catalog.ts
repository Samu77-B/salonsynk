import { createClient } from "@/lib/supabase/server";
import { fetchSalonMembersAdaptiveSelect, memberShowsOnDiary } from "@/lib/show-on-diary";
import type { SalonBookingCatalog } from "./booking-types";

export async function loadSalonBookingCatalog(salonId: string, salonName: string): Promise<SalonBookingCatalog> {
  const supabase = await createClient();

  const servicesPromise = (async () => {
    const withPrice = await supabase
      .from("services")
      .select("id, name, duration_minutes, price_minor")
      .eq("salon_id", salonId)
      .order("sort_order")
      .order("name");
    if (!withPrice.error) return withPrice;
    return supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("salon_id", salonId)
      .order("name");
  })();

  const [servicesRes, clientsRes, membersLoad, overridesRes] = await Promise.all([
    servicesPromise,
    supabase
      .from("clients")
      .select("id, name, email, phone")
      .eq("salon_id", salonId)
      .order("name")
      .limit(200),
    fetchSalonMembersAdaptiveSelect(supabase, salonId, [
      "id, display_name, role, show_on_diary",
      "id, display_name, role",
    ]),
    supabase
      .from("stylist_service_overrides")
      .select("stylist_id, service_id, custom_duration_minutes")
      .eq("salon_id", salonId),
  ]);

  const services = (servicesRes.data ?? []).map((row) => {
    const r = row as { id: string; name: string; duration_minutes: number; price_minor?: number | null };
    return {
      id: r.id,
      name: r.name,
      durationMinutes: Number(r.duration_minutes) || 30,
      priceMinor: r.price_minor != null ? Number(r.price_minor) : null,
    };
  });

  const stylists = ((membersLoad.data ?? []) as { id: string; display_name: string | null; role: string; show_on_diary?: boolean | null }[])
    .filter((m) => memberShowsOnDiary(m))
    .map((m) => ({
      id: m.id,
      name: m.display_name?.trim() || m.role,
    }));

  const clients = (clientsRes.data ?? []).map((row) => {
    const r = row as { id: string; name: string | null; email: string | null; phone: string | null };
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
    };
  });

  const stylistOverrides: Record<string, Record<string, number>> = {};
  for (const row of overridesRes.data ?? []) {
    const r = row as { stylist_id: string; service_id: string; custom_duration_minutes: number };
    if (!stylistOverrides[r.stylist_id]) stylistOverrides[r.stylist_id] = {};
    stylistOverrides[r.stylist_id][r.service_id] = Number(r.custom_duration_minutes) || 0;
  }

  return {
    salonId,
    salonName,
    services,
    stylists,
    clients,
    stylistOverrides,
  };
}
