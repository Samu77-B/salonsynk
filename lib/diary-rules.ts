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
    if (gap < 0) {
      return { valid: false, message: "Appointments would overlap. A stylist cannot have two appointments at the same time." };
    }
    if (gap > 0 && gap < MIN_GAP_MINUTES) {
      return { valid: false, message: `Would leave a ${gap}-minute gap. Minimum is ${MIN_GAP_MINUTES} minutes.` };
    }
  }
  return { valid: true };
}

export function minutesToTime(minutes: number): { hours: number; mins: number } {
  return { hours: Math.floor(minutes / 60), mins: minutes % 60 };
}

/**
 * Check if a new time range overlaps with any existing ranges.
 * Returns true if there is overlap.
 */
export function hasOverlap(
  existingRanges: TimeRange[],
  newStartMinutes: number,
  newEndMinutes: number
): boolean {
  for (const r of existingRanges) {
    if (newStartMinutes < r.endMinutes && newEndMinutes > r.startMinutes) return true;
  }
  return false;
}

/**
 * Blocking segments when the stylist is busy (hands-on).
 * `processingMinutes` = client processing (e.g. colour developing); stylist can take another client then.
 * Processing is placed in the middle of the slot; hands-on time is split before/after.
 */
export function blockingSegmentsFromRange(
  startMinutes: number,
  endMinutes: number,
  processingMinutes: number
): TimeRange[] {
  const dur = endMinutes - startMinutes;
  if (dur <= 0) return [];
  const p = Math.max(0, Math.min(processingMinutes, dur));
  if (p <= 0 || p >= dur) {
    return [{ startMinutes, endMinutes }];
  }
  const hands = dur - p;
  const before = Math.floor(hands / 2);
  const after = hands - before;
  const pStart = startMinutes + before;
  const pEnd = pStart + p;
  const out: TimeRange[] = [];
  if (before > 0) out.push({ startMinutes, endMinutes: pStart });
  if (after > 0) out.push({ startMinutes: pEnd, endMinutes });
  return out.length ? out : [{ startMinutes, endMinutes }];
}

export function segmentsOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;
}

export type AppointmentBlockingInput = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  processingMinutes: number;
};

/** True if new appointment's blocking time overlaps any existing appointment's blocking time. */
export function hasBlockingOverlapWithExisting(
  existing: AppointmentBlockingInput[],
  newStartMinutes: number,
  newEndMinutes: number,
  newProcessingMinutes: number,
  excludeAppointmentId?: string
): boolean {
  const newSegs = blockingSegmentsFromRange(newStartMinutes, newEndMinutes, newProcessingMinutes);
  for (const ex of existing) {
    if (excludeAppointmentId && ex.id === excludeAppointmentId) continue;
    const exSegs = blockingSegmentsFromRange(ex.startMinutes, ex.endMinutes, ex.processingMinutes);
    for (const ns of newSegs) {
      for (const es of exSegs) {
        if (segmentsOverlap(ns, es)) return true;
      }
    }
  }
  return false;
}

/**
 * Validate drag-reschedule: no blocking overlap; gaps between different appointments >= MIN_GAP (same-appt gaps ignored).
 */
export function validateMoveWithProcessing(
  existing: AppointmentBlockingInput[],
  newAppointmentId: string,
  newStartMinutes: number,
  newEndMinutes: number,
  newProcessingMinutes: number
): { valid: boolean; message?: string } {
  const others = existing.filter((a) => a.id !== newAppointmentId);
  const moved: AppointmentBlockingInput = {
    id: newAppointmentId,
    startMinutes: newStartMinutes,
    endMinutes: newEndMinutes,
    processingMinutes: newProcessingMinutes,
  };
  const all = [...others, moved];

  const flat: { start: number; end: number; apptId: string }[] = [];
  for (const a of all) {
    for (const seg of blockingSegmentsFromRange(a.startMinutes, a.endMinutes, a.processingMinutes)) {
      flat.push({ start: seg.startMinutes, end: seg.endMinutes, apptId: a.id });
    }
  }
  flat.sort((x, y) => x.start - y.start || x.end - y.end);

  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      const A = flat[i];
      const B = flat[j];
      if (B.start >= A.end) break;
      if (A.apptId === B.apptId) continue;
      if (
        segmentsOverlap(
          { startMinutes: A.start, endMinutes: A.end },
          { startMinutes: B.start, endMinutes: B.end }
        )
      ) {
        return {
          valid: false,
          message:
            "Appointments would overlap. A stylist cannot be with two clients at once during hands-on time.",
        };
      }
    }
  }

  for (let i = 1; i < flat.length; i++) {
    const prev = flat[i - 1];
    const curr = flat[i];
    const gap = curr.start - prev.end;
    if (gap < 0) continue;
    if (prev.apptId !== curr.apptId && gap > 0 && gap < MIN_GAP_MINUTES) {
      return {
        valid: false,
        message: `Would leave a ${gap}-minute gap between bookings. Minimum is ${MIN_GAP_MINUTES} minutes.`,
      };
    }
  }

  return { valid: true };
}
