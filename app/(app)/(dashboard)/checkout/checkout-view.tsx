"use client";

import { useState } from "react";

type Client = { id: string; name: string | null; email: string | null };
type Service = { id: string; name: string; duration_minutes: number; price_minor: number };

export function CheckoutView({
  salonId,
  clients,
  services,
}: {
  salonId: string;
  clients: Client[];
  services: Service[];
}) {
  const [clientId, setClientId] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [customAmountMinor, setCustomAmountMinor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const totalMinor = customAmountMinor ?? selectedServiceIds.reduce((sum, id) => {
    const s = services.find((x) => x.id === id);
    return sum + (s?.price_minor ?? 0);
  }, 0);

  async function handlePay() {
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
          amountMinor: totalMinor,
          clientId: clientId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
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
      <div>
        <label className="block text-sm font-medium mb-1">Client</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">Services</label>
        {services.map((s) => (
          <label key={s.id} className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              checked={selectedServiceIds.includes(s.id)}
              onChange={(e) => {
                if (e.target.checked) setSelectedServiceIds((x) => [...x, s.id]);
                else setSelectedServiceIds((x) => x.filter((id) => id !== s.id));
              }}
            />
            <span>{s.name}</span>
            <span className="text-muted">£{((s.price_minor ?? 0) / 100).toFixed(2)}</span>
          </label>
        ))}
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
