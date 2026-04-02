export type PresetReportRange = "daily" | "weekly" | "monthly";
export type ReportModeRange = PresetReportRange | "custom";

const MAX_CUSTOM_RANGE_DAYS = 366;

const PRESET_CONFIG: Record<PresetReportRange, { label: string; salesLabel: string }> = {
  daily: { label: "Daily", salesLabel: "Daily sales" },
  weekly: { label: "Weekly", salesLabel: "Weekly sales" },
  monthly: { label: "Monthly", salesLabel: "Monthly sales" },
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function getWindowForPreset(range: PresetReportRange, now: Date) {
  if (range === "daily") {
    const start = startOfDay(now);
    return { currentStart: start, currentEnd: addDays(start, 1), previousStart: addDays(start, -1) };
  }
  if (range === "weekly") {
    const start = startOfWeekMonday(now);
    return { currentStart: start, currentEnd: addDays(start, 7), previousStart: addDays(start, -7) };
  }
  const start = startOfMonth(now);
  return { currentStart: start, currentEnd: addMonths(start, 1), previousStart: addMonths(start, -1) };
}

export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function parseIsoDate(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return raw;
}

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

export function defaultCustomRangeDefaults(now: Date): { from: string; to: string } {
  const end = startOfDay(now);
  const start = addDays(end, -6);
  return { from: toYmd(start), to: toYmd(end) };
}

function dateRangeLabelPreset(range: PresetReportRange, start: Date, end: Date): string {
  const startLabel = start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const endExclusive = addDays(end, -1);
  const endLabel = endExclusive.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return range === "daily" ? startLabel : `${startLabel} - ${endLabel}`;
}

function customDateRangeLabel(fromYmd: string, toYmd: string): string {
  const a = parseLocalDate(fromYmd);
  const b = parseLocalDate(toYmd);
  const startLabel = a.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const endLabel = b.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function parsePresetRange(value: string | undefined): PresetReportRange {
  return value === "daily" || value === "weekly" || value === "monthly" ? value : "daily";
}

export type ReportWindowContext = {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  range: ReportModeRange;
  rangeLabel: string;
  salesLabel: string;
  dateRangeLabel: string;
  deltaLabel: string;
  validationError?: string;
  formFrom: string;
  formTo: string;
  /** True when URL has range=custom (valid or not). */
  customRequested: boolean;
  pdfRange: ReportModeRange;
  customFromYmd?: string;
  customToYmd?: string;
};

export function buildReportWindowContext(
  params: { range?: string | string[]; from?: string | string[]; to?: string | string[] },
  now: Date,
): ReportWindowContext {
  const defaults = defaultCustomRangeDefaults(now);
  const rangeParam = Array.isArray(params.range) ? params.range[0] : params.range;
  const fromParsed = parseIsoDate(params.from);
  const toParsed = parseIsoDate(params.to);

  let formFrom = defaults.from;
  let formTo = defaults.to;
  if (rangeParam === "custom") {
    if (fromParsed) formFrom = fromParsed;
    if (toParsed) formTo = toParsed;
  }

  if (rangeParam === "custom") {
    if (!fromParsed || !toParsed) {
      const w = getWindowForPreset("daily", now);
      return {
        currentStart: w.currentStart,
        currentEnd: w.currentEnd,
        previousStart: w.previousStart,
        range: "daily",
        rangeLabel: PRESET_CONFIG.daily.label,
        salesLabel: PRESET_CONFIG.daily.salesLabel,
        dateRangeLabel: dateRangeLabelPreset("daily", w.currentStart, w.currentEnd),
        deltaLabel: "daily",
        validationError: "Select a start date and an end date, then click Apply.",
        formFrom,
        formTo,
        customRequested: true,
        pdfRange: "daily",
      };
    }

    const currentStart = startOfDay(parseLocalDate(fromParsed));
    const currentEnd = addDays(startOfDay(parseLocalDate(toParsed)), 1);
    if (currentEnd.getTime() <= currentStart.getTime()) {
      const w = getWindowForPreset("daily", now);
      return {
        currentStart: w.currentStart,
        currentEnd: w.currentEnd,
        previousStart: w.previousStart,
        range: "daily",
        rangeLabel: PRESET_CONFIG.daily.label,
        salesLabel: PRESET_CONFIG.daily.salesLabel,
        dateRangeLabel: dateRangeLabelPreset("daily", w.currentStart, w.currentEnd),
        deltaLabel: "daily",
        validationError: "End date must be on or after the start date.",
        formFrom: fromParsed,
        formTo: toParsed,
        customRequested: true,
        pdfRange: "daily",
      };
    }

    const days = (currentEnd.getTime() - currentStart.getTime()) / 86_400_000;
    if (days > MAX_CUSTOM_RANGE_DAYS) {
      const w = getWindowForPreset("daily", now);
      return {
        currentStart: w.currentStart,
        currentEnd: w.currentEnd,
        previousStart: w.previousStart,
        range: "daily",
        rangeLabel: PRESET_CONFIG.daily.label,
        salesLabel: PRESET_CONFIG.daily.salesLabel,
        dateRangeLabel: dateRangeLabelPreset("daily", w.currentStart, w.currentEnd),
        deltaLabel: "daily",
        validationError: `Custom range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days.`,
        formFrom: fromParsed,
        formTo: toParsed,
        customRequested: true,
        pdfRange: "daily",
      };
    }

    const periodMs = currentEnd.getTime() - currentStart.getTime();
    const previousStart = new Date(currentStart.getTime() - periodMs);

    return {
      currentStart,
      currentEnd,
      previousStart,
      range: "custom",
      rangeLabel: "Custom range",
      salesLabel: "Period sales",
      dateRangeLabel: customDateRangeLabel(fromParsed, toParsed),
      deltaLabel: "period",
      formFrom: fromParsed,
      formTo: toParsed,
      customRequested: true,
      pdfRange: "custom",
      customFromYmd: fromParsed,
      customToYmd: toParsed,
    };
  }

  const preset = parsePresetRange(rangeParam);
  const w = getWindowForPreset(preset, now);
  return {
    currentStart: w.currentStart,
    currentEnd: w.currentEnd,
    previousStart: w.previousStart,
    range: preset,
    rangeLabel: PRESET_CONFIG[preset].label,
    salesLabel: PRESET_CONFIG[preset].salesLabel,
    dateRangeLabel: dateRangeLabelPreset(preset, w.currentStart, w.currentEnd),
    deltaLabel: preset,
    formFrom: defaults.from,
    formTo: defaults.to,
    customRequested: false,
    pdfRange: preset,
  };
}

export function customRangeHref(from: string, to: string): string {
  const q = new URLSearchParams({ range: "custom", from, to });
  return `/reports?${q.toString()}`;
}
