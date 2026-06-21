"use client";

import { formatMoneyMinor } from "@/lib/appointment-billing";

export function ClientBillingSummary({
  totalDepositsMinor,
  totalPaidMinor,
  balanceDueMinor,
}: {
  totalDepositsMinor: number;
  totalPaidMinor: number;
  balanceDueMinor: number;
}) {
  return (
    <section className="rounded-lg border border-border p-4 mb-6 space-y-3">
      <h2 className="text-lg font-semibold">Account balance</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-white/5 px-3 py-2">
          <p className="text-xs text-muted">Total deposits paid</p>
          <p className="text-lg font-semibold">{formatMoneyMinor(totalDepositsMinor)}</p>
        </div>
        <div className="rounded-md bg-white/5 px-3 py-2">
          <p className="text-xs text-muted">Total paid (checkout)</p>
          <p className="text-lg font-semibold">{formatMoneyMinor(totalPaidMinor)}</p>
        </div>
        <div className="rounded-md bg-white/5 px-3 py-2">
          <p className="text-xs text-muted">Remaining balance due</p>
          <p className={`text-lg font-semibold ${balanceDueMinor > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
            {formatMoneyMinor(balanceDueMinor)}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted">
        Balance due is based on scheduled appointment totals minus deposits recorded and completed checkout payments.
      </p>
    </section>
  );
}
