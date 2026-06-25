import { createClient } from "@/lib/supabase/server";
import { fetchSalonMembersAdaptiveSelect, memberShowsOnDiary } from "@/lib/show-on-diary";
import type { SalonBookingCatalog } from "./booking-types";

function openingHoursFromSettings(settings: Record<string, unknown>): string {
  const custom = settings.opening_hours;
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  if (typeof settings.opening_hours_note === "string" && settings.opening_hours_note.trim()) {
    return settings.opening_hours_note.trim();
  }
  return "Contact the salon for exact opening hours. Online booking slots are typically available between 9:00 and 18:00.";
}

export async function loadSalonBookingCatalog(salonId: string, salonName: string): Promise<SalonBookingCatalog> {
  const supabase = await createClient();

  const servicesPromise = (async () => {
    const full = await supabase
      .from("services")
      .select("id, name, duration_minutes, price_minor, description, category_id")
      .eq("salon_id", salonId)
      .order("sort_order")
      .order("name");
    if (!full.error) return full;
    const withPrice = await supabase
      .from("services")
      .select("id, name, duration_minutes, price_minor, description")
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

  const productsPromise = (async () => {
    const res = await supabase
      .from("products")
      .select("id, name, description, category, price_minor")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    if (!res.error) return res;
    return { data: [], error: null };
  })();

  const [servicesRes, clientsRes, membersLoad, overridesRes, productsRes, salonRes, categoriesRes] =
    await Promise.all([
      servicesPromise,
      supabase
        .from("clients")
        .select("id, name, email, phone")
        .eq("salon_id", salonId)
        .order("name")
        .limit(200),
      fetchSalonMembersAdaptiveSelect(supabase, salonId, [
        "id, display_name, role, show_on_diary, is_active",
        "id, display_name, role, show_on_diary",
        "id, display_name, role",
      ]),
      supabase
        .from("stylist_service_overrides")
        .select("stylist_id, service_id, custom_duration_minutes")
        .eq("salon_id", salonId),
      productsPromise,
      supabase.from("salons").select("settings").eq("id", salonId).maybeSingle(),
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
    const categoryName = r.category_id ? categoryNames.get(r.category_id) ?? null : null;
    return {
      id: r.id,
      name: r.name,
      durationMinutes: Number(r.duration_minutes) || 30,
      priceMinor: r.price_minor != null ? Number(r.price_minor) : null,
      description: r.description?.trim() || null,
      categoryName,
    };
  });

  const allMembers = (membersLoad.data ?? []) as {
    id: string;
    display_name: string | null;
    role: string;
    show_on_diary?: boolean | null;
    is_active?: boolean | null;
  }[];

  const activeMembers = allMembers.filter((m) => m.is_active !== false);

  const stylists = activeMembers
    .filter((m) => memberShowsOnDiary(m))
    .map((m) => ({
      id: m.id,
      name: m.display_name?.trim() || m.role,
    }));

  const teamMembers = activeMembers.map((m) => ({
    id: m.id,
    name: m.display_name?.trim() || m.role,
    role: m.role,
    showsOnDiary: memberShowsOnDiary(m),
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

  const settings = (salonRes.data?.settings as Record<string, unknown> | undefined) ?? {};
  const aftercareMessage =
    typeof settings.aftercare_message === "string" && settings.aftercare_message.trim()
      ? settings.aftercare_message.trim()
      : null;

  return {
    salonId,
    salonName,
    services,
    stylists,
    clients,
    stylistOverrides,
    products,
    teamMembers,
    openingHoursNote: openingHoursFromSettings(settings),
    aftercareMessage,
  };
}
