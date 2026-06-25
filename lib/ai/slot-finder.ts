import { createAdminClient } from "@/lib/supabase/admin";
import type { SlotCandidate, TimePreference } from "./booking-types";
import {
  formatSalonDayLabel,
  formatSalonTimeLabel,
  parseSalonDateIso,
  parseSalonLocalTime,
  salonDateIsoFromInstant,
  salonLocalMinutesFromMidnight,
  salonLocalToUtc,
} from "./salon-time";

const BUFFER_MINS = 10;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 19;
const STEP_MINS = 15;

function intervalOverlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function timePreferenceWindow(pref: TimePreference): { startHour: number; endHour: number } {
  switch (pref) {
    case "morning":
      return { startHour: 9, endHour: 12 };
    case "afternoon":
      return { startHour: 12, endHour: 17 };
    case "evening":
      return { startHour: 17, endHour: 20 };
    default:
      return { startHour: DAY_START_HOUR, endHour: DAY_END_HOUR + 1 };
  }
}

function slotMatchesPreference(startMins: number, pref: TimePreference): boolean {
  const hour = Math.floor(startMins / 60);
  const { startHour, endHour } = timePreferenceWindow(pref);
  return hour >= startHour && hour < endHour;
}

type BusyBlock = { startM: number; endM: number };

async function loadBusyBlocks(input: {
  salonId: string;
  stylistId: string;
  dateIso: string;
  excludeAppointmentId?: string;
}): Promise<BusyBlock[]> {
  const dayStart = salonLocalToUtc(input.dateIso, 0, 0);
  const dayEnd = salonLocalToUtc(input.dateIso, 23, 59);
  dayEnd.setSeconds(59, 999);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status")
    .eq("salon_id", input.salonId)
    .eq("stylist_id", input.stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString())
    .order("start_time", { ascending: true });

  if (error) return [];

  return (data ?? [])
    .filter((a) => a.id !== input.excludeAppointmentId)
    .map((a) => {
      const s = new Date(a.start_time as string);
      const e = new Date(a.end_time as string);
      if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return null;
      if (salonDateIsoFromInstant(s) !== input.dateIso) return null;
      return {
        startM: salonLocalMinutesFromMidnight(s),
        endM: salonLocalMinutesFromMidnight(e),
      };
    })
    .filter((v): v is BusyBlock => v !== null)
    .map((b) => ({
      startM: Math.max(0, b.startM - BUFFER_MINS),
      endM: Math.min(24 * 60, b.endM + BUFFER_MINS),
    }));
}

function slotFreeAtMinutes(
  startMins: number,
  durationMinutes: number,
  blocked: BusyBlock[]
): boolean {
  const endMins = startMins + durationMinutes;
  const slotStartBlocked = startMins - BUFFER_MINS;
  const slotEndBlocked = endMins + BUFFER_MINS;
  if (startMins < DAY_START_HOUR * 60) return false;
  if (endMins > (DAY_END_HOUR + 1) * 60) return false;
  return !blocked.some((b) => intervalOverlaps(slotStartBlocked, slotEndBlocked, b.startM, b.endM));
}

function slotCandidate(dateIso: string, startMins: number, durationMinutes: number): SlotCandidate {
  const hour = Math.floor(startMins / 60);
  const minute = startMins % 60;
  const start = salonLocalToUtc(dateIso, hour, minute);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    dayLabel: formatSalonDayLabel(start),
    timeLabel: formatSalonTimeLabel(start),
  };
}

/** Check whether a specific start instant is free for the stylist. */
export async function isSlotAvailable(input: {
  salonId: string;
  stylistId: string;
  startTime: Date;
  durationMinutes: number;
  excludeAppointmentId?: string;
}): Promise<boolean> {
  const dateIso = salonDateIsoFromInstant(input.startTime);
  const startMins = salonLocalMinutesFromMidnight(input.startTime);
  const blocked = await loadBusyBlocks({
    salonId: input.salonId,
    stylistId: input.stylistId,
    dateIso,
    excludeAppointmentId: input.excludeAppointmentId,
  });
  return slotFreeAtMinutes(startMins, input.durationMinutes, blocked);
}

export async function findAvailableSlots(input: {
  salonId: string;
  stylistId: string;
  durationMinutes: number;
  fromDate: Date | string;
  daysToScan?: number;
  timePreference?: TimePreference;
  maxResults?: number;
  excludeAppointmentId?: string;
  /** When set, this slot is checked first and returned separately even if not in the first N results. */
  prioritizeLocalTime?: string;
  /** When set, on the first day scanned only start from this local minute (e.g. next slot after a busy time). */
  minStartMinutes?: number;
}): Promise<SlotCandidate[]> {
  const daysToScan = input.daysToScan ?? 7;
  const timePreference = input.timePreference ?? "any";
  const maxResults = input.maxResults ?? 20;
  const durationMinutes = Math.max(1, input.durationMinutes);

  const fromDateIso =
    typeof input.fromDate === "string"
      ? parseSalonDateIso(input.fromDate)
      : salonDateIsoFromInstant(input.fromDate);
  if (!fromDateIso) return [];

  const candidates: SlotCandidate[] = [];
  const seen = new Set<string>();

  const addCandidate = (c: SlotCandidate) => {
    if (seen.has(c.startIso)) return;
    seen.add(c.startIso);
    candidates.push(c);
  };

  if (input.prioritizeLocalTime) {
    const parsed = parseSalonLocalTime(input.prioritizeLocalTime);
    if (parsed) {
      const blocked = await loadBusyBlocks({
        salonId: input.salonId,
        stylistId: input.stylistId,
        dateIso: fromDateIso,
        excludeAppointmentId: input.excludeAppointmentId,
      });
      const startMins = parsed.hour * 60 + parsed.minute;
      if (slotFreeAtMinutes(startMins, durationMinutes, blocked)) {
        addCandidate(slotCandidate(fromDateIso, startMins, durationMinutes));
      }
    }
  }

  for (let dayOffset = 0; dayOffset < daysToScan; dayOffset++) {
    const baseInstant = salonLocalToUtc(fromDateIso, 12, 0);
    const dayInstant = new Date(baseInstant.getTime() + dayOffset * 86_400_000);
    const dateIso = salonDateIsoFromInstant(dayInstant);

    const blocked = await loadBusyBlocks({
      salonId: input.salonId,
      stylistId: input.stylistId,
      dateIso,
      excludeAppointmentId: input.excludeAppointmentId,
    });

    for (
      let startMins =
        dayOffset === 0 && input.minStartMinutes != null
          ? Math.max(input.minStartMinutes, DAY_START_HOUR * 60)
          : DAY_START_HOUR * 60;
      startMins + durationMinutes <= (DAY_END_HOUR + 1) * 60;
      startMins += STEP_MINS
    ) {
      if (!slotMatchesPreference(startMins, timePreference)) continue;
      if (!slotFreeAtMinutes(startMins, durationMinutes, blocked)) continue;
      addCandidate(slotCandidate(dateIso, startMins, durationMinutes));
      if (candidates.length >= maxResults) return candidates;
    }
  }

  return candidates;
}

/** @deprecated Use parseSalonDateIso from salon-time.ts */
export function parseDateIso(value: string): Date | null {
  const iso = parseSalonDateIso(value);
  if (!iso) return null;
  return salonLocalToUtc(iso, 12, 0);
}
