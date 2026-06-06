"use client";

import { useState, useTransition } from "react";
import { publicJoinQueue, type JoinQueueResult } from "./actions";

type BarberOption = { id: string; display_name: string | null; chair_number: number | null };
type ServiceOption = { id: string; name: string; duration_minutes: number; price_minor: number };

type Props = {
  shopId: string;
  shopName: string;
  queueLength: number;
  barbers: BarberOption[];
  services: ServiceOption[];
};

function formatPrice(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

export function JoinQueueForm({ shopId, shopName, queueLength, barbers, services }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JoinQueueResult | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await publicJoinQueue(shopId, formData);
      setResult(res);
    });
  }

  // Success state
  if (result?.success) {
    return (
      <div className="mx-auto max-w-md text-center space-y-6 py-10">
        <div className="flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20 text-3xl">
            ✓
          </span>
        </div>
        <h2 className="text-2xl font-bold">You&apos;re in the queue!</h2>
        <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Your position</span>
            <span className="font-bold text-lg">#{result.position}</span>
          </div>
          {(result.estimatedWait ?? 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Estimated wait</span>
              <span className="font-semibold">~{result.estimatedWait} mins</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted">
          Please stay nearby. We&apos;ll call your name when it&apos;s your turn.
        </p>
        <button
          onClick={() => setResult(null)}
          className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          Join another person
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Queue status */}
      <div className="rounded-xl border border-border bg-surface p-5 text-center">
        <p className="text-sm text-muted">Currently waiting</p>
        <p className="text-4xl font-bold tabular-nums mt-1">{queueLength}</p>
        <p className="text-xs text-muted mt-1">
          {queueLength === 0
            ? "No wait — you could be next!"
            : `Estimated wait ~${queueLength * 20} mins`}
        </p>
      </div>

      {/* Form */}
      <form action={handleSubmit} className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h2 className="text-lg font-semibold text-center">Join the Queue</h2>

        {result?.error && (
          <p className="text-sm text-red-400 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5">
            {result.error}
          </p>
        )}

        <div>
          <label htmlFor="guest_name" className="block text-sm font-medium mb-1">Your Name *</label>
          <input
            id="guest_name"
            name="guest_name"
            type="text"
            required
            placeholder="e.g. James"
            className="w-full rounded-lg border border-border bg-canvas px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="guest_phone" className="block text-sm font-medium mb-1">Phone (optional)</label>
          <input
            id="guest_phone"
            name="guest_phone"
            type="tel"
            placeholder="07..."
            className="w-full rounded-lg border border-border bg-canvas px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {services.length > 0 && (
          <div>
            <label htmlFor="service_id" className="block text-sm font-medium mb-1">Service</label>
            <select
              id="service_id"
              name="service_id"
              className="w-full rounded-lg border border-border bg-canvas px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Not sure yet</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.price_minor > 0 ? ` — ${formatPrice(s.price_minor)}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {barbers.length > 1 && (
          <div>
            <label htmlFor="preferred_barber_id" className="block text-sm font-medium mb-1">Preferred Barber</label>
            <select
              id="preferred_barber_id"
              name="preferred_barber_id"
              className="w-full rounded-lg border border-border bg-canvas px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No preference</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.display_name ?? "Barber"}{b.chair_number ? ` (Chair ${b.chair_number})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Joining…" : "Join Queue"}
        </button>
      </form>

      <p className="text-center text-xs text-muted">
        Powered by <span className="font-semibold">Barber Synk</span>
      </p>
    </div>
  );
}
