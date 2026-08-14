import type { SupabaseClient } from "@supabase/supabase-js";

export const ANY_TECHNICIAN_BOOKING_VALUE = "__any__";

export type ResolvedBookingTechnician = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  showToClient: boolean;
};

type TechnicianRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

async function fetchBookableTechnicians(
  supabase: SupabaseClient,
  salonId: string
): Promise<TechnicianRow[]> {
  const { data: accepting } = await supabase
    .from("nail_members")
    .select("id, display_name, avatar_url")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .eq("is_accepting_walk_ins", true)
    .order("display_name");

  return (accepting ?? []).filter((t) => t.display_name?.trim()) as TechnicianRow[];
}

async function fetchFallbackTechnician(
  supabase: SupabaseClient,
  salonId: string
): Promise<TechnicianRow | null> {
  const { data } = await supabase
    .from("nail_members")
    .select("id, display_name, avatar_url")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .order("display_name")
    .limit(1)
    .maybeSingle();

  return data as TechnicianRow | null;
}

async function pickLeastBusyTechnician(
  supabase: SupabaseClient,
  salonId: string,
  startIso: string,
  endIso: string,
  candidates: TechnicianRow[]
): Promise<TechnicianRow> {
  if (candidates.length === 1) return candidates[0];

  const ids = candidates.map((t) => t.id);
  const { data: conflicts } = await supabase
    .from("nail_appointments")
    .select("technician_id")
    .eq("salon_id", salonId)
    .in("technician_id", ids)
    .in("status", ["scheduled"])
    .lt("start_time", endIso)
    .gt("end_time", startIso);

  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, 0);
  for (const row of conflicts ?? []) {
    const id = row.technician_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return [...candidates].sort(
    (a, b) =>
      (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) ||
      (a.display_name ?? "").localeCompare(b.display_name ?? "")
  )[0];
}

export async function resolvePublicBookingTechnician(
  supabase: SupabaseClient,
  salonId: string,
  technicianIdRaw: string,
  startIso: string,
  endIso: string
): Promise<{ technician?: ResolvedBookingTechnician; error?: string }> {
  const bookable = await fetchBookableTechnicians(supabase, salonId);
  const wantsAny = !technicianIdRaw || technicianIdRaw === ANY_TECHNICIAN_BOOKING_VALUE;

  if (wantsAny && bookable.length > 0) {
    const picked = await pickLeastBusyTechnician(supabase, salonId, startIso, endIso, bookable);
    return {
      technician: {
        id: picked.id,
        display_name: picked.display_name,
        avatar_url: picked.avatar_url,
        showToClient: true,
      },
    };
  }

  if (!wantsAny) {
    const chosen = bookable.find((t) => t.id === technicianIdRaw);
    if (!chosen) {
      return { error: "That technician is not available." };
    }
    return {
      technician: {
        id: chosen.id,
        display_name: chosen.display_name,
        avatar_url: chosen.avatar_url,
        showToClient: true,
      },
    };
  }

  const fallback = await fetchFallbackTechnician(supabase, salonId);
  if (!fallback) {
    return { error: "This salon is not set up for bookings yet. Please contact them directly." };
  }

  return {
    technician: {
      id: fallback.id,
      display_name: fallback.display_name,
      avatar_url: fallback.avatar_url,
      showToClient: false,
    },
  };
}
