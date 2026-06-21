import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalonMembersAdaptiveSelect, memberShowsOnDiary } from "@/lib/show-on-diary";
import type { SalonBookingCatalog } from "./booking-types";

export type PublicSalonContext = SalonBookingCatalog & {
  slug: string;
  policyNotes: string;
};

export async function loadPublicSalonBySlug(slug: string): Promise<PublicSalonContext | null> {
  const supabase = createAdminClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, slug, settings")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();

  if (!salon) return null;

  const salonId = salon.id as string;
  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const policyParts: string[] = [];
  if (settings.deposit_required) {
    const type = settings.deposit_type === "flat" ? "flat fee" : "percentage";
    policyParts.push(`Deposits may be required (${type}).`);
  }
  if (typeof settings.aftercare_message === "string" && settings.aftercare_message.trim()) {
    policyParts.push(`Aftercare: ${settings.aftercare_message.trim().slice(0, 200)}`);
  }
  const branding = (settings.branding as Record<string, string> | undefined) ?? {};
  if (branding.booking_heading?.trim()) {
    policyParts.push(`Booking welcome: ${branding.booking_heading.trim()}`);
  }

  const servicesRes = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_minor, description")
    .eq("salon_id", salonId)
    .order("sort_order")
    .order("name");

  const membersLoad = await fetchSalonMembersAdaptiveSelect(supabase, salonId, [
    "id, display_name, role, show_on_diary",
    "id, display_name, role",
  ]);

  const overridesRes = await supabase
    .from("stylist_service_overrides")
    .select("stylist_id, service_id, custom_duration_minutes")
    .eq("salon_id", salonId);

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

  const stylistOverrides: Record<string, Record<string, number>> = {};
  for (const row of overridesRes.data ?? []) {
    const r = row as { stylist_id: string; service_id: string; custom_duration_minutes: number };
    if (!stylistOverrides[r.stylist_id]) stylistOverrides[r.stylist_id] = {};
    stylistOverrides[r.stylist_id][r.service_id] = Number(r.custom_duration_minutes) || 0;
  }

  return {
    salonId,
    salonName: salon.name as string,
    slug: salon.slug as string,
    services,
    stylists,
    clients: [],
    stylistOverrides,
    policyNotes: policyParts.join(" ") || "Standard salon cancellation policies apply. Contact the salon for no-show rules.",
  };
}
