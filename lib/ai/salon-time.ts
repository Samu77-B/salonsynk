/** UK salon local time — matches diary display for Fab Hair and UK tenants. */
export const SALON_TZ = "Europe/London";

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function salonLocalParts(instant: Date): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: SALON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

export function parseSalonDateIso(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = new Date(`${trimmed}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  return trimmed;
}

/** Parse HH:mm (24h) local salon time. */
export function parseSalonLocalTime(value: string): { hour: number; minute: number } | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** UTC instant for a salon-local date + time (handles BST/GMT). */
export function salonLocalToUtc(dateIso: string, hour: number, minute: number): Date {
  const [y, mo, d] = dateIso.split("-").map(Number);
  let candidate = new Date(Date.UTC(y, mo - 1, d, hour, minute, 0, 0));
  for (let i = 0; i < 4; i++) {
    const p = salonLocalParts(candidate);
    const targetM = hour * 60 + minute;
    const actualM = p.hour * 60 + p.minute;
    const dayMatch = p.year === y && p.month === mo && p.day === d;
    if (dayMatch && actualM === targetM) return candidate;
    const dayDiff =
      (Date.UTC(y, mo - 1, d) - Date.UTC(p.year, p.month - 1, p.day)) / 86_400_000;
    candidate = new Date(candidate.getTime() + (targetM - actualM) * 60_000 + dayDiff * 86_400_000);
  }
  return candidate;
}

export function salonDateIsoFromInstant(instant: Date): string {
  const p = salonLocalParts(instant);
  const mo = String(p.month).padStart(2, "0");
  const d = String(p.day).padStart(2, "0");
  return `${p.year}-${mo}-${d}`;
}

export function salonLocalMinutesFromMidnight(instant: Date): number {
  const p = salonLocalParts(instant);
  return p.hour * 60 + p.minute;
}

export function formatSalonDayLabel(instant: Date): string {
  return instant.toLocaleDateString("en-GB", {
    timeZone: SALON_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatSalonTimeLabel(instant: Date): string {
  return instant.toLocaleTimeString("en-GB", {
    timeZone: SALON_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todaySalonDateIso(): string {
  return salonDateIsoFromInstant(new Date());
}
