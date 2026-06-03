"use client";

import { useState } from "react";
import { adminUpdateSalonPaymentGateway } from "../actions";
import {
  PAYMENT_GATEWAY_IDS,
  PAYMENT_GATEWAYS,
  isPaymentGatewayId,
  type PaymentGatewayId,
} from "@/config/payment-gateways";

export function AdminSalonPaymentGateway({
  salonId,
  initialGateway,
}: {
  salonId: string;
  initialGateway: string;
}) {
  const raw = isPaymentGatewayId(initialGateway) ? initialGateway : "stripe";
  const [gateway, setGateway] = useState<PaymentGatewayId>(raw);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<"saved" | "error" | null>(null);
  const [errorText, setErrorText] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErrorText("");
    const result = await adminUpdateSalonPaymentGateway(salonId, gateway);
    setLoading(false);
    if (result.error) {
      setMsg("error");
      setErrorText(result.error);
    } else {
      setMsg("saved");
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">Card payments in the salon</h2>
      <p className="text-sm text-muted">
        Match what the client chose at signup. Stripe salons use in-app card checkout; Worldpay / Dojo /
        other POS salons record sales after taking payment on their existing terminal.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PAYMENT_GATEWAY_IDS.map((id) => (
          <label
            key={id}
            className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${
              gateway === id ? "border-accent bg-accent/10" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="paymentGateway"
              value={id}
              checked={gateway === id}
              onChange={() => setGateway(id)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{PAYMENT_GATEWAYS[id].label}</span>
              <span className="block text-xs text-muted mt-1">{PAYMENT_GATEWAYS[id].description}</span>
            </span>
          </label>
        ))}
      </div>
      {msg === "saved" && <p className="text-sm text-green-400">Payment gateway saved.</p>}
      {msg === "error" && (
        <p className="text-sm text-red-400">{errorText || "Failed to save."}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save payment gateway"}
      </button>
    </form>
  );
}
