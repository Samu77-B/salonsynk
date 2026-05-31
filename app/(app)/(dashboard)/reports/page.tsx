import Link from "next/link";
import { redirect } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { requireSalonFeature } from "@/lib/salon-features.server";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { canViewReports } from "@/lib/dashboard-roles";
import { ReportPdfDownload } from "./report-pdf-download";
import type { ReportPdfPayload } from "./report-pdf-types";
import {
  buildReportWindowContext,
  customRangeHref,
  defaultCustomRangeDefaults,
  type PresetReportRange,
} from "./report-window";
import { ReportsCustomRangeForm } from "./reports-custom-range-form";
import { BusinessSnapshot, type SnapshotGeneralData, type SnapshotStylistRow, type SnapshotGoneAwayRow } from "./business-snapshot";

export const dynamic = "force-dynamic";

type AppointmentRow = {
  id: string;
  status: string;
  start_time: string;
  stylist_id: string | null;
  client_id: string | null;
  services: { name: string | null; price_minor: number | null } | null;
};

type SalesTransactionRow = {
  amount_minor: number;
  paid_at: string;
  product_ids?: string[] | null;
  salon_members: { display_name: string | null } | null;
};

function appendProductsToReportsHref(href: string, includeProducts: boolean): string {
  if (!includeProducts) return href;
  const joiner = href.includes("?") ? "&" : "?";
  return `${href}${joiner}products=1`;
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

function buildProductAggregates(rows: SalesTransactionRow[], nameById: Map<string, string>) {
  let totalProductSalesMinor = 0;
  const productStats = new Map<string, { count: number; salesMinor: number }>();

  for (const row of rows) {
    const pids = (row.product_ids ?? []).filter(Boolean);
    if (pids.length === 0) continue;
    const amountMinor = Number(row.amount_minor ?? 0);
    totalProductSalesMinor += amountMinor;
    const share = amountMinor / pids.length;
    for (const pid of pids) {
      const label = nameById.get(pid) ?? "Product";
      const entry = productStats.get(label) ?? { count: 0, salesMinor: 0 };
      entry.count += 1;
      entry.salesMinor += share;
      productStats.set(label, entry);
    }
  }

  const topProducts = [...productStats.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => (b.salesMinor !== a.salesMinor ? b.salesMinor - a.salesMinor : b.count - a.count))
    .slice(0, 6);

  return { totalProductSalesMinor, topProducts };
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
  searchParams: Promise<{
    range?: string | string[];
    from?: string | string[];
    to?: string | string[];
    products?: string | string[];
  }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { context } = await requireSalonFeature("reports");

  const isSuperAdmin = await getIsSuperAdmin();
  const role = context.member.role ?? "";

  if (!canViewReports(isSuperAdmin, role)) {
    return (
      <main className="mx-auto w-full min-w-0 p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-3">Reports</h1>
        <p className="text-sm text-muted">
          Reports are available to owners and manager roles only. Ask your salon owner to update your role if needed.
        </p>
      </main>
    );
  }

  const params = await searchParams;
  const productsParam = Array.isArray(params.products) ? params.products[0] : params.products;
  const includeProducts = productsParam === "1" || productsParam === "true";

  const now = new Date();
  const ctx = buildReportWindowContext(params, now);
  const defaults = defaultCustomRangeDefaults(now);
  const customEntryHref = appendProductsToReportsHref(customRangeHref(defaults.from, defaults.to), includeProducts);
  const customCurrentHref = appendProductsToReportsHref(
    ctx.customFromYmd && ctx.customToYmd
      ? customRangeHref(ctx.customFromYmd, ctx.customToYmd)
      : customRangeHref(ctx.formFrom, ctx.formTo),
    includeProducts,
  );
  const customPillHref =
    ctx.range === "custom" && ctx.customFromYmd && ctx.customToYmd
      ? customCurrentHref
      : ctx.customRequested
        ? appendProductsToReportsHref(customRangeHref(ctx.formFrom, ctx.formTo), includeProducts)
        : customEntryHref;

  const supabase = await createClient();
  const [appointmentsRes, salesRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(`
        id,
        status,
        start_time,
        stylist_id,
        client_id,
        services(name, price_minor)
      `)
      .eq("salon_id", context.salon.id)
      .gte("start_time", ctx.previousStart.toISOString())
      .lt("start_time", ctx.currentEnd.toISOString()),
    supabase
      .from("sales_transactions")
      .select(`
        amount_minor,
        paid_at,
        product_ids,
        salon_members(display_name)
      `)
      .eq("salon_id", context.salon.id)
      .gte("paid_at", ctx.previousStart.toISOString())
      .lt("paid_at", ctx.currentEnd.toISOString()),
  ]);

  const rows = (appointmentsRes.data as AppointmentRow[] | null) ?? [];
  const salesRows = (salesRes.data as SalesTransactionRow[] | null) ?? [];

  const currentRows = rows.filter((row) => {
    const ts = new Date(row.start_time).getTime();
    return ts >= ctx.currentStart.getTime() && ts < ctx.currentEnd.getTime();
  });
  const previousRows = rows.filter((row) => {
    const ts = new Date(row.start_time).getTime();
    return ts >= ctx.previousStart.getTime() && ts < ctx.currentStart.getTime();
  });
  const currentSalesRows = salesRows.filter((row) => {
    const ts = new Date(row.paid_at).getTime();
    return ts >= ctx.currentStart.getTime() && ts < ctx.currentEnd.getTime();
  });
  const previousSalesRows = salesRows.filter((row) => {
    const ts = new Date(row.paid_at).getTime();
    return ts >= ctx.previousStart.getTime() && ts < ctx.currentStart.getTime();
  });

  const currentAgg = buildAggregates(currentRows);
  const previousAgg = buildAggregates(previousRows);
  const currentSalesAgg = buildSalesAggregates(currentSalesRows);
  const previousSalesAgg = buildSalesAggregates(previousSalesRows);

  const productIdSet = new Set<string>();
  for (const row of salesRows) {
    for (const id of row.product_ids ?? []) {
      if (id) productIdSet.add(id);
    }
  }
  const nameById = new Map<string, string>();
  if (productIdSet.size > 0) {
    const { data: productRows } = await supabase
      .from("products")
      .select("id, name")
      .eq("salon_id", context.salon.id)
      .in("id", [...productIdSet]);
    for (const p of productRows ?? []) {
      nameById.set(p.id, p.name ?? "Product");
    }
  }

  const currentProductAgg = buildProductAggregates(currentSalesRows, nameById);
  const previousProductAgg = buildProductAggregates(previousSalesRows, nameById);

  // --- Snapshot: new clients ---
  const [newClientsCurrentRes, newClientsPrevRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", context.salon.id)
      .gte("created_at", ctx.currentStart.toISOString())
      .lt("created_at", ctx.currentEnd.toISOString()),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", context.salon.id)
      .gte("created_at", ctx.previousStart.toISOString())
      .lt("created_at", ctx.currentStart.toISOString()),
  ]);

  // --- Snapshot: rebooking rate ---
  function computeRebookingRate(apptRows: AppointmentRow[]): number {
    const completed = apptRows.filter((r) => r.status === "completed" && r.client_id);
    if (completed.length === 0) return 0;
    const clientAppointments = new Map<string, number>();
    for (const r of completed) {
      clientAppointments.set(r.client_id!, (clientAppointments.get(r.client_id!) ?? 0) + 1);
    }
    const rebooked = [...clientAppointments.values()].filter((c) => c > 1).length;
    return clientAppointments.size > 0 ? (rebooked / clientAppointments.size) * 100 : 0;
  }

  // --- Snapshot: per-stylist data ---
  const membersRes = await supabase
    .from("salon_members")
    .select("id, display_name")
    .eq("salon_id", context.salon.id)
    .eq("is_active", true);
  const memberNameById = new Map<string, string>();
  for (const m of membersRes.data ?? []) {
    memberNameById.set(m.id, m.display_name || "Unnamed");
  }

  function buildStylistReport(apptRows: AppointmentRow[], salesRows: SalesTransactionRow[]): SnapshotStylistRow[] {
    const stylistRevenue = new Map<string, number>();
    for (const row of salesRows) {
      const name = row.salon_members?.display_name?.trim() || "Unassigned";
      stylistRevenue.set(name, (stylistRevenue.get(name) ?? 0) + Number(row.amount_minor ?? 0));
    }

    const stylistAppts = new Map<string, number>();
    for (const row of apptRows) {
      if (row.status !== "completed" || !row.stylist_id) continue;
      const name = memberNameById.get(row.stylist_id) ?? "Unassigned";
      stylistAppts.set(name, (stylistAppts.get(name) ?? 0) + 1);
    }

    const allNames = new Set([...stylistRevenue.keys(), ...stylistAppts.keys()]);
    return [...allNames].map((name) => {
      const rev = stylistRevenue.get(name) ?? 0;
      const count = stylistAppts.get(name) ?? 0;
      return {
        name,
        revenueMinor: rev,
        appointmentCount: count,
        avgSpendMinor: count > 0 ? Math.round(rev / count) : 0,
      };
    });
  }

  // --- Snapshot: gone aways ---
  const GONE_AWAY_WEEKS = 8;
  const goneAwayCutoff = new Date();
  goneAwayCutoff.setDate(goneAwayCutoff.getDate() - GONE_AWAY_WEEKS * 7);

  const { data: allClients } = await supabase
    .from("clients")
    .select("id, name, email, phone")
    .eq("salon_id", context.salon.id);

  const { data: lastVisitRows } = await supabase
    .from("appointments")
    .select("client_id, start_time")
    .eq("salon_id", context.salon.id)
    .eq("status", "completed")
    .order("start_time", { ascending: false });

  const lastVisitByClient = new Map<string, string>();
  for (const row of lastVisitRows ?? []) {
    if (row.client_id && !lastVisitByClient.has(row.client_id)) {
      lastVisitByClient.set(row.client_id, row.start_time);
    }
  }

  const goneAways: SnapshotGoneAwayRow[] = [];
  for (const c of allClients ?? []) {
    const lastVisit = lastVisitByClient.get(c.id);
    if (!lastVisit) continue;
    const visitDate = new Date(lastVisit);
    if (visitDate >= goneAwayCutoff) continue;
    const weeksSince = Math.floor((Date.now() - visitDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    goneAways.push({
      id: c.id,
      name: c.name ?? "",
      email: c.email ?? null,
      phone: c.phone ?? null,
      lastVisit,
      weeksSince,
    });
  }
  goneAways.sort((a, b) => b.weeksSince - a.weeksSince);

  // --- Build snapshot data ---
  const VAT_RATE = 0.2;
  const snapshotGeneral: SnapshotGeneralData = {
    totalRevenueMinor: currentSalesAgg.totalSalesMinor,
    prevRevenueMinor: previousSalesAgg.totalSalesMinor,
    completedAppointments: currentAgg.completedAppointments,
    prevCompletedAppointments: previousAgg.completedAppointments,
    newClients: newClientsCurrentRes.count ?? 0,
    prevNewClients: newClientsPrevRes.count ?? 0,
    rebookingRate: computeRebookingRate(currentRows),
    prevRebookingRate: computeRebookingRate(previousRows),
    totalBookings: currentAgg.totalBookings,
    noShows: currentAgg.noShows,
    canceled: currentAgg.canceled,
  };
  const snapshotStylists = buildStylistReport(currentRows, currentSalesRows);

  const completedRate =
    currentAgg.totalBookings === 0 ? 0 : (currentAgg.completedAppointments / currentAgg.totalBookings) * 100;

  const previousCompletedRate =
    previousAgg.totalBookings === 0 ? 0 : (previousAgg.completedAppointments / previousAgg.totalBookings) * 100;

  const pdfPayload: ReportPdfPayload = {
    salonName: context.salon.name,
    range: ctx.pdfRange,
    customFromYmd: ctx.customFromYmd,
    customToYmd: ctx.customToYmd,
    rangeLabel: ctx.rangeLabel,
    dateRangeLabel: ctx.dateRangeLabel,
    salesLabel: ctx.salesLabel,
    totalSales: formatMoney(currentSalesAgg.totalSalesMinor),
    salesDelta: formatDeltaLine(ctx.deltaLabel, currentSalesAgg.totalSalesMinor, previousSalesAgg.totalSalesMinor),
    completedAppointments: currentAgg.completedAppointments,
    completedDelta: formatDeltaLine(ctx.deltaLabel, currentAgg.completedAppointments, previousAgg.completedAppointments),
    haircuts: currentAgg.haircutAppointments,
    haircutsDelta: formatDeltaLine(ctx.deltaLabel, currentAgg.haircutAppointments, previousAgg.haircutAppointments),
    completionRate: formatPercent(completedRate),
    completionDelta: formatDeltaLine(
      ctx.deltaLabel,
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
    includeProductSales: includeProducts,
    ...(includeProducts
      ? {
          totalProductSales: formatMoney(currentProductAgg.totalProductSalesMinor),
          productSalesDelta: formatDeltaLine(
            ctx.deltaLabel,
            currentProductAgg.totalProductSalesMinor,
            previousProductAgg.totalProductSalesMinor,
          ),
          topProductsRetail: currentProductAgg.topProducts.map((s) => ({
            name: s.name,
            count: s.count,
            sales: formatMoney(s.salesMinor),
          })),
        }
      : {}),
  };

  const reportDataError = !!(appointmentsRes.error || salesRes.error);

  const pillActive = "rounded-md px-3 py-1.5 text-sm bg-accent text-background";
  const pillIdle = "rounded-md px-3 py-1.5 text-sm text-muted hover:text-foreground";

  const productsOffHref =
    ctx.range === "custom" && ctx.customFromYmd && ctx.customToYmd
      ? `/reports?range=custom&from=${encodeURIComponent(ctx.customFromYmd)}&to=${encodeURIComponent(ctx.customToYmd)}`
      : ctx.customRequested
        ? `/reports?range=custom&from=${encodeURIComponent(ctx.formFrom)}&to=${encodeURIComponent(ctx.formTo)}`
        : `/reports?range=${ctx.range}`;

  const productsOnHref = appendProductsToReportsHref(productsOffHref, true);

  return (
    <main className="mx-auto w-full min-w-0 space-y-6 p-4 md:p-6">
      <Reveal>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted">
            {ctx.rangeLabel} performance for {context.salon.name} ({ctx.dateRangeLabel})
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <ReportPdfDownload payload={pdfPayload} disabled={reportDataError} />
          <div className="inline-flex flex-wrap justify-end gap-1 rounded-lg border border-border p-1">
            {(["daily", "weekly", "monthly"] as PresetReportRange[]).map((item) => (
              <Link
                key={item}
                href={appendProductsToReportsHref(`/reports?range=${item}`, includeProducts)}
                className={!ctx.customRequested && ctx.range === item ? pillActive : pillIdle}
              >
                {item === "daily" ? "Daily" : item === "weekly" ? "Weekly" : "Monthly"}
              </Link>
            ))}
            <Link href={customPillHref} className={ctx.customRequested ? pillActive : pillIdle}>
              Custom
            </Link>
          </div>
        </div>
      </div>
      </Reveal>

      <Reveal>
      <ReportsCustomRangeForm
        defaultFrom={ctx.formFrom}
        defaultTo={ctx.formTo}
        includeProducts={includeProducts}
      />
      </Reveal>

      {ctx.validationError && (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {ctx.validationError}
        </p>
      )}

      {(appointmentsRes.error || salesRes.error) && (
        <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          Could not load report data: {appointmentsRes.error?.message ?? salesRes.error?.message}
        </p>
      )}

      <Reveal>
        <BusinessSnapshot
          general={snapshotGeneral}
          stylists={snapshotStylists}
          goneAways={goneAways}
          goneAwayWeeks={GONE_AWAY_WEEKS}
          deltaLabel={ctx.deltaLabel}
          vatRate={VAT_RATE}
        />
      </Reveal>

      <Reveal>
      <section className="rounded-lg border border-border bg-white/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Retail sales in reports</h2>
        <p className="mt-2 text-sm text-muted">
          Toggle product-tagged ledger sales to show retail KPIs, top products (by allocated share of each payment), and
          PDF lines.
        </p>
        <div className="mt-3 inline-flex flex-wrap gap-1 rounded-lg border border-border p-1">
          <Link href={productsOffHref} className={!includeProducts ? pillActive : pillIdle}>
            All ledger sales only
          </Link>
          <Link href={productsOnHref} className={includeProducts ? pillActive : pillIdle}>
            Include product sales
          </Link>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="rounded-lg border border-border bg-white/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Data source</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>Sales and stylist revenue are from successful Stripe payments in the sales ledger.</li>
          <li>Bookings, completion rate, no-shows, cancellations, and haircuts are from appointment records.</li>
          <li>Product sales use ledger rows that include product IDs (shop or checkout with products).</li>
        </ul>
      </section>
      </Reveal>

      <Reveal>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted">{ctx.salesLabel}</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(currentSalesAgg.totalSalesMinor)}</p>
          <DeltaText label={ctx.deltaLabel} current={currentSalesAgg.totalSalesMinor} previous={previousSalesAgg.totalSalesMinor} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Completed appointments</p>
          <p className="mt-2 text-2xl font-semibold">{currentAgg.completedAppointments}</p>
          <DeltaText label={ctx.deltaLabel} current={currentAgg.completedAppointments} previous={previousAgg.completedAppointments} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Haircuts completed</p>
          <p className="mt-2 text-2xl font-semibold">{currentAgg.haircutAppointments}</p>
          <DeltaText label={ctx.deltaLabel} current={currentAgg.haircutAppointments} previous={previousAgg.haircutAppointments} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Completion rate</p>
          <p className="mt-2 text-2xl font-semibold">{formatPercent(completedRate)}</p>
          <DeltaText
            label={ctx.deltaLabel}
            current={currentAgg.totalBookings === 0 ? 0 : completedRate}
            previous={previousAgg.totalBookings === 0 ? 0 : (previousAgg.completedAppointments / previousAgg.totalBookings) * 100}
          />
        </div>
      </section>
      </Reveal>

      {includeProducts && (
        <Reveal>
        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Product-tagged sales</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(currentProductAgg.totalProductSalesMinor)}</p>
            <DeltaText
              label={ctx.deltaLabel}
              current={currentProductAgg.totalProductSalesMinor}
              previous={previousProductAgg.totalProductSalesMinor}
            />
            <p className="mt-2 text-xs text-muted">
              Sum of ledger payments that include at least one product. Multi-product carts split revenue evenly across
              products in “Top products”.
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <h2 className="text-lg font-semibold mb-2">Top products</h2>
            {currentProductAgg.topProducts.length === 0 ? (
              <p className="text-sm text-muted">No product sales in this period yet.</p>
            ) : (
              <ul className="space-y-2">
                {currentProductAgg.topProducts.map((product) => (
                  <li key={product.name} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate">{product.name}</p>
                      <p className="text-xs text-muted">{product.count} product line(s)</p>
                    </div>
                    <p className="font-medium">{formatMoney(product.salesMinor)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        </Reveal>
      )}

      <Reveal>
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
      </Reveal>

      <Reveal>
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
      </Reveal>

      <Reveal>
      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold mb-2">Data export</h2>
        <p className="text-sm text-muted mb-3">
          Download CSV files for this salon (opens in Excel). Same access as reports.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export/clients"
            className="rounded-md border border-border bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
          >
            Clients CSV
          </a>
          <a
            href="/api/export/sales"
            className="rounded-md border border-border bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
          >
            Sales CSV
          </a>
          <a
            href="/api/export/team"
            className="rounded-md border border-border bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
          >
            Team CSV
          </a>
          <a
            href="/api/export/summary-pdf"
            className="rounded-md border border-border bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
          >
            Summary PDF
          </a>
        </div>
      </section>
      </Reveal>
    </main>
  );
}
