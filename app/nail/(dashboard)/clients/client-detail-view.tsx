"use client";

import { useState } from "react";
import { updateNailClientAction } from "./actions";

type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  serviceLabel: string;
};

export type NailClientSaleRow = {
  paidAt: string;
  amountMinor: number;
  serviceLabels: string[];
};

export function NailClientDetailView({
  clientId,
  appointments,
  sales,
  onPatchTestDueAt,
  onLastSkinTestAt,
}: {
  clientId: string;
  appointments: Appointment[];
  sales: NailClientSaleRow[];
  onPatchTestDueAt: string | null;
  onLastSkinTestAt: string | null;
}) {
  const [patchDate, setPatchDate] = useState(onPatchTestDueAt?.slice(0, 10) ?? "");
  const [lastSkinTestDate, setLastSkinTestDate] = useState(onLastSkinTestAt?.slice(0, 10) ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSavePatchTest() {
    setError(null);
    setLoading(true);
    const result = await updateNailClientAction(clientId, {
      patch_test_due_at: patchDate ? `${patchDate}T12:00:00` : null,
    });
    setLoading(false);
    if (result.error) setError(result.error);
  }

  async function handleSaveSkinTest() {
    setError(null);
    setLoading(true);
    const result = await updateNailClientAction(clientId, {
      last_skin_test_at: lastSkinTestDate ? `${lastSkinTestDate}T12:00:00` : null,
    });
    setLoading(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-2">Skin &amp; Patch Testing</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Last skin test date</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 sm:items-center">
              <input
                type="date"
                value={lastSkinTestDate}
                onChange={(e) => setLastSkinTestDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSaveSkinTest}
                disabled={loading}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Save
              </button>
            </div>
            {lastSkinTestDate && (() => {
              const testDate = new Date(lastSkinTestDate);
              const monthsSince = Math.floor(
                (Date.now() - testDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
              );
              if (monthsSince >= 12) {
                return (
                  <p className="text-xs text-red-400 mt-1">
                    Skin test expired — over 12 months ago ({monthsSince} months)
                  </p>
                );
              }
              if (monthsSince >= 10) {
                return (
                  <p className="text-xs text-amber-400 mt-1">
                    Skin test expires soon ({12 - monthsSince} months remaining)
                  </p>
                );
              }
              return (
                <p className="text-xs text-green-400 mt-1">
                  Skin test valid ({12 - monthsSince} months remaining)
                </p>
              );
            })()}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Patch test due date</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 sm:items-center">
              <input
                type="date"
                value={patchDate}
                onChange={(e) => setPatchDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSavePatchTest}
                disabled={loading}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Purchase history</h2>
        <p className="text-xs text-muted mb-2">Checkout payments linked to this client.</p>
        {sales.length === 0 ? (
          <p className="text-sm text-muted">No recorded sales yet.</p>
        ) : (
          <ul className="space-y-2">
            {sales.map((s, idx) => (
              <li key={`${s.paidAt}-${idx}`} className="rounded-lg border border-border px-4 py-2 text-sm space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>{new Date(s.paidAt).toLocaleString("en-GB")}</span>
                  <span className="font-medium">£{(s.amountMinor / 100).toFixed(2)}</span>
                </div>
                {s.serviceLabels.length > 0 ? (
                  <p className="text-muted text-xs">
                    <span className="text-foreground/80">Services:</span> {s.serviceLabels.join(", ")}
                  </p>
                ) : (
                  <p className="text-muted text-xs">Custom or unitemised payment</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Appointment history</h2>
        <ul className="space-y-2">
          {appointments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap gap-x-2 gap-y-1 justify-between rounded-lg border border-border px-4 py-2 text-sm min-w-0"
            >
              <span className="shrink-0">{new Date(a.start_time).toLocaleString("en-GB")}</span>
              <span className="text-muted truncate">{a.serviceLabel}</span>
              <span className="capitalize shrink-0">{a.status}</span>
            </li>
          ))}
        </ul>
        {appointments.length === 0 && <p className="text-muted text-sm">No appointments yet.</p>}
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
