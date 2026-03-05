/**
 * Diary rules: allowed slots and validation to avoid 15-minute gaps.
 * All times are in minutes from start of day (UTC or local as agreed by caller).
 */

const MIN_GAP_MINUTES = 15;
const SLOT_INTERVAL_MINUTES = 15;
const DAY_START_MINUTES = 0;
const DAY_END_MINUTES = 24 * 60; // 1440

export type TimeRange = { startMinutes: number; endMinutes: number };

/**
 * Convert a range to minutes-from-midnight for a given date.
 * Assumes date is the local date; use same timezone for all inputs.
 */
export function rangeToMinutes(
  start: Date,
  end: Date
): TimeRange {
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  return { startMinutes, endMinutes };
}

/**
 * Get allowed start times for a new appointment so that we don't create
 * a gap smaller than MIN_GAP_MINUTES between appointments.
 * existingRanges: array of { startMinutes, endMinutes } for the day (same stylist or same column).
 * durationMinutes: length of the new appointment.
 * Returns array of { startMinutes, endMinutes } for each valid slot.
 */
export function getAllowedSlots(
  existingRanges: TimeRange[],
  durationMinutes: number
): TimeRange[] {
  const slots: TimeRange[] = [];
  const sorted = [...existingRanges].sort((a, b) => a.startMinutes - b.startMinutes);

  let lastEnd = DAY_START_MINUTES;

  for (const block of sorted) {
    const gapStart = lastEnd;
    const gapEnd = block.startMinutes;
    const gapSize = gapEnd - gapStart;
    if (gapSize >= durationMinutes + (lastEnd === DAY_START_MINUTES ? 0 : MIN_GAP_MINUTES)) {
      const available = gapSize - (lastEnd === DAY_START_MINUTES ? 0 : MIN_GAP_MINUTES);
      for (let s = gapStart; s + durationMinutes <= gapStart + available; s += SLOT_INTERVAL_MINUTES) {
        if (s + durationMinutes <= gapEnd) {
          slots.push({ startMinutes: s, endMinutes: s + durationMinutes });
        }
      }
    }
    lastEnd = Math.max(lastEnd, block.endMinutes);
  }

  const tailGap = DAY_END_MINUTES - lastEnd;
  if (tailGap >= durationMinutes) {
    for (let s = lastEnd; s + durationMinutes <= DAY_END_MINUTES; s += SLOT_INTERVAL_MINUTES) {
      slots.push({ startMinutes: s, endMinutes: s + durationMinutes });
    }
  }

  return slots;
}

/**
 * Check if moving an appointment to newStart/newEnd would create a gap < MIN_GAP_MINUTES.
 * existingRanges: all other appointments for that stylist/day (excluding the one being moved).
 */
export function validateMove(
  existingRanges: TimeRange[],
  newStartMinutes: number,
  newEndMinutes: number
): { valid: boolean; message?: string } {
  const newRange: TimeRange = { startMinutes: newStartMinutes, endMinutes: newEndMinutes };
  const merged = [...existingRanges, newRange].sort((a, b) => a.startMinutes - b.startMinutes);

  for (let i = 1; i < merged.length; i++) {
    const gap = merged[i].startMinutes - merged[i - 1].endMinutes;
    if (gap > 0 && gap < MIN_GAP_MINUTES) {
      return { valid: false, message: `Would leave a ${gap}-minute gap. Minimum is ${MIN_GAP_MINUTES} minutes.` };
    }
  }
  return { valid: true };
}

export function minutesToTime(minutes: number): { hours: number; mins: number } {
  return { hours: Math.floor(minutes / 60), mins: minutes % 60 };
}
