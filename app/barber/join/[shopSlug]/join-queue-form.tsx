"use client";

import { useState, useTransition } from "react";
import { publicJoinQueue, type JoinQueueResult } from "./actions";

type BarberOption = {
  id: string;
  display_name: string | null;
  chair_number: number | null;
  avatar_url: string | null;
};
type ServiceOption = { id: string; name: string; duration_minutes: number; price_minor: number };

type Props = {
  shopId: string;
  shopName: string;
  queueLength: number;
  barbers: BarberOption[];
  services: ServiceOption[];
  /** When true, show only "Next available" — no individual barber tiles. */
  nextAvailableOnly?: boolean;
  /** When false, hide the service dropdown on the join form. */
  showServicesOnQueue?: boolean;
};

function formatPrice(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function BarberAvatar({ barber, size = "md" }: { barber: BarberOption; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const text = size === "sm" ? "text-sm" : "text-lg";
  if (barber.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={barber.avatar_url}
        alt=""
        className={`${dim} rounded-full object-cover border border-border shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} flex items-center justify-center rounded-full bg-muted/20 ${text} font-semibold text-muted border border-border shrink-0`}
    >
      {(barber.display_name ?? "B").charAt(0).toUpperCase()}
    </div>
  );
}

export function JoinQueueForm({
  shopId,
  shopName,
  queueLength,
  barbers,
  services,
  nextAvailableOnly = false,
  showServicesOnQueue = true,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JoinQueueResult | null>(null);
  const [preferredBarberId, setPreferredBarberId] = useState("");

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await publicJoinQueue(shopId, formData);
      setResult(res);
    });
  }

  if (result?.success) {
    return (
      <div className="mx-auto max-w-md text-center space-y-6 py-10">
        <div className="flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20 text-3xl">
            ✓
          </span>
        </div>
        <h2 className="text-2xl font-bold">You&apos;re in the queue!</h2>
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted">
            {result.position === 1 ? "You're up next" : "Your position"}
          </p>
          <p
            className={`mt-1 font-bold ${
              result.position === 1 ? "text-2xl sm:text-3xl" : "text-4xl tabular-nums"
            }`}
          >
            {result.position === 1 ? "It's your turn" : `#${result.position}`}
          </p>
          {result.position === 1 ? (
            <p className="text-xs text-muted mt-1">Please stay nearby — we&apos;ll call your name shortly.</p>
          ) : (result.estimatedWait ?? 0) > 0 ? (
            <p className="text-xs text-muted mt-1">Estimated wait ~{result.estimatedWait} mins</p>
          ) : null}
        </div>
        {result.position !== 1 && (
          <p className="text-sm text-muted">
            Please stay nearby. We&apos;ll call your name when it&apos;s your turn.
          </p>
        )}
        {result.smsQueued && (
          <p className="text-sm text-muted">
            {result.position === 1
              ? "Check your phone — we&apos;ve texted you that you&apos;ll be up next shortly."
              : result.position === 2
                ? "Check your phone — we&apos;ve texted you that you&apos;re #2 in the queue, with around 20 minutes until your turn."
                : "Check your phone — we&apos;ve texted you your queue number and estimated wait time."}
          </p>
        )}
        <button
          onClick={() => {
            setResult(null);
            setPreferredBarberId("");
          }}
          className="text-sm text-accent hover:opacity-80 underline underline-offset-2"
        >
          Join another person
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5 text-center">
        <p className="text-sm text-muted">Currently waiting</p>
        <p className="text-4xl font-bold tabular-nums mt-1">{queueLength}</p>
        <p className="text-xs text-muted mt-1">
          {queueLength === 0
            ? "No wait — you could be next!"
            : `Estimated wait ~${queueLength * 20} mins`}
        </p>
      </div>

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
            className="w-full rounded-lg border border-border bg-canvas px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="guest_phone" className="block text-sm font-medium mb-1">
            Mobile number
          </label>
          <p className="text-xs text-muted mb-2">
            Add your mobile so we can text you when it&apos;s your turn.
          </p>
          <input
            id="guest_phone"
            name="guest_phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07..."
            className="w-full rounded-lg border border-border bg-canvas px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-muted mt-2">
            We only use your number for queue text alerts. We don&apos;t share it with anyone
            else or use it for marketing.
          </p>
        </div>

        {showServicesOnQueue && services.length > 0 && (
          <div>
            <label htmlFor="service_id" className="block text-sm font-medium mb-1">Service</label>
            <select
              id="service_id"
              name="service_id"
              className="w-full rounded-lg border border-border bg-canvas px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
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

        {(nextAvailableOnly || barbers.length > 0) && (
          <fieldset>
            <legend className="block text-sm font-medium mb-2">
              {nextAvailableOnly ? "Barber" : "Choose your barber"}
            </legend>
            {nextAvailableOnly ? (
              <>
                <input type="hidden" name="preferred_barber_id" value="" />
              <div className="flex flex-col items-center gap-2 rounded-xl border border-accent bg-accent/10 ring-2 ring-accent p-4 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/20 text-2xl border border-border">
                  ✦
                </span>
                <span className="text-sm font-medium">Next available barber</span>
                <p className="text-xs text-muted">
                  We&apos;ll assign whoever is free first.
                </p>
              </div>
              </>
            ) : (
              <>
                <input type="hidden" name="preferred_barber_id" value={preferredBarberId} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setPreferredBarberId("")}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors ${
                      preferredBarberId === ""
                        ? "border-accent bg-accent/10 ring-2 ring-accent"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/20 text-2xl border border-border">
                      ✦
                    </span>
                    <span className="text-xs font-medium leading-tight">Next available</span>
                  </button>
                  {barbers.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setPreferredBarberId(b.id)}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors ${
                        preferredBarberId === b.id
                          ? "border-accent bg-accent/10 ring-2 ring-accent"
                          : "border-border hover:border-accent/50"
                      }`}
                    >
                      <BarberAvatar barber={b} />
                      <span className="text-xs font-medium leading-tight line-clamp-2">
                        {b.display_name ?? "Barber"}
                        {b.chair_number ? ` · Ch.${b.chair_number}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted mt-2">
                  Pick someone you know, or tap their photo. Otherwise we&apos;ll assign the next available barber.
                </p>
              </>
            )}
          </fieldset>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50 transition-colors"
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

