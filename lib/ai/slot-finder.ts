import { createClient } from "@/lib/supabase/server";
import type { SlotCandidate, TimePreference } from "./booking-types";

const BUFFER_MINS = 10;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 19;
const STEP_MINS = 15;

function intervalOverlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function minutesSinceDayStart(date: Date, day: Date): number {
  const d = new Date(date);
  const base = new Date(day);
  base.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - base.getTime()) / 60_000);
}

function fmtDayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function fmtTimeLabel(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function timePreferenceWindow(pref: TimePreference): { startHour: number; endHour: number } {
  switch (pref) {
    case "morning":
      return { startHour: 6, endHour: 12 };
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

export async function findAvailableSlots(input: {
  salonId: string;
  stylistId: string;
  durationMinutes: number;
  fromDate: Date;
  daysToScan?: number;
  timePreference?: TimePreference;
  maxResults?: number;
  excludeAppointmentId?: string;
}): Promise<SlotCandidate[]> {
  const daysToScan = input.daysToScan ?? 7;
  const timePreference = input.timePreference ?? "any";
  const maxResults = input.maxResults ?? 8;
  const durationMinutes = Math.max(1, input.durationMinutes);

  const rangeFrom = new Date(input.fromDate);
  rangeFrom.setHours(0, 0, 0, 0);
  const rangeTo = new Date(rangeFrom);
  rangeTo.setDate(rangeTo.getDate() + daysToScan);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status, stylist_id")
    .eq("salon_id", input.salonId)
    .eq("stylist_id", input.stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", rangeFrom.toISOString())
    .lt("start_time", rangeTo.toISOString())
    .order("start_time", { ascending: true });

  if (error) return [];

  const busy = (data ?? [])
    .filter((a) => a.id !== input.excludeAppointmentId)
    .map((a) => {
      const s = new Date(a.start_time);
      const e = new Date(a.end_time);
      if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return null;
      return { start: s, end: e };
    })
    .filter((v): v is { start: Date; end: Date } => v !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const candidates: SlotCandidate[] = [];

  for (let dayOffset = 0; dayOffset < daysToScan; dayOffset++) {
    const day = new Date(rangeFrom);
    day.setDate(day.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    const dayStart = new Date(day);
    dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(DAY_END_HOUR + 1, 0, 0, 0);

    const busyToday = busy
      .filter((b) => b.start >= day && b.start < new Date(day.getTime() + 24 * 60 * 60 * 1000))
      .map((b) => ({
        startM: minutesSinceDayStart(b.start, day),
        endM: minutesSinceDayStart(b.end, day),
      }))
      .sort((a, b) => a.startM - b.startM);

    const blocked = busyToday.map((b) => ({
      startM: Math.max(0, b.startM - BUFFER_MINS),
      endM: Math.min(24 * 60, b.endM + BUFFER_MINS),
    }));

    for (
      let startMins = DAY_START_HOUR * 60;
      startMins + durationMinutes <= (DAY_END_HOUR + 1) * 60;
      startMins += STEP_MINS
    ) {
      if (!slotMatchesPreference(startMins, timePreference)) continue;

      const endMins = startMins + durationMinutes;
      const slotStartBlocked = startMins - BUFFER_MINS;
      const slotEndBlocked = endMins + BUFFER_MINS;

      if (blocked.some((b) => intervalOverlaps(slotStartBlocked, slotEndBlocked, b.startM, b.endM))) continue;

      const slotStart = new Date(dayStart);
      slotStart.setHours(0, 0, 0, 0);
      slotStart.setMinutes(startMins);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

      if (slotStart < dayStart || slotEnd > dayEnd) continue;

      candidates.push({
        startIso: slotStart.toISOString(),
        endIso: slotEnd.toISOString(),
        dayLabel: fmtDayLabel(slotStart),
        timeLabel: fmtTimeLabel(slotStart),
      });

      if (candidates.length >= maxResults) return candidates;
    }
  }

  return candidates;
}

export function parseDateIso(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}
