"use client";

import {
  PAYMENT_GATEWAY_IDS,
  PAYMENT_GATEWAYS,
  type PaymentGatewayId,
} from "@/config/payment-gateways";

export function PaymentGatewayPicker({
  value,
  onChange,
}: {
  value: PaymentGatewayId;
  onChange: (id: PaymentGatewayId) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">How do you take card payments in the salon?</legend>
      <p className="text-xs text-muted -mt-1">
        SalonSynk subscription billing is separate. This is for checkout when clients pay at the chair.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PAYMENT_GATEWAY_IDS.map((id) => {
          const meta = PAYMENT_GATEWAYS[id];
          const selected = value === id;
          return (
            <label
              key={id}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-left transition-colors ${
                selected ? "border-accent bg-accent/10" : "border-border hover:border-muted"
              }`}
            >
              <input
                type="radio"
                name="paymentGateway"
                value={id}
                checked={selected}
                onChange={() => onChange(id)}
                className="mt-1 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="block text-xs text-muted mt-1">{meta.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
