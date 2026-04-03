"use client";

import { useState } from "react";

export function ProductBuyButton({
  slug,
  productId,
  productName,
  priceLabel,
}: {
  slug: string;
  productId: string;
  productName: string;
  priceLabel: string;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-shop-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          productIds: [productId],
          clientEmail: email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start payment");
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
      <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
        Payment started for {productName} ({priceLabel}). Complete checkout with Stripe in production using the
        client secret from your integration.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <label className="block text-xs font-medium text-muted">Email (optional — links sale to your client record)</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        autoComplete="email"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="button"
        onClick={handleBuy}
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Starting…" : `Buy — ${priceLabel}`}
      </button>
    </div>
  );
}
