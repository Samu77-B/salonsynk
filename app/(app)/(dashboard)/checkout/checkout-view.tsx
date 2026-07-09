"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StaffElevationModal } from "@/app/(app)/staff-elevation-modal";
import type { PaymentGatewayId } from "@/config/payment-gateways";
import { employmentTypeShortLabel } from "@/config/employment-types";
import { DashboardSection } from "@/components/dashboard/page-layout";
import {
  dashboardBtnPrimaryClass,
  dashboardInputClass,
  dashboardSectionClass,
  dashboardSelectClass,
  dashboardFlowClass,
  dashboardGrid2ColClass,
} from "@/components/dashboard/ui";
import { computeLoyaltyCheckoutTotals, maxRedeemableProductPoints } from "@/lib/loyalty/calculate";
import { DEFAULT_LOYALTY_SETTINGS, formatMoneyMinor, type LoyaltySettings } from "@/lib/loyalty/settings";

type Client = { id: string; name: string | null; email: string | null };
type Service = { id: string; name: string; duration_minutes: number; price_minor: number };
type Product = {
  id: string;
  name: string;
  price_minor: number;
  /** Empty = always suggested; otherwise only when overlapping services are on the bill */
  linkedServiceIds: string[];
};
type Stylist = { id: string; displayName: string; employmentType: string };

function productSuggestedForBill(p: Product, selectedServiceIds: string[]): boolean {
  if (p.linkedServiceIds.length === 0) return true;
  const sel = new Set(selectedServiceIds);
  return p.linkedServiceIds.some((id) => sel.has(id));
}

export function CheckoutView({
  salonId,
  clients,
  services,
  products,
  stylists,
  defaultStylistId,
  paymentGateway,
  paymentGatewayLabel,
  usesStripeCheckout,
  loyaltyEnabled = false,
  loyaltySettings = DEFAULT_LOYALTY_SETTINGS,
}: {
  salonId: string;
  clients: Client[];
  services: Service[];
  products: Product[];
  stylists: Stylist[];
  defaultStylistId: string;
  paymentGateway: PaymentGatewayId;
  paymentGatewayLabel: string;
  usesStripeCheckout: boolean;
  loyaltyEnabled?: boolean;
  loyaltySettings?: LoyaltySettings;
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
  const [terminalReference, setTerminalReference] = useState("");
  const [joinLoyalty, setJoinLoyalty] = useState(false);
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [redeemServicePoints, setRedeemServicePoints] = useState(0);
  const [redeemProductPoints, setRedeemProductPoints] = useState(0);
  const [loyaltyBalance, setLoyaltyBalance] = useState<{ servicePoints: number; productPoints: number } | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  /** Diary "Make Sale" passes ?clientId=&serviceId=&serviceIds=&stylistId=&walkInName= for walk-ins */
  useEffect(() => {
    if (appliedFromUrlRef.current) return;
    const cid = searchParams.get("clientId");
    const tid = searchParams.get("stylistId");
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

  useEffect(() => {
    setRedeemServicePoints(0);
    setRedeemProductPoints(0);
    if (!loyaltyEnabled || !clientId?.trim()) {
      setLoyaltyBalance(null);
      return;
    }
    let cancelled = false;
    setLoyaltyLoading(true);
    fetch(`/api/checkout/loyalty-balance?clientId=${encodeURIComponent(clientId)}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { enrolled?: boolean; servicePoints?: number; productPoints?: number }) => {
        if (cancelled) return;
        if (data.enrolled) {
          setLoyaltyBalance({
            servicePoints: data.servicePoints ?? 0,
            productPoints: data.productPoints ?? 0,
          });
        } else {
          setLoyaltyBalance({ servicePoints: 0, productPoints: 0 });
        }
        setLoyaltyLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoyaltyBalance(null);
          setLoyaltyLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, loyaltyEnabled]);

  const lineServicesMinor = selectedServiceIds.reduce((sum, id) => {
    const s = services.find((x) => x.id === id);
    return sum + (s?.price_minor ?? 0);
  }, 0);
  const lineProductsMinor = selectedProductIds.reduce((sum, id) => {
    const p = products.find((x) => x.id === id);
    return sum + (p?.price_minor ?? 0);
  }, 0);
  const lineTotalMinor = lineServicesMinor + lineProductsMinor;
  const loyaltyEligible = loyaltyEnabled && (Boolean(clientId) || joinLoyalty);
  const useCustomAmount = customAmountMinor != null && customAmountMinor >= 50;

  const loyaltyTotals = useMemo(() => {
    if (!loyaltyEligible || useCustomAmount) return null;
    const balances = loyaltyBalance ?? { servicePoints: 0, productPoints: 0 };
    return computeLoyaltyCheckoutTotals(
      loyaltySettings,
      balances,
      lineServicesMinor,
      lineProductsMinor,
      { redeemServicePoints, redeemProductPoints }
    );
  }, [
    loyaltyEligible,
    useCustomAmount,
    loyaltyBalance,
    loyaltySettings,
    lineServicesMinor,
    lineProductsMinor,
    redeemServicePoints,
    redeemProductPoints,
  ]);

  const totalMinor = useCustomAmount
    ? customAmountMinor!
    : loyaltyTotals?.totals.totalMinor ?? lineTotalMinor;
  const loyaltyDiscountMinor = loyaltyTotals
    ? loyaltyTotals.totals.serviceDiscountMinor + loyaltyTotals.totals.productDiscountMinor
    : 0;

  const extraServiceMatches = useMemo(() => {
    const q = extraSearch.trim().toLowerCase();
    if (q.length < 1) return [];
    return services
      .filter((s) => !selectedServiceIds.includes(s.id) && (s.name ?? "").toLowerCase().includes(q))
      .slice(0, 16);
  }, [extraSearch, services, selectedServiceIds]);

  const { suggestedProducts, otherProducts } = useMemo(() => {
    const suggested: Product[] = [];
    const other: Product[] = [];
    for (const p of products) {
      if (productSuggestedForBill(p, selectedServiceIds)) suggested.push(p);
      else other.push(p);
    }
    return { suggestedProducts: suggested, otherProducts: other };
  }, [products, selectedServiceIds]);

  const bookNextHref =
    clientId && stylistId
      ? `/dashboard?addAppointmentClient=${encodeURIComponent(clientId)}&prefillStylist=${encodeURIComponent(stylistId)}`
      : null;

  async function handlePay() {
    if (!cancellationPolicyAccepted) {
      setError("Please accept the cancellation policy to proceed.");
      return;
    }
    if (loyaltyTotals?.error) {
      setError(loyaltyTotals.error);
      return;
    }
    if (joinLoyalty && !clientId) {
      if (!walkInName.trim()) {
        setError("Walk-in name is required to join the loyalty programme.");
        return;
      }
      if (!walkInEmail.trim() && !walkInPhone.trim()) {
        setError("Phone or email is required to join the loyalty programme.");
        return;
      }
    }
    if (totalMinor < 50) {
      setError("Minimum amount is £0.50");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload = {
        salonId,
        clientId: clientId || undefined,
        stylistId: stylistId || undefined,
        silentAppointment: silentAppointment || undefined,
        serviceIds: selectedServiceIds,
        productIds: selectedProductIds,
        customAmountMinor: customAmountMinor != null ? customAmountMinor : null,
        redeemServicePoints: loyaltyTotals?.totals.redeemServicePoints ?? 0,
        redeemProductPoints: loyaltyTotals?.totals.redeemProductPoints ?? 0,
        joinLoyalty: joinLoyalty || undefined,
        walkInName: walkInName.trim() || undefined,
        walkInEmail: walkInEmail.trim() || undefined,
        walkInPhone: walkInPhone.trim() || undefined,
      };

      if (usesStripeCheckout) {
        const res = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
        if (data.clientId && typeof data.clientId === "string") {
          setClientId(data.clientId);
        }
        setDone(true);
      } else {
        const res = await fetch("/api/checkout/record-external-sale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            terminalReference: terminalReference.trim() || undefined,
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
        if (data.clientId && typeof data.clientId === "string") {
          setClientId(data.clientId);
        }
        setDone(true);
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="text-green-400">
          {usesStripeCheckout
            ? "Payment intent created. In production you would embed Stripe Elements here and confirm with clientSecret."
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
    <div className={`${dashboardFlowClass} space-y-4`}>
      {!usesStripeCheckout && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <strong>{paymentGatewayLabel}</strong> — take payment on your existing card terminal, then record
          the sale here for reporting.
        </div>
      )}
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

      <div className={dashboardGrid2ColClass}>
        <div className="space-y-4">
      <DashboardSection title="Who & what">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Stylist</label>
            <select
              value={stylistId}
              onChange={(e) => {
                setStylistId(e.target.value);
                setSelectedServiceIds([]);
              }}
              className={dashboardSelectClass}
              aria-label="Stylist"
            >
              {stylists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({employmentTypeShortLabel(s.employmentType)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Client</label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSelectedServiceIds([]);
              }}
              className={dashboardSelectClass}
              aria-label="Client"
            >
              <option value="">Walk-in</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.email}</option>
              ))}
            </select>
          </div>
        </div>
        {!clientId && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Walk-in name</label>
              <input
                type="text"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                className={dashboardInputClass}
                aria-label="Walk-in name"
              />
            </div>
            {loyaltyEnabled && (
              <>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={joinLoyalty}
                    onChange={(e) => setJoinLoyalty(e.target.checked)}
                    className="mt-1 rounded border-border"
                  />
                  <span className="text-sm">
                    Join loyalty programme — earn points on this visit (requires phone or email).
                  </span>
                </label>
                {joinLoyalty && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Phone</label>
                      <input
                        type="tel"
                        value={walkInPhone}
                        onChange={(e) => setWalkInPhone(e.target.value)}
                        className={dashboardInputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Email</label>
                      <input
                        type="email"
                        value={walkInEmail}
                        onChange={(e) => setWalkInEmail(e.target.value)}
                        className={dashboardInputClass}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DashboardSection>

      <div className={`${dashboardSectionClass} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Services on this bill</h2>
          {visitLoading ? (
            <span className="text-xs text-muted">Checking diary…</span>
          ) : visitServiceIds.length > 0 ? (
            <span className="text-xs text-muted">Prefilled from diary visit</span>
          ) : clientId ? (
            <span className="text-xs text-muted">Pick services below or search to add</span>
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
        </div>

        <div className="space-y-4 lg:sticky lg:top-4">
      <DashboardSection title="Payment">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Products</label>
        {products.length === 0 ? (
          <p className="text-sm text-muted">No active products. Add some under Products.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              {selectedServiceIds.length > 0
                ? "Suggested items include universal products and anything linked to a service on this bill."
                : "Link products to services on the Products page to keep this list focused; until those services are on the bill, linked-only items appear under Other retail."}
            </p>
            {suggestedProducts.length > 0 ? (
              <div className="space-y-1 mb-3">
                {selectedServiceIds.length > 0 && otherProducts.length > 0 ? (
                  <p className="text-xs font-medium text-foreground">Suggested for this bill</p>
                ) : null}
                {suggestedProducts.map((p) => (
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
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-2">No products match this bill yet — add services above or open Other retail.</p>
            )}
            {otherProducts.length > 0 ? (
              <details className="rounded-lg border border-border bg-muted/10">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                  Other retail ({otherProducts.length})
                </summary>
                <div className="border-t border-border px-3 py-2 space-y-1">
                  {otherProducts.map((p) => (
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
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Custom amount (pence) or leave blank</label>
        <input
          type="number"
          min={0}
          value={customAmountMinor ?? ""}
          onChange={(e) => setCustomAmountMinor(e.target.value ? Number(e.target.value) : null)}
          placeholder="Override total"
          className={dashboardInputClass}
        />
      </div>
      <p className="text-lg font-semibold">Total: £{(totalMinor / 100).toFixed(2)}</p>
      {loyaltyDiscountMinor > 0 && (
        <p className="text-sm text-accent">
          Loyalty discount: −{formatMoneyMinor(loyaltyDiscountMinor)}
        </p>
      )}
      {loyaltyEnabled && clientId && (
        <div className="rounded-lg border border-border bg-background/50 p-3 space-y-3">
          <p className="text-sm font-medium">Loyalty points</p>
          {loyaltyLoading ? (
            <p className="text-xs text-muted">Loading balance…</p>
          ) : (
            <p className="text-xs text-muted">
              Balance: {loyaltyBalance?.servicePoints ?? 0} service pts · {loyaltyBalance?.productPoints ?? 0} product pts
              {" "}(1 pt = {formatMoneyMinor(loyaltySettings.servicePointValueMinor)} off services;{" "}
              {loyaltySettings.productPointsPerBlock} pts = {formatMoneyMinor(loyaltySettings.productBlockValueMinor)} off products)
            </p>
          )}
          {!useCustomAmount && lineServicesMinor > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium">Redeem service points</label>
              <input
                type="number"
                min={0}
                max={loyaltyBalance?.servicePoints ?? 0}
                value={redeemServicePoints}
                onChange={(e) => setRedeemServicePoints(Math.max(0, Number(e.target.value) || 0))}
                className={dashboardInputClass}
              />
            </div>
          )}
          {!useCustomAmount && lineProductsMinor > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium">Redeem product points</label>
              <input
                type="number"
                min={0}
                max={maxRedeemableProductPoints(
                  loyaltyBalance ?? { servicePoints: 0, productPoints: 0 },
                  loyaltySettings
                )}
                step={loyaltySettings.productPointsPerBlock}
                value={redeemProductPoints}
                onChange={(e) => setRedeemProductPoints(Math.max(0, Number(e.target.value) || 0))}
                className={dashboardInputClass}
              />
            </div>
          )}
          {loyaltyTotals?.error && <p className="text-xs text-red-400">{loyaltyTotals.error}</p>}
        </div>
      )}
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
            className={dashboardInputClass}
          />
        </div>
      )}
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className={`${dashboardBtnPrimaryClass} w-full sm:w-auto`}
      >
        {loading
          ? "Processing…"
          : usesStripeCheckout
            ? "Pay with card (Stripe)"
            : `Record sale (${paymentGatewayLabel})`}
      </button>
      </DashboardSection>
        </div>
      </div>
    </div>
  );
}
