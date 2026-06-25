import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalonMembersAdaptiveSelect, memberShowsOnDiary } from "@/lib/show-on-diary";
import { formatDurationMinutes } from "@/lib/format-duration";

const DAY_START_HOUR = 9;
const DAY_END_HOUR = 18;
const MIN_GAP_MINUTES = 30;
const MAX_GAP_MINUTES = 60;

export type CalendarGap = {
  gapId: string;
  stylistId: string;
  stylistName: string;
  startIso: string;
  endIso: string;
  durationMinutes: number;
  dayLabel: string;
  timeLabel: string;
  source: "schedule_gap" | "cancellation";
  suggestedServiceNames: string[];
};

function minutesSinceDayStart(date: Date, day: Date): number {
  const base = new Date(day);
  base.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - base.getTime()) / 60_000);
}

function fmtDayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function fmtTimeLabel(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function servicesFittingGap(
  services: { name: string; duration_minutes: number }[],
  gapMinutes: number
): string[] {
  return services
    .filter((s) => s.duration_minutes >= MIN_GAP_MINUTES - 5 && s.duration_minutes <= gapMinutes + 10)
    .slice(0, 4)
    .map((s) => s.name);
}

export async function findCalendarGapsForSalon(
  salonId: string,
  options?: { daysToScan?: number; minGapMinutes?: number; maxGapMinutes?: number }
): Promise<CalendarGap[]> {
  const daysToScan = options?.daysToScan ?? 7;
  const minGap = options?.minGapMinutes ?? MIN_GAP_MINUTES;
  const maxGap = options?.maxGapMinutes ?? MAX_GAP_MINUTES;

  const supabase = createAdminClient();
  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + daysToScan);

  const [membersLoad, servicesRes, appointmentsRes, cancelledRes] = await Promise.all([
    fetchSalonMembersAdaptiveSelect(supabase, salonId, [
      "id, display_name, role, show_on_diary",
      "id, display_name, role",
    ]),
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("salon_id", salonId)
      .order("name"),
    supabase
      .from("appointments")
      .select("id, start_time, end_time, stylist_id, status")
      .eq("salon_id", salonId)
      .in("status", ["scheduled", "completed"])
      .gte("start_time", rangeStart.toISOString())
      .lt("start_time", rangeEnd.toISOString())
      .order("start_time"),
    supabase
      .from("appointments")
      .select("id, start_time, end_time, stylist_id, service_id")
      .eq("salon_id", salonId)
      .eq("status", "canceled")
      .gte("start_time", new Date().toISOString())
      .lt("start_time", rangeEnd.toISOString())
      .order("start_time")
      .limit(20),
  ]);

  const stylists = ((membersLoad.data ?? []) as { id: string; display_name: string | null; role: string; show_on_diary?: boolean | null }[])
    .filter((m) => memberShowsOnDiary(m))
    .map((m) => ({ id: m.id, name: m.display_name?.trim() || m.role }));

  const services = (servicesRes.data ?? []) as { id: string; name: string; duration_minutes: number }[];
  const appointments = appointmentsRes.data ?? [];
  const gaps: CalendarGap[] = [];

  for (const stylist of stylists) {
    const busy = appointments
      .filter((a) => a.stylist_id === stylist.id)
      .map((a) => ({
        start: new Date(a.start_time as string),
        end: new Date(a.end_time as string),
      }))
      .filter((b) => Number.isFinite(b.start.getTime()) && Number.isFinite(b.end.getTime()))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let dayOffset = 0; dayOffset < daysToScan; dayOffset++) {
      const day = new Date(rangeStart);
      day.setDate(day.getDate() + dayOffset);

      const dayStart = new Date(day);
      dayStart.setHours(DAY_START_HOUR, 0, 0, 0);

      const busyToday = busy
        .filter((b) => b.start >= day && b.start < new Date(day.getTime() + 24 * 60 * 60 * 1000))
        .map((b) => ({
          startM: minutesSinceDayStart(b.start, day),
          endM: minutesSinceDayStart(b.end, day),
        }))
        .sort((a, b) => a.startM - b.startM);

      const windows: { startM: number; endM: number }[] = [];
      let cursor = DAY_START_HOUR * 60;
      for (const block of busyToday) {
        if (block.startM > cursor) windows.push({ startM: cursor, endM: block.startM });
        cursor = Math.max(cursor, block.endM);
      }
      if (cursor < DAY_END_HOUR * 60) {
        windows.push({ startM: cursor, endM: DAY_END_HOUR * 60 });
      }

      for (const window of windows) {
        const gapMins = window.endM - window.startM;
        if (gapMins < minGap || gapMins > maxGap) continue;

        const slotStart = new Date(dayStart);
        slotStart.setMinutes(window.startM);
        const slotEnd = new Date(dayStart);
        slotEnd.setMinutes(window.endM);

        gaps.push({
          gapId: `gap-${stylist.id}-${slotStart.toISOString()}`,
          stylistId: stylist.id,
          stylistName: stylist.name,
          startIso: slotStart.toISOString(),
          endIso: slotEnd.toISOString(),
          durationMinutes: gapMins,
          dayLabel: fmtDayLabel(slotStart),
          timeLabel: fmtTimeLabel(slotStart),
          source: "schedule_gap",
          suggestedServiceNames: servicesFittingGap(services, gapMins),
        });
      }
    }
  }

  for (const row of cancelledRes.data ?? []) {
    const start = new Date(row.start_time as string);
    const end = new Date(row.end_time as string);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (durationMinutes < minGap || durationMinutes > maxGap + 30) continue;
    const stylist = stylists.find((s) => s.id === row.stylist_id);
    if (!stylist) continue;
    const serviceName =
      services.find((s) => s.id === (row.service_id as string | null))?.name ?? "Appointment";
    gaps.push({
      gapId: `cancel-${row.id}`,
      stylistId: stylist.id,
      stylistName: stylist.name,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      durationMinutes,
      dayLabel: fmtDayLabel(start),
      timeLabel: fmtTimeLabel(start),
      source: "cancellation",
      suggestedServiceNames: [serviceName],
    });
  }

  return gaps
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime())
    .slice(0, 12);
}

export function buildLastMinutePromotion(gap: CalendarGap, salonName: string): {
  sms: string;
  emailSubject: string;
  emailBody: string;
} {
  const serviceHint =
    gap.suggestedServiceNames.length > 0
      ? gap.suggestedServiceNames.slice(0, 2).join(" or ")
      : "selected treatments";
  const sms = `Last-minute opening at ${salonName}! ${gap.stylistName} has ${formatDurationMinutes(gap.durationMinutes)} on ${gap.dayLabel} at ${gap.timeLabel} — perfect for ${serviceHint}. Reply to book or visit our online booking page.`;
  const emailSubject = `Last-minute availability — ${gap.dayLabel} at ${gap.timeLabel}`;
  const emailBody = `Hello,\n\nWe have a last-minute opening at ${salonName}:\n\n• ${gap.dayLabel} at ${gap.timeLabel}\n• With ${gap.stylistName}\n• ${formatDurationMinutes(gap.durationMinutes)} slot\n• Ideal for: ${serviceHint}\n\nBook online or reply to this email to secure your appointment.\n\nSee you soon,\n${salonName}`;

  return { sms, emailSubject, emailBody };
}
