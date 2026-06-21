"use client";

import { useMemo } from "react";
import {
  computeBillSubtotalMinor,
  computeBillTotalMinor,
  formatMoneyMinor,
  linePriceMinor,
  parsePoundsToMinor,
  type ServiceLineBillInput,
} from "@/lib/appointment-billing";

type Member = { id: string; display_name: string | null; role: string };
type Service = { id: string; name: string; price_minor?: number | null };

export type BillLineState = {
  serviceId: string;
  priceOverridePounds: string;
  assignedStylistId: string;
};

export function AppointmentBillSummary({
  members,
  services,
  selectedServiceIds,
  billLines,
  onBillLinesChange,
  billTotalOverridePounds,
  onBillTotalOverrideChange,
  depositPounds,
  onDepositChange,
  changeChargeMinor,
}: {
  members: Member[];
  services: Service[];
  selectedServiceIds: string[];
  billLines: BillLineState[];
  onBillLinesChange: (lines: BillLineState[]) => void;
  billTotalOverridePounds: string;
  onBillTotalOverrideChange: (value: string) => void;
  depositPounds: string;
  onDepositChange: (value: string) => void;
  changeChargeMinor?: number | null;
}) {
  const serviceById = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services]);

  const lineInputs: ServiceLineBillInput[] = useMemo(() => {
    return selectedServiceIds.map((serviceId) => {
      const svc = serviceById[serviceId];
      const line = billLines.find((l) => l.serviceId === serviceId);
      const overrideMinor = line?.priceOverridePounds.trim()
        ? parsePoundsToMinor(line.priceOverridePounds)
        : null;
      const assigned = members.find((m) => m.id === line?.assignedStylistId);
      return {
        serviceId,
        serviceName: svc?.name ?? "Service",
        catalogPriceMinor: Number(svc?.price_minor ?? 0),
        priceOverrideMinor: overrideMinor,
        assignedStylistId: line?.assignedStylistId || null,
        assignedStylistName: assigned?.display_name || assigned?.role || null,
      };
    });
  }, [selectedServiceIds, serviceById, billLines, members]);

  const subtotalMinor = computeBillSubtotalMinor(lineInputs);
  const billOverrideMinor = billTotalOverridePounds.trim() ? parsePoundsToMinor(billTotalOverridePounds) : null;
  const totalMinor = computeBillTotalMinor(lineInputs, billOverrideMinor, changeChargeMinor ?? null);

  function syncLine(serviceId: string, patch: Partial<BillLineState>) {
    const existing = billLines.find((l) => l.serviceId === serviceId);
    const next = existing
      ? billLines.map((l) => (l.serviceId === serviceId ? { ...l, ...patch } : l))
      : [...billLines, { serviceId, priceOverridePounds: "", assignedStylistId: "", ...patch }];
    onBillLinesChange(next);
  }

  return (
    <section className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Appointment summary &amp; bill</h3>
        <p className="text-xs text-muted mt-0.5">
          Override line prices or assign a stylist per service (e.g. colorist). Set a total override for the final bill.
        </p>
      </div>

      {selectedServiceIds.length === 0 ? (
        <p className="text-xs text-muted">Add services above to build the bill.</p>
      ) : (
        <ul className="space-y-2">
          {selectedServiceIds.map((serviceId) => {
            const svc = serviceById[serviceId];
            const line = billLines.find((l) => l.serviceId === serviceId);
            const catalogMinor = Number(svc?.price_minor ?? 0);
            return (
              <li key={serviceId} className="rounded-md border border-border bg-background/60 p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{svc?.name ?? "Service"}</span>
                  <span className="text-xs text-muted">List: {formatMoneyMinor(catalogMinor)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-muted mb-1">Price override (£)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Optional"
                      value={line?.priceOverridePounds ?? ""}
                      onChange={(e) => syncLine(serviceId, { priceOverridePounds: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted mb-1">Assigned stylist</label>
                    <select
                      value={line?.assignedStylistId ?? ""}
                      onChange={(e) => syncLine(serviceId, { assignedStylistId: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="">Same as appointment</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.display_name || m.role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted">
                  Line total:{" "}
                  {formatMoneyMinor(
                    linePriceMinor({
                      serviceId,
                      serviceName: svc?.name ?? "",
                      catalogPriceMinor: catalogMinor,
                      priceOverrideMinor: line?.priceOverridePounds.trim()
                        ? parsePoundsToMinor(line.priceOverridePounds)
                        : null,
                    })
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Bill total override (£)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Optional — replaces line sum"
            value={billTotalOverridePounds}
            onChange={(e) => onBillTotalOverrideChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Deposit paid (£)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={depositPounds}
            onChange={(e) => onDepositChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm">
        <span className="text-muted">Subtotal</span>
        <span>{formatMoneyMinor(subtotalMinor)}</span>
        <span className="text-muted font-medium">Bill total</span>
        <span className="font-semibold">{formatMoneyMinor(totalMinor)}</span>
      </div>
    </section>
  );
}

export function billLinesToPatchPayload(lines: BillLineState[]) {
  return lines.map((line) => ({
    serviceId: line.serviceId,
    priceOverrideMinor: line.priceOverridePounds.trim() ? parsePoundsToMinor(line.priceOverridePounds) : null,
    assignedStylistId: line.assignedStylistId || null,
  }));
}
