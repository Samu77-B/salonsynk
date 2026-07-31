import type { SupabaseClient } from "@supabase/supabase-js";

export const ANY_BARBER_BOOKING_VALUE = "__any__";

export type ResolvedBookingBarber = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  /** When false, the client should only see shop + date/time (no barber on confirmation). */
  showToClient: boolean;
};

type BarberRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

async function fetchBookableBarbers(
  supabase: SupabaseClient,
  shopId: string
): Promise<BarberRow[]> {
  const { data } = await supabase
    .from("barber_members")
    .select("id, display_name, avatar_url")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .eq("is_accepting_walk_ins", true)
    .order("display_name");

  return (data ?? []).filter((b) => b.display_name?.trim()) as BarberRow[];
}

async function fetchFallbackBarber(
  supabase: SupabaseClient,
  shopId: string
): Promise<BarberRow | null> {
  const { data } = await supabase
    .from("barber_members")
    .select("id, display_name, avatar_url")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("display_name")
    .limit(1)
    .maybeSingle();

  return data as BarberRow | null;
}

async function pickLeastBusyBarber(
  supabase: SupabaseClient,
  shopId: string,
  startIso: string,
  endIso: string,
  candidates: BarberRow[]
): Promise<BarberRow> {
  if (candidates.length === 1) return candidates[0];

  const ids = candidates.map((b) => b.id);
  const { data: conflicts } = await supabase
    .from("barber_appointments")
    .select("barber_id")
    .eq("shop_id", shopId)
    .in("barber_id", ids)
    .in("status", ["scheduled", "in_chair"])
    .lt("start_time", endIso)
    .gt("end_time", startIso);

  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, 0);
  for (const row of conflicts ?? []) {
    const id = row.barber_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return [...candidates].sort(
    (a, b) =>
      (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) ||
      (a.display_name ?? "").localeCompare(b.display_name ?? "")
  )[0];
}

export async function resolvePublicBookingBarber(
  supabase: SupabaseClient,
  shopId: string,
  barberIdRaw: string,
  startIso: string,
  endIso: string
): Promise<{ barber?: ResolvedBookingBarber; error?: string }> {
  const bookable = await fetchBookableBarbers(supabase, shopId);
  const wantsAny =
    !barberIdRaw ||
    barberIdRaw === ANY_BARBER_BOOKING_VALUE;

  if (wantsAny && bookable.length > 0) {
    const picked = await pickLeastBusyBarber(supabase, shopId, startIso, endIso, bookable);
    return {
      barber: {
        id: picked.id,
        display_name: picked.display_name,
        avatar_url: picked.avatar_url,
        showToClient: true,
      },
    };
  }

  if (!wantsAny) {
    const chosen = bookable.find((b) => b.id === barberIdRaw);
    if (!chosen) {
      return { error: "That barber is not available." };
    }
    return {
      barber: {
        id: chosen.id,
        display_name: chosen.display_name,
        avatar_url: chosen.avatar_url,
        showToClient: true,
      },
    };
  }

  const fallback = await fetchFallbackBarber(supabase, shopId);
  if (!fallback) {
    return { error: "This shop is not set up for bookings yet. Please contact them directly." };
  }

  return {
    barber: {
      id: fallback.id,
      display_name: fallback.display_name,
      avatar_url: fallback.avatar_url,
      showToClient: false,
    },
  };
}
