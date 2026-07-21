import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalonMembersAdaptiveSelect, memberShowsOnDiary } from "@/lib/show-on-diary";
import type { SalonBookingCatalog } from "./booking-types";

export type PublicSalonContext = SalonBookingCatalog & {
  slug: string;
  policyNotes: string;
};

/** Short in-memory TTL so public SynkAI turns skip reloading the catalogue. */
const PUBLIC_CATALOG_TTL_MS = 45_000;
const publicCatalogCache = new Map<string, { expiresAt: number; catalog: PublicSalonContext }>();

function openingHoursFromSettings(settings: Record<string, unknown>): string {
  const custom = settings.opening_hours;
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  if (typeof settings.opening_hours_note === "string" && settings.opening_hours_note.trim()) {
    return settings.opening_hours_note.trim();
  }
  return "Please contact the salon directly for opening hours. Online booking is typically available between 9:00 and 18:00.";
}

export async function loadPublicSalonBySlug(slug: string): Promise<PublicSalonContext | null> {
  const key = slug.trim().toLowerCase();
  const cached = publicCatalogCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.catalog;
  }

  const catalog = await fetchPublicSalonBySlug(key);
  if (catalog) {
    publicCatalogCache.set(key, { expiresAt: Date.now() + PUBLIC_CATALOG_TTL_MS, catalog });
  }
  return catalog;
}

async function fetchPublicSalonBySlug(slug: string): Promise<PublicSalonContext | null> {
  const supabase = createAdminClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, slug, settings")
    .eq("slug", slug)
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

  const [servicesRes, membersLoad, overridesRes, productsRes, categoriesRes] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_minor, description, category_id")
      .eq("salon_id", salonId)
      .order("sort_order")
      .order("name"),
    fetchSalonMembersAdaptiveSelect(supabase, salonId, [
      "id, display_name, role, show_on_diary",
      "id, display_name, role",
    ]),
    supabase
      .from("stylist_service_overrides")
      .select("stylist_id, service_id, custom_duration_minutes")
      .eq("salon_id", salonId),
    supabase
      .from("products")
      .select("id, name, description, category, price_minor")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase.from("service_categories").select("id, name").eq("salon_id", salonId),
  ]);

  const categoryNames = new Map<string, string>();
  for (const c of categoriesRes.data ?? []) {
    const row = c as { id: string; name: string };
    categoryNames.set(row.id, row.name);
  }

  const services = (servicesRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      name: string;
      duration_minutes: number;
      price_minor?: number | null;
      description?: string | null;
      category_id?: string | null;
    };
    return {
      id: r.id,
      name: r.name,
      durationMinutes: Number(r.duration_minutes) || 30,
      priceMinor: r.price_minor != null ? Number(r.price_minor) : null,
      description: r.description?.trim() || null,
      categoryName: r.category_id ? categoryNames.get(r.category_id) ?? null : null,
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

  const products = (productsRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      name: string;
      price_minor: number;
      description?: string | null;
      category?: string | null;
    };
    return {
      id: r.id,
      name: r.name,
      priceMinor: Number(r.price_minor) || 0,
      description: r.description?.trim() || null,
      category: r.category?.trim() || null,
    };
  });

  const aftercareMessage =
    typeof settings.aftercare_message === "string" && settings.aftercare_message.trim()
      ? settings.aftercare_message.trim()
      : null;

  return {
    salonId,
    salonName: salon.name as string,
    slug: salon.slug as string,
    services,
    stylists,
    clients: [],
    stylistOverrides,
    products,
    teamMembers: [],
    openingHoursNote: openingHoursFromSettings(settings),
    aftercareMessage,
    policyNotes: policyParts.join(" ") || "Standard salon cancellation policies apply. Contact the salon for no-show rules.",
  };
}
