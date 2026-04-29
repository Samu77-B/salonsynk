"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StaffElevationModal } from "@/app/(app)/staff-elevation-modal";

type Client = { id: string; name: string | null; email: string | null };
type Service = { id: string; name: string; duration_minutes: number; price_minor: number };
type Product = { id: string; name: string; price_minor: number };
type Stylist = { id: string; displayName: string; employmentType: string };

export function CheckoutView({
  salonId,
  clients,
  services,
  products,
  stylists,
  defaultStylistId,
}: {
  salonId: string;
  clients: Client[];
  services: Service[];
  products: Product[];
  stylists: Stylist[];
  defaultStylistId: string;
}) {
  const searchParams = useSearchParams();
  const appliedFromUrlRef = useRef(false);

  const [clientId, setClientId] = useState("");
  const [stylistId, setStylistId] = useState((defaultStylistId || stylists[0]?.id) ?? "");
  const [walkInName, setWalkInName] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [customAmountMinor, setCustomAmountMinor] = useState<number | null>(null);
  const [silentAppointment, setSilentAppointment] = useState(false);
  const [cancellationPolicyAccepted, setCancellationPolicyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [elevateOpen, setElevateOpen] = useState(false);
  const [pendingPay, setPendingPay] = useState(false);
  const [visitServiceIds, setVisitServiceIds] = useState<string[]>([]);
  const [visitLoading, setVisitLoading] = useState(false);
  const [extraSearch, setExtraSearch] = useState("");
  const [extraOpen, setExtraOpen] = useState(false);
  const extraBlurTimer = useRef<number | null>(null);

  /** Diary "Make Sale" passes ?clientId=&serviceId=&serviceIds=&stylistId= */
  useEffect(() => {
    if (appliedFromUrlRef.current) return;
    const cid = searchParams.get("clientId");
    const tid = searchParams.get("stylistId");
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
    if (tid && stylists.some((s) => s.id === tid)) {
      setStylistId(tid);
      applied = true;
    }
    if (validSvc.length > 0) {
      setSelectedServiceIds(validSvc);
      applied = true;
    }
    if (applied) appliedFromUrlRef.current = true;
  }, [searchParams, clients, services, stylists]);

  useEffect(() => {
    if (!clientId?.trim() || !stylistId?.trim()) {
      setVisitServiceIds([]);
      setVisitLoading(false);
      return;
    }
    let cancelled = false;
    setVisitLoading(true);
    const q = `/api/checkout/relevant-visit?clientId=${encodeURIComponent(clientId)}&stylistId=${encodeURIComponent(stylistId)}`;
    fetch(q, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { serviceIds?: unknown }) => {
        if (cancelled) return;
        const ids = Array.isArray(data.serviceIds) ? data.serviceIds.filter((x): x is string => typeof x === "string") : [];
        setVisitServiceIds(ids);
        setSelectedServiceIds((prev) => (prev.length > 0 ? prev : ids));
        setVisitLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setVisitServiceIds([]);
          setVisitLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, stylistId]);

  const lineServicesMinor = selectedServiceIds.reduce((sum, id) => {
    const s = services.find((x) => x.id === id);
    return sum + (s?.price_minor ?? 0);
  }, 0);
  const lineProductsMinor = selectedProductIds.reduce((sum, id) => {
    const p = products.find((x) => x.id === id);
    return sum + (p?.price_minor ?? 0);
  }, 0);
  const lineTotalMinor = lineServicesMinor + lineProductsMinor;
  const totalMinor = customAmountMinor ?? lineTotalMinor;

  const extraServiceMatches = useMemo(() => {
    const q = extraSearch.trim().toLowerCase();
    if (q.length < 1) return [];
    return services
      .filter((s) => !selectedServiceIds.includes(s.id) && (s.name ?? "").toLowerCase().includes(q))
      .slice(0, 16);
  }, [extraSearch, services, selectedServiceIds]);

  const bookNextHref =
    clientId && stylistId
      ? `/dashboard?addAppointmentClient=${encodeURIComponent(clientId)}&prefillStylist=${encodeURIComponent(stylistId)}`
      : null;

  async function handlePay() {
    if (!cancellationPolicyAccepted) {
      setError("Please accept the cancellation policy to proceed.");
      return;
    }
    if (totalMinor < 50) {
      setError("Minimum amount is £0.50");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonId,
          clientId: clientId || undefined,
          stylistId: stylistId || undefined,
          silentAppointment: silentAppointment || undefined,
          serviceIds: selectedServiceIds,
          productIds: selectedProductIds,
          customAmountMinor: customAmountMinor != null ? customAmountMinor : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "PIN_REQUIRED") {
          setPendingPay(true);
          setElevateOpen(true);
          setLoading(false);
          return;
        }
        setError(data.error ?? "Failed");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <p className="text-green-400">
        Payment intent created. In production you would embed Stripe Elements here and confirm with clientSecret.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <StaffElevationModal
        open={elevateOpen}
        onClose={() => { setElevateOpen(false); setPendingPay(false); }}
        onSuccess={() => {
          setElevateOpen(false);
          if (pendingPay) {
            setPendingPay(false);
            void handlePay();
          }
        }}
        title="Staff verification"
        subtitle="To take payment, select your name and enter your PIN."
      />
      <div>
        <label className="block text-sm font-medium mb-1">Stylist</label>
        <select
          value={stylistId}
          onChange={(e) => {
            setStylistId(e.target.value);
            setSelectedServiceIds([]);
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          aria-label="Stylist"
        >
          {stylists.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName} ({s.employmentType === "RENTER" ? "Renter" : "Employee"})
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
            <option key={c.id} value={c.id}>{c.name || c.email}</option>
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
            <p className="text-sm text-muted-foreground">No services added yet — use the search box to add what was done today.</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedServiceIds.map((sid) => {
                const s = services.find((x) => x.id === sid);
                if (!s) {
                  return (
                    <li key={sid} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                      <span className="text-muted-foreground">Unknown service (remove via ×)</span>
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
          <label className="block text-sm font-medium mb-1" htmlFor="checkout-extra-service">
            Add another service
          </label>
          <p className="text-xs text-muted-foreground mb-2">Type part of the name — tint, toner, upgrades, extras.</p>
          <input
            id="checkout-extra-service"
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
          <p className="text-xs text-muted-foreground leading-snug">
            After payment, open the diary with this client and stylist chosen so you can drop their next appointment without searching again.
          </p>
          <Link
            href={bookNextHref}
            className="inline-flex text-sm font-medium text-accent hover:underline"
          >
            Open diary → add appointment for this client
          </Link>
        </div>
      ) : null}
      <div>
        <label className="block text-sm font-medium mb-1">Products</label>
        {products.length === 0 ? (
          <p className="text-sm text-muted">No active products. Add some under Products.</p>
        ) : (
          products.map((p) => (
            <label key={p.id} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={selectedProductIds.includes(p.id)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedProductIds((x) => [...x, p.id]);
                  else setSelectedProductIds((x) => x.filter((id) => id !== p.id));
                }}
              />
              <span>{p.name}</span>
              <span className="text-muted">£{((p.price_minor ?? 0) / 100).toFixed(2)}</span>
            </label>
          ))
        )}
      </div>
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
      <label className="flex items-center gap-2 py-2 cursor-pointer">
        <input
          type="checkbox"
          checked={cancellationPolicyAccepted}
          onChange={(e) => setCancellationPolicyAccepted(e.target.checked)}
          className="rounded border-border bg-background"
          aria-label="Accept cancellation policy"
        />
        <span className="text-sm font-medium">I agree to the cancellation policy (deposits may be charged for no-shows or late cancellations).</span>
      </label>
      <label className="flex items-center gap-2 py-2 cursor-pointer">
        <input
          type="checkbox"
          checked={silentAppointment}
          onChange={(e) => setSilentAppointment(e.target.checked)}
          className="rounded border-border bg-background"
          aria-label="Silent Appointment"
        />
        <span className="text-sm font-medium">Silent Appointment</span>
      </label>
      <p className="text-xs text-muted-foreground -mt-2">
        Check this for a quiet session with no small talk.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Processing…" : "Pay"}
      </button>
    </div>
  );
}
