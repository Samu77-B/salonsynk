"use client";

import { formatMoneyMinor } from "@/lib/appointment-billing";
import type { StaffAnalyticsRow } from "@/lib/staff-analytics";

export function StaffAnalyticsPanel({ rows, periodLabel }: { rows: StaffAnalyticsRow[]; periodLabel: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No staff data for this period.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Stylist</th>
            <th className="px-3 py-2 font-medium">Avg hrs / week</th>
            <th className="px-3 py-2 font-medium">Avg takings / day</th>
            <th className="px-3 py-2 font-medium">Completed</th>
            <th className="px-3 py-2 font-medium">Total sales</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.memberId} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2">{row.avgWorkingHoursPerWeek.toFixed(1)}h</td>
              <td className="px-3 py-2">{formatMoneyMinor(row.avgServiceTakingsPerDayMinor)}</td>
              <td className="px-3 py-2">{row.completedAppointments}</td>
              <td className="px-3 py-2">{formatMoneyMinor(row.totalSalesMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted border-t border-border">
        Working hours from completed appointments; takings from Stripe ledger sales. Period: {periodLabel}.
      </p>
    </div>
  );
}
