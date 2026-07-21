import type { AiBookingService, AiBookingStylist } from "./booking-types";
import { serviceDurationForStylist } from "./booking-resolvers";
import { isSlotAvailable } from "./slot-finder";
import { salonDateIsoFromInstant, salonLocalToUtc } from "./salon-time";
import { createAdminClient } from "@/lib/supabase/admin";

const ANY_STYLIST_RE =
  /^(any|anyone|anybody|whoever|whomever|either|random|auto|available|next|next free|next available|any stylist|any available|doesn'?t matter|does not matter|dont care|don'?t care|no preference|no one|none|walk[- ]?in|first available|whoever is free|doesnt matter who|doesn't matter who)$/i;

/** True when staff omitted a stylist or said anyone / walk-in / doesn't matter. */
export function meansAnyStylist(stylistName?: string | null): boolean {
  const t = stylistName?.trim() ?? "";
  if (!t) return true;
  if (ANY_STYLIST_RE.test(t)) return true;
  return /\b(doesn'?t matter|no preference|anyone|any stylist|whoever|walk[- ]?in)\b/i.test(t);
}

export type AssignedStylist = {
  stylist: AiBookingStylist;
  durationMinutes: number;
  /** How the stylist was chosen when none was named. */
  assignment: "named" | "next_free" | "random_all_free";
  freeStylistNames: string[];
};

async function appointmentCountsForDay(
  salonId: string,
  stylistIds: string[],
  dateIso: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const id of stylistIds) counts[id] = 0;
  if (stylistIds.length === 0) return counts;

  const dayStart = salonLocalToUtc(dateIso, 0, 0);
  const dayEnd = salonLocalToUtc(dateIso, 23, 59);
  dayEnd.setSeconds(59, 999);

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("appointments")
    .select("stylist_id")
    .eq("salon_id", salonId)
    .in("stylist_id", stylistIds)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString());

  for (const row of data ?? []) {
    const id = row.stylist_id as string | null;
    if (id && id in counts) counts[id] += 1;
  }
  return counts;
}

/**
 * Pick a stylist free at the given start time.
 * - If all diary stylists are free → random among them.
 * - Otherwise → "next free" = least booked that day among those free (fair walk-in rotation).
 */
export async function assignFreeStylist(input: {
  salonId: string;
  stylists: AiBookingStylist[];
  service: AiBookingService;
  stylistOverrides: Record<string, Record<string, number>>;
  startTime: Date;
}): Promise<{ ok: true; result: AssignedStylist } | { ok: false; error: string; suggestions: string[] }> {
  if (input.stylists.length === 0) {
    return { ok: false, error: "No stylists are set to show on the diary.", suggestions: [] };
  }

  const free: Array<{ stylist: AiBookingStylist; durationMinutes: number }> = [];

  for (const stylist of input.stylists) {
    const durationMinutes = serviceDurationForStylist(
      input.service,
      stylist.id,
      input.stylistOverrides
    );
    const available = await isSlotAvailable({
      salonId: input.salonId,
      stylistId: stylist.id,
      startTime: input.startTime,
      durationMinutes,
    });
    if (available) free.push({ stylist, durationMinutes });
  }

  const freeNames = free.map((f) => f.stylist.name);
  if (free.length === 0) {
    return {
      ok: false,
      error: `No stylist is free at that time for ${input.service.name}. Try another time or name a stylist.`,
      suggestions: input.stylists.map((s) => s.name),
    };
  }

  if (free.length === input.stylists.length) {
    const pick = free[Math.floor(Math.random() * free.length)]!;
    return {
      ok: true,
      result: {
        stylist: pick.stylist,
        durationMinutes: pick.durationMinutes,
        assignment: "random_all_free",
        freeStylistNames: freeNames,
      },
    };
  }

  const dateIso = salonDateIsoFromInstant(input.startTime);
  const counts = await appointmentCountsForDay(
    input.salonId,
    free.map((f) => f.stylist.id),
    dateIso
  );

  free.sort((a, b) => {
    const diff = (counts[a.stylist.id] ?? 0) - (counts[b.stylist.id] ?? 0);
    if (diff !== 0) return diff;
    return a.stylist.name.localeCompare(b.stylist.name);
  });

  const pick = free[0]!;
  return {
    ok: true,
    result: {
      stylist: pick.stylist,
      durationMinutes: pick.durationMinutes,
      assignment: "next_free",
      freeStylistNames: freeNames,
    },
  };
}
