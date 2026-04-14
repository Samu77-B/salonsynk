"use client";

import { useState, useMemo } from "react";

type Tab = "general" | "staff" | "gone-aways";

export type SnapshotGeneralData = {
  totalRevenueMinor: number;
  prevRevenueMinor: number;
  completedAppointments: number;
  prevCompletedAppointments: number;
  newClients: number;
  prevNewClients: number;
  rebookingRate: number;
  prevRebookingRate: number;
  totalBookings: number;
  noShows: number;
  canceled: number;
};

export type SnapshotStylistRow = {
  name: string;
  revenueMinor: number;
  appointmentCount: number;
  avgSpendMinor: number;
};

export type SnapshotGoneAwayRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lastVisit: string;
  weeksSince: number;
};

export type BusinessSnapshotProps = {
  general: SnapshotGeneralData;
  stylists: SnapshotStylistRow[];
  goneAways: SnapshotGoneAwayRow[];
  goneAwayWeeks: number;
  deltaLabel: string;
  vatRate: number;
};

function formatMoney(minor: number, includeVat: boolean, vatRate: number): string {
  const adjusted = includeVat ? minor : Math.round(minor / (1 + vatRate));
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(adjusted / 100);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function DeltaBadge({ current, previous, label, isMoney, includeVat, vatRate }: {
  current: number;
  previous: number;
  label: string;
  isMoney?: boolean;
  includeVat?: boolean;
  vatRate?: number;
}) {
  if (previous === 0 && current === 0) return <p className="text-xs text-muted mt-1">No change vs {label}</p>;
  if (previous === 0) return <p className="text-xs text-emerald-400 mt-1">New vs {label}</p>;
  const cur = isMoney && !includeVat ? Math.round(current / (1 + (vatRate ?? 0))) : current;
  const prev = isMoney && !includeVat ? Math.round(previous / (1 + (vatRate ?? 0))) : previous;
  const pct = ((cur - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "";
  return (
    <p className={`text-xs mt-1 ${pct >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
      {sign}{pct.toFixed(1)}% vs {label}
    </p>
  );
}

function MetricCard({ title, value, children }: { title: string; value: string | number; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {children}
    </div>
  );
}

export function BusinessSnapshot({ general, stylists, goneAways, goneAwayWeeks, deltaLabel, vatRate }: BusinessSnapshotProps) {
  const [tab, setTab] = useState<Tab>("general");
  const [includeVat, setIncludeVat] = useState(true);

  const fmt = (minor: number) => formatMoney(minor, includeVat, vatRate);

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "staff", label: "Staff Report" },
    { id: "gone-aways", label: "Gone Aways" },
  ];

  const sortedStylists = useMemo(
    () => [...stylists].sort((a, b) => b.revenueMinor - a.revenueMinor),
    [stylists]
  );

  return (
    <section className="rounded-xl border border-border bg-white/[0.03] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 pt-4 pb-0 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">Snapshot of your business</h2>
          <p className="text-xs text-muted mb-3">Key metrics at a glance</p>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeVat}
              onChange={() => setIncludeVat((v) => !v)}
              className="accent-accent w-3.5 h-3.5"
            />
            Inc. VAT
          </label>
        </div>
      </div>

      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "general" && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Total revenue" value={fmt(general.totalRevenueMinor)}>
              <DeltaBadge current={general.totalRevenueMinor} previous={general.prevRevenueMinor} label={deltaLabel} isMoney includeVat={includeVat} vatRate={vatRate} />
            </MetricCard>
            <MetricCard title="Appointments" value={general.completedAppointments}>
              <DeltaBadge current={general.completedAppointments} previous={general.prevCompletedAppointments} label={deltaLabel} />
            </MetricCard>
            <MetricCard title="New clients" value={general.newClients}>
              <DeltaBadge current={general.newClients} previous={general.prevNewClients} label={deltaLabel} />
            </MetricCard>
            <MetricCard title="Rebooking rate" value={formatPercent(general.rebookingRate)}>
              <DeltaBadge current={general.rebookingRate} previous={general.prevRebookingRate} label={deltaLabel} />
            </MetricCard>

            <div className="sm:col-span-2 xl:col-span-4 grid gap-3 grid-cols-3">
              <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                <p className="text-xs text-muted">Total bookings</p>
                <p className="text-lg font-bold">{general.totalBookings}</p>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                <p className="text-xs text-muted">No-shows</p>
                <p className="text-lg font-bold">{general.noShows}</p>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
                <p className="text-xs text-muted">Cancellations</p>
                <p className="text-lg font-bold">{general.canceled}</p>
              </div>
            </div>
          </div>
        )}

        {tab === "staff" && (
          <>
            {sortedStylists.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">No staff data for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="pb-2 pr-4">Stylist</th>
                      <th className="pb-2 pr-4 text-right">Revenue</th>
                      <th className="pb-2 pr-4 text-right">Appointments</th>
                      <th className="pb-2 text-right">Avg. spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStylists.map((s) => (
                      <tr key={s.name} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{s.name}</td>
                        <td className="py-2.5 pr-4 text-right">{fmt(s.revenueMinor)}</td>
                        <td className="py-2.5 pr-4 text-right">{s.appointmentCount}</td>
                        <td className="py-2.5 text-right">{fmt(s.avgSpendMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-semibold">
                      <td className="pt-2.5 pr-4">Total</td>
                      <td className="pt-2.5 pr-4 text-right">
                        {fmt(sortedStylists.reduce((s, r) => s + r.revenueMinor, 0))}
                      </td>
                      <td className="pt-2.5 pr-4 text-right">
                        {sortedStylists.reduce((s, r) => s + r.appointmentCount, 0)}
                      </td>
                      <td className="pt-2.5 text-right">
                        {(() => {
                          const totalRev = sortedStylists.reduce((s, r) => s + r.revenueMinor, 0);
                          const totalApts = sortedStylists.reduce((s, r) => s + r.appointmentCount, 0);
                          return totalApts > 0 ? fmt(Math.round(totalRev / totalApts)) : "—";
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "gone-aways" && (
          <>
            <p className="text-xs text-muted mb-3">
              Clients who haven&apos;t visited in over {goneAwayWeeks} weeks.
            </p>
            {goneAways.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">No gone-away clients for this threshold.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="pb-2 pr-4">Client</th>
                      <th className="pb-2 pr-4">Contact</th>
                      <th className="pb-2 pr-4 text-right">Last visit</th>
                      <th className="pb-2 text-right">Weeks ago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goneAways.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{c.name || "Unnamed"}</td>
                        <td className="py-2.5 pr-4 text-muted">
                          {c.email || c.phone || "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          {new Date(c.lastVisit).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={c.weeksSince >= 12 ? "text-red-400" : c.weeksSince >= 8 ? "text-amber-400" : ""}>
                            {c.weeksSince}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted mt-2">{goneAways.length} client{goneAways.length !== 1 ? "s" : ""}</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
