"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PaymentGatewayId } from "@core/config/payment-gateways";
import { employmentTypeShortLabel } from "@/config/employment-types";
import { getRelevantNailVisitServices, recordNailCheckoutSale } from "./actions";

type Client = { id: string; name: string | null; email: string | null };
type Service = { id: string; name: string; duration_minutes: number; price_minor: number };
type Technician = { id: string; displayName: string; employmentType: string };

export function NailCheckoutView({
  salonId,
  clients,
  services,
  technicians,
  defaultTechnicianId,
  paymentGateway,
  paymentGatewayLabel,
  usesStripeCheckout,
}: {
  salonId: string;
  clients: Client[];
  services: Service[];
  technicians: Technician[];
  defaultTechnicianId: string;
  paymentGateway: PaymentGatewayId;
  paymentGatewayLabel: string;
  usesStripeCheckout: boolean;
}) {
  const searchParams = useSearchParams();
  const appliedFromUrlRef = useRef(false);

  const [clientId, setClientId] = useState("");
  const [technicianId, setTechnicianId] = useState((defaultTechnicianId || technicians[0]?.id) ?? "");
  const [walkInName, setWalkInName] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [customAmountMinor, setCustomAmountMinor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [visitServiceIds, setVisitServiceIds] = useState<string[]>([]);
  const [visitLoading, setVisitLoading] = useState(false);
  const [extraSearch, setExtraSearch] = useState("");
  const [extraOpen, setExtraOpen] = useState(false);
  const extraBlurTimer = useRef<number | null>(null);
  const [terminalReference, setTerminalReference] = useState("");

  useEffect(() => {
    if (appliedFromUrlRef.current) return;
    const cid = searchParams.get("clientId");
    const tid = searchParams.get("technicianId") ?? searchParams.get("stylistId");
    const walkInFromUrl = searchParams.get("walkInName")?.trim() ?? "";
    const singleSvc = searchParams.get("serviceId");
    const multiSvc = searchParams.get("serviceIds");
    let serviceIds: string[] = [];
    if (multiSvc) serviceIds = multiSvc.split(",").map((s) => s.trim()).filter(Boolean);
    else if (singleSvc) serviceIds = [singleSvc];

    const validSvc = serviceIds.filter((id) => services.some((s) => s.id === id));

    let applied = false;
    if (cid && clients.some((c) => c.id === cid)) {
      setClientId(cid);
      applied = true;
    }
    if (!cid && walkInFromUrl.length > 0) {
      setWalkInName(walkInFromUrl.slice(0, 160));
      applied = true;
    }
    if (tid && technicians.some((t) => t.id === tid)) {
      setTechnicianId(tid);
      applied = true;
    }
    if (validSvc.length > 0) {
      setSelectedServiceIds(validSvc);
      applied = true;
    }
    if (applied) appliedFromUrlRef.current = true;
  }, [searchParams, clients, services, technicians]);

  useEffect(() => {
    if (!clientId?.trim() || !technicianId?.trim()) {
      setVisitServiceIds([]);
      setVisitLoading(false);
      return;
    }
    let cancelled = false;
    setVisitLoading(true);
    void getRelevantNailVisitServices(clientId, technicianId).then((data) => {
      if (cancelled) return;
      const ids = data.serviceIds ?? [];
      setVisitServiceIds(ids);
      setSelectedServiceIds((prev) => (prev.length > 0 ? prev : ids));
      setVisitLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, technicianId]);

  const lineTotalMinor = selectedServiceIds.reduce((sum, id) => {
    const s = services.find((x) => x.id === id);
    return sum + (s?.price_minor ?? 0);
  }, 0);
  const totalMinor = customAmountMinor ?? lineTotalMinor;

  const extraServiceMatches = useMemo(() => {
    const q = extraSearch.trim().toLowerCase();
    if (q.length < 1) return [];
    return services
      .filter((s) => !selectedServiceIds.includes(s.id) && (s.name ?? "").toLowerCase().includes(q))
      .slice(0, 16);
  }, [extraSearch, services, selectedServiceIds]);

  const bookNextHref =
    clientId && technicianId
      ? `/nail/diary?addAppointmentClient=${encodeURIComponent(clientId)}&prefillTechnician=${encodeURIComponent(technicianId)}`
      : null;

  async function handlePay() {
    if (totalMinor < 50) {
      setError("Minimum amount is £0.50");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await recordNailCheckoutSale({
        salonId,
        clientId: clientId || undefined,
        technicianId: technicianId || undefined,
        serviceIds: selectedServiceIds,
        customAmountMinor: customAmountMinor != null ? customAmountMinor : null,
        terminalReference: terminalReference.trim() || undefined,
      });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="text-green-400">
          {usesStripeCheckout
            ? "Sale recorded. Connect Stripe in settings for in-app card capture."
            : `Sale recorded. Payment was taken on your ${paymentGatewayLabel} terminal.`}
        </p>
        {bookNextHref && (
          <Link href={bookNextHref} className="text-sm text-accent hover:underline">
            Book next appointment
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!usesStripeCheckout && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <strong>{paymentGatewayLabel}</strong> — take payment on your existing card terminal, then record the sale
          here for reporting.
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">Technician</label>
        <select
          value={technicianId}
          onChange={(e) => {
            setTechnicianId(e.target.value);
            setSelectedServiceIds([]);
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          aria-label="Technician"
        >
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName} ({employmentTypeShortLabel(t.employmentType)})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Client</label>
        <select
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setSelectedServiceIds([]);
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          aria-label="Client"
        >
          <option value="">Walk-in</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || c.email}
            </option>
          ))}
        </select>
      </div>
      {!clientId && (
        <div>
          <label className="block text-sm font-medium mb-1">Walk-in name</label>
          <input
            type="text"
            value={walkInName}
            onChange={(e) => setWalkInName(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="Walk-in name"
          />
        </div>
      )}
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="block text-sm font-medium">Services on this bill</label>
            {visitLoading ? (
              <span className="text-xs text-muted-foreground">Checking diary…</span>
            ) : visitServiceIds.length > 0 ? (
              <span className="text-xs text-muted-foreground">Prefilled from diary visit</span>
            ) : clientId ? (
              <span className="text-xs text-muted-foreground">Pick services below or search to add</span>
            ) : null}
          </div>
          {selectedServiceIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No services added yet — use the search box to add treatments.</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedServiceIds.map((sid) => {
                const s = services.find((x) => x.id === sid);
                if (!s) {
                  return (
                    <li key={sid} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                      <span className="text-muted-foreground">Unknown service</span>
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:underline"
                        onClick={() => setSelectedServiceIds((xs) => xs.filter((id) => id !== sid))}
                      >
                        Remove
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={sid}>
                    <label className="flex items-start gap-2 rounded-md border border-border bg-background px-2 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0 rounded border-border"
                        checked
                        onChange={() => setSelectedServiceIds((xs) => xs.filter((id) => id !== sid))}
                        aria-label={`Remove ${s.name} from bill`}
                      />
                      <span className="flex flex-1 min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
                        <span className="font-medium text-foreground">{s.name}</span>
                        <span className="text-muted-foreground text-sm">£{((s.price_minor ?? 0) / 100).toFixed(2)}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="relative z-20">
          <label className="block text-sm font-medium mb-1" htmlFor="nail-checkout-extra-service">
            Add another service
          </label>
          <input
            id="nail-checkout-extra-service"
            type="search"
            autoComplete="off"
            placeholder="Search services…"
            value={extraSearch}
            onChange={(e) => {
              setExtraSearch(e.target.value);
              setExtraOpen(true);
            }}
            onFocus={() => setExtraOpen(true)}
            onBlur={() => {
              const tid = window.setTimeout(() => setExtraOpen(false), 175);
              extraBlurTimer.current = tid as unknown as number;
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          {extraOpen && extraServiceMatches.length > 0 ? (
            <ul className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-background py-1 shadow-lg z-30">
              {extraServiceMatches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (extraBlurTimer.current) clearTimeout(extraBlurTimer.current);
                      setSelectedServiceIds((xs) => (xs.includes(s.id) ? xs : [...xs, s.id]));
                      setExtraSearch("");
                      setExtraOpen(false);
                    }}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-2 text-muted-foreground">£{((s.price_minor ?? 0) / 100).toFixed(2)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {bookNextHref ? (
        <div className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-foreground">Book next visit</p>
          <Link href={bookNextHref} className="inline-flex text-sm font-medium text-accent hover:underline">
            Open diary → add appointment for this client
          </Link>
        </div>
      ) : null}
      <div>
        <label className="block text-sm font-medium mb-1">Custom amount (pence) or leave blank</label>
        <input
          type="number"
          min={0}
          value={customAmountMinor ?? ""}
          onChange={(e) => setCustomAmountMinor(e.target.value ? Number(e.target.value) : null)}
          placeholder="Override total"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <p className="font-medium">Total: £{(totalMinor / 100).toFixed(2)}</p>
      {!usesStripeCheckout && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Terminal reference <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={terminalReference}
            onChange={(e) => setTerminalReference(e.target.value)}
            placeholder="e.g. last 4 digits or receipt #"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading
          ? "Processing…"
          : usesStripeCheckout
            ? "Record sale"
            : `Record sale (${paymentGatewayLabel})`}
      </button>
    </div>
  );
}
