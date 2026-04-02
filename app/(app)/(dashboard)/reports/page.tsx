import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { ReportPdfDownload } from "./report-pdf-download";
import type { ReportPdfPayload } from "./report-pdf-types";

type ReportRange = "daily" | "weekly" | "monthly";

type AppointmentRow = {
  id: string;
  status: string;
  start_time: string;
  services: { name: string | null; price_minor: number | null } | null;
};

type SalesTransactionRow = {
  amount_minor: number;
  paid_at: string;
  salon_members: { display_name: string | null } | null;
};

const RANGE_CONFIG: Record<ReportRange, { label: string; salesLabel: string }> = {
  daily: { label: "Daily", salesLabel: "Daily sales" },
  weekly: { label: "Weekly", salesLabel: "Weekly sales" },
  monthly: { label: "Monthly", salesLabel: "Monthly sales" },
};

function parseRange(value: string | string[] | undefined): ReportRange {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "daily" || raw === "weekly" || raw === "monthly" ? raw : "daily";
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
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

function getWindowForRange(range: ReportRange, now: Date) {
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

function isHaircutService(name: string | null | undefined): boolean {
  if (!name) return false;
  return /\b(cut|haircut|trim|fringe|fade|clipper)\b/i.test(name);
}

function formatMoney(minor: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function buildAggregates(rows: AppointmentRow[]) {
  let totalBookings = 0;
  let completedAppointments = 0;
  let noShows = 0;
  let canceled = 0;
  let haircutAppointments = 0;

  const serviceStats = new Map<string, { count: number; salesMinor: number }>();

  for (const row of rows) {
    totalBookings += 1;
    if (row.status === "no_show") noShows += 1;
    if (row.status === "canceled") canceled += 1;

    if (row.status !== "completed") continue;

    completedAppointments += 1;
    const serviceName = row.services?.name?.trim() || "Unknown service";
    const servicePriceMinor = Number(row.services?.price_minor ?? 0);

    if (isHaircutService(serviceName)) haircutAppointments += 1;

    const serviceEntry = serviceStats.get(serviceName) ?? { count: 0, salesMinor: 0 };
    serviceEntry.count += 1;
    serviceEntry.salesMinor += servicePriceMinor;
    serviceStats.set(serviceName, serviceEntry);
  }

  const topServices = [...serviceStats.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => (b.salesMinor !== a.salesMinor ? b.salesMinor - a.salesMinor : b.count - a.count))
    .slice(0, 6);

  return {
    totalBookings,
    completedAppointments,
    noShows,
    canceled,
    haircutAppointments,
    topServices,
  };
}

function buildSalesAggregates(rows: SalesTransactionRow[]) {
  let totalSalesMinor = 0;
  const stylistStats = new Map<string, { count: number; salesMinor: number }>();

  for (const row of rows) {
    const amountMinor = Number(row.amount_minor ?? 0);
    totalSalesMinor += amountMinor;
    const stylistName = row.salon_members?.display_name?.trim() || "Unassigned stylist";
    const stylistEntry = stylistStats.get(stylistName) ?? { count: 0, salesMinor: 0 };
    stylistEntry.count += 1;
    stylistEntry.salesMinor += amountMinor;
    stylistStats.set(stylistName, stylistEntry);
  }

  const topStylists = [...stylistStats.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => (b.salesMinor !== a.salesMinor ? b.salesMinor - a.salesMinor : b.count - a.count))
    .slice(0, 6);

  return { totalSalesMinor, topStylists };
}

function dateRangeLabel(range: ReportRange, start: Date, end: Date): string {
  const startLabel = start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const endExclusive = addDays(end, -1);
  const endLabel = endExclusive.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return range === "daily" ? startLabel : `${startLabel} - ${endLabel}`;
}

function formatDeltaLine(label: string, current: number, previous: number): string {
  const delta = percentChange(current, previous);
  if (delta === null) {
    if (current === 0) return `No change vs previous ${label}`;
    return `New data vs previous ${label}`;
  }
  return `${delta >= 0 ? "+" : ""}${formatPercent(delta)} vs previous ${label}`;
}

function DeltaText({ label, current, previous }: { label: string; current: number; previous: number }) {
  const line = formatDeltaLine(label, current, previous);
  const delta = percentChange(current, previous);
  if (delta === null) {
    if (current === 0) return <p className="text-xs text-muted">{line}</p>;
    return <p className="text-xs text-emerald-400">{line}</p>;
  }
  return <p className={`text-xs ${delta >= 0 ? "text-emerald-400" : "text-amber-400"}`}>{line}</p>;
}

type ReportsPageProps = {
  searchParams: Promise<{ range?: string | string[] }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const isSuperAdmin = await getIsSuperAdmin();
  const role = (context.member.role ?? "").toLowerCase();
  const canViewReports = isSuperAdmin || role === "owner" || role.includes("manager");

  if (!canViewReports) {
    return (
      <main className="p-4 md:p-6 min-w-0">
        <h1 className="text-2xl font-bold mb-3">Reports</h1>
        <p className="text-sm text-muted">
          Reports are available to owners and manager roles only. Ask your salon owner to update your role if needed.
        </p>
      </main>
    );
  }

  const params = await searchParams;
  const range = parseRange(params.range);
  const now = new Date();
  const { currentStart, currentEnd, previousStart } = getWindowForRange(range, now);

  const supabase = await createClient();
  const [appointmentsRes, salesRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(`
        id,
        status,
        start_time,
        services(name, price_minor)
      `)
      .eq("salon_id", context.salon.id)
      .gte("start_time", previousStart.toISOString())
      .lt("start_time", currentEnd.toISOString()),
    supabase
      .from("sales_transactions")
      .select(`
        amount_minor,
        paid_at,
        salon_members(display_name)
      `)
      .eq("salon_id", context.salon.id)
      .gte("paid_at", previousStart.toISOString())
      .lt("paid_at", currentEnd.toISOString()),
  ]);

  const rows = (appointmentsRes.data as AppointmentRow[] | null) ?? [];
  const salesRows = (salesRes.data as SalesTransactionRow[] | null) ?? [];

  const currentRows = rows.filter((row) => {
    const ts = new Date(row.start_time).getTime();
    return ts >= currentStart.getTime() && ts < currentEnd.getTime();
  });
  const previousRows = rows.filter((row) => {
    const ts = new Date(row.start_time).getTime();
    return ts >= previousStart.getTime() && ts < currentStart.getTime();
  });
  const currentSalesRows = salesRows.filter((row) => {
    const ts = new Date(row.paid_at).getTime();
    return ts >= currentStart.getTime() && ts < currentEnd.getTime();
  });
  const previousSalesRows = salesRows.filter((row) => {
    const ts = new Date(row.paid_at).getTime();
    return ts >= previousStart.getTime() && ts < currentStart.getTime();
  });

  const currentAgg = buildAggregates(currentRows);
  const previousAgg = buildAggregates(previousRows);
  const currentSalesAgg = buildSalesAggregates(currentSalesRows);
  const previousSalesAgg = buildSalesAggregates(previousSalesRows);

  const completedRate = currentAgg.totalBookings === 0
    ? 0
    : (currentAgg.completedAppointments / currentAgg.totalBookings) * 100;

  const previousCompletedRate =
    previousAgg.totalBookings === 0 ? 0 : (previousAgg.completedAppointments / previousAgg.totalBookings) * 100;

  const pdfPayload: ReportPdfPayload = {
    salonName: context.salon.name,
    range,
    rangeLabel: RANGE_CONFIG[range].label,
    dateRangeLabel: dateRangeLabel(range, currentStart, currentEnd),
    salesLabel: RANGE_CONFIG[range].salesLabel,
    totalSales: formatMoney(currentSalesAgg.totalSalesMinor),
    salesDelta: formatDeltaLine(range, currentSalesAgg.totalSalesMinor, previousSalesAgg.totalSalesMinor),
    completedAppointments: currentAgg.completedAppointments,
    completedDelta: formatDeltaLine(range, currentAgg.completedAppointments, previousAgg.completedAppointments),
    haircuts: currentAgg.haircutAppointments,
    haircutsDelta: formatDeltaLine(range, currentAgg.haircutAppointments, previousAgg.haircutAppointments),
    completionRate: formatPercent(completedRate),
    completionDelta: formatDeltaLine(
      range,
      currentAgg.totalBookings === 0 ? 0 : completedRate,
      previousCompletedRate,
    ),
    topServices: currentAgg.topServices.map((s) => ({
      name: s.name,
      count: s.count,
      sales: formatMoney(s.salesMinor),
    })),
    topStylists: currentSalesAgg.topStylists.map((s) => ({
      name: s.name,
      count: s.count,
      sales: formatMoney(s.salesMinor),
    })),
    totalBookings: currentAgg.totalBookings,
    noShows: currentAgg.noShows,
    canceled: currentAgg.canceled,
  };

  const reportDataError = !!(appointmentsRes.error || salesRes.error);

  return (
    <main className="p-4 md:p-6 min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted">
            {RANGE_CONFIG[range].label} performance for {context.salon.name} ({dateRangeLabel(range, currentStart, currentEnd)})
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <ReportPdfDownload payload={pdfPayload} disabled={reportDataError} />
          <div className="inline-flex rounded-lg border border-border p-1">
            {(["daily", "weekly", "monthly"] as ReportRange[]).map((item) => (
              <Link
                key={item}
                href={`/reports?range=${item}`}
                className={`rounded-md px-3 py-1.5 text-sm ${range === item ? "bg-accent text-background" : "text-muted hover:text-foreground"}`}
              >
                {RANGE_CONFIG[item].label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {(appointmentsRes.error || salesRes.error) && (
        <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          Could not load report data: {appointmentsRes.error?.message ?? salesRes.error?.message}
        </p>
      )}

      <section className="rounded-lg border border-border bg-white/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Data source</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>Sales and stylist revenue are from successful Stripe payments in the sales ledger.</li>
          <li>Bookings, completion rate, no-shows, cancellations, and haircuts are from appointment records.</li>
        </ul>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted">{RANGE_CONFIG[range].salesLabel}</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(currentSalesAgg.totalSalesMinor)}</p>
          <DeltaText label={range} current={currentSalesAgg.totalSalesMinor} previous={previousSalesAgg.totalSalesMinor} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Completed appointments</p>
          <p className="mt-2 text-2xl font-semibold">{currentAgg.completedAppointments}</p>
          <DeltaText label={range} current={currentAgg.completedAppointments} previous={previousAgg.completedAppointments} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Haircuts completed</p>
          <p className="mt-2 text-2xl font-semibold">{currentAgg.haircutAppointments}</p>
          <DeltaText label={range} current={currentAgg.haircutAppointments} previous={previousAgg.haircutAppointments} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Completion rate</p>
          <p className="mt-2 text-2xl font-semibold">{formatPercent(completedRate)}</p>
          <DeltaText
            label={range}
            current={currentAgg.totalBookings === 0 ? 0 : completedRate}
            previous={previousAgg.totalBookings === 0 ? 0 : (previousAgg.completedAppointments / previousAgg.totalBookings) * 100}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Top services</h2>
          {currentAgg.topServices.length === 0 ? (
            <p className="text-sm text-muted">No completed services in this period yet.</p>
          ) : (
            <ul className="space-y-2">
              {currentAgg.topServices.map((service) => (
                <li key={service.name} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">{service.name}</p>
                    <p className="text-xs text-muted">{service.count} completed</p>
                  </div>
                  <p className="font-medium">{formatMoney(service.salesMinor)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Top stylists</h2>
          {currentSalesAgg.topStylists.length === 0 ? (
            <p className="text-sm text-muted">No sales in this period yet.</p>
          ) : (
            <ul className="space-y-2">
              {currentSalesAgg.topStylists.map((stylist) => (
                <li key={stylist.name} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">{stylist.name}</p>
                    <p className="text-xs text-muted">{stylist.count} transactions</p>
                  </div>
                  <p className="font-medium">{formatMoney(stylist.salesMinor)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold mb-2">Attendance overview</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md bg-white/5 px-3 py-2">
            <p className="text-xs text-muted">Total bookings</p>
            <p className="text-lg font-semibold">{currentAgg.totalBookings}</p>
          </div>
          <div className="rounded-md bg-white/5 px-3 py-2">
            <p className="text-xs text-muted">No-shows</p>
            <p className="text-lg font-semibold">{currentAgg.noShows}</p>
          </div>
          <div className="rounded-md bg-white/5 px-3 py-2">
            <p className="text-xs text-muted">Cancellations</p>
            <p className="text-lg font-semibold">{currentAgg.canceled}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
