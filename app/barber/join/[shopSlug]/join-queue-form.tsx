"use client";

import { useState, useTransition } from "react";
import type { JoinQueueResult } from "./actions";

type BarberOption = {
  id: string;
  display_name: string | null;
  chair_number: number | null;
  avatar_url: string | null;
};
type ServiceOption = { id: string; name: string; duration_minutes: number; price_minor: number };

const fieldClass =
  "w-full h-11 rounded border border-border px-3 text-sm leading-5 focus:outline-none focus:ring-1 focus:ring-accent box-border";
const selectClass = fieldClass;
const btnPrimary = "btn-accent w-full py-3 text-sm font-semibold disabled:opacity-50";

type Props = {
  shopId: string;
  shopName: string;
  queueLength: number;
  barbers: BarberOption[];
  services: ServiceOption[];
  nextAvailableOnly?: boolean;
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
      try {
        const res = await fetch("/api/barber/public-join-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId,
            guestName: (formData.get("guest_name") as string) ?? "",
            guestPhone: (formData.get("guest_phone") as string) ?? "",
            serviceId: (formData.get("service_id") as string) ?? "",
            preferredBarberId: (formData.get("preferred_barber_id") as string) ?? "",
          }),
        });
        const data = (await res.json().catch(() => null)) as JoinQueueResult | null;
        setResult(
          data ?? { success: false, error: "Could not join the queue. Please try again." }
        );
      } catch (err) {
        console.error("JoinQueueForm submit failed:", err);
        setResult({ success: false, error: "Could not join the queue. Please try again." });
      }
    });
  }

  if (result?.success) {
    return (
      <div className="text-center space-y-5 py-6">
        <div className="flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-3xl text-foreground">
            ✓
          </span>
        </div>
        <h2 className="text-2xl font-bold">You&apos;re in the queue!</h2>
        <div className="barber-panel p-5 text-center">
          <p className="text-sm text-muted">
            {result.position === 1 ? "You're up next" : "Your position"}
          </p>
          <p
            className={`mt-1 font-bold text-foreground ${
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
        {result.smsQueued && (
          <p className="text-sm text-muted">Check your phone for a confirmation text.</p>
        )}
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setPreferredBarberId("");
          }}
          className="text-sm text-foreground hover:opacity-80 underline underline-offset-2"
        >
          Join another person
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="barber-panel px-4 py-4 text-center">
        <p className="text-xs text-muted">Currently waiting at {shopName}</p>
        <p className="text-3xl font-bold tabular-nums mt-1 text-foreground">{queueLength}</p>
        <p className="text-xs text-muted mt-1">
          {queueLength === 0
            ? "No wait — you could be next!"
            : `Estimated wait ~${queueLength * 20} mins`}
        </p>
      </div>

      <form action={handleSubmit} className="barber-panel p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-center">Join the queue</h2>

        {result?.error && (
          <p className="text-sm text-red-400 barber-panel px-3 py-2">{result.error}</p>
        )}

        <div>
          <label htmlFor="guest_name" className="block text-xs text-muted mb-1.5">
            Your name *
          </label>
          <input
            id="guest_name"
            name="guest_name"
            type="text"
            required
            placeholder="e.g. James"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="guest_phone" className="block text-xs text-muted mb-1.5">
            Mobile number
          </label>
          <input
            id="guest_phone"
            name="guest_phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07..."
            className={fieldClass}
          />
          <p className="text-[11px] text-muted mt-1.5">
            We only use your number for queue alerts — no marketing.
          </p>
        </div>

        {showServicesOnQueue && services.length > 0 && (
          <div>
            <label htmlFor="service_id" className="block text-xs text-muted mb-1.5">
              Service
            </label>
            <select id="service_id" name="service_id" className={selectClass}>
              <option value="">Not sure yet</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.price_minor > 0 ? ` — ${formatPrice(s.price_minor)}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {(nextAvailableOnly || barbers.length > 0) && (
          <fieldset>
            <legend className="block text-xs text-muted mb-2">
              {nextAvailableOnly ? "Barber" : "Choose your barber"}
            </legend>
            {nextAvailableOnly ? (
              <>
                <input type="hidden" name="preferred_barber_id" value="" />
                <div className="barber-panel-highlight p-4 text-center">
                  <span className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-accent/15 text-xl text-foreground border border-accent/30">
                    ✦
                  </span>
                  <p className="text-sm font-medium mt-2">Next available barber</p>
                  <p className="text-xs text-muted mt-1">We&apos;ll assign whoever is free first.</p>
                </div>
              </>
            ) : (
              <>
                <input type="hidden" name="preferred_barber_id" value={preferredBarberId} />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreferredBarberId("")}
                    className={`barber-panel p-3 text-center transition-colors ${
                      preferredBarberId === "" ? "barber-panel-highlight" : ""
                    }`}
                  >
                    <span className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-accent/15 text-lg text-foreground">
                      ✦
                    </span>
                    <span className="text-xs font-medium leading-tight mt-2 block">Next available</span>
                  </button>
                  {barbers.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setPreferredBarberId(b.id)}
                      className={`barber-panel p-3 text-center transition-colors ${
                        preferredBarberId === b.id ? "barber-panel-highlight" : ""
                      }`}
                    >
                      <BarberAvatar barber={b} size="sm" />
                      <span className="text-xs font-medium leading-tight line-clamp-2 mt-2 block">
                        {b.display_name ?? "Barber"}
                        {b.chair_number ? ` · Ch.${b.chair_number}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </fieldset>
        )}

        <button type="submit" disabled={isPending} className={btnPrimary}>
          {isPending ? "Joining…" : "Join queue"}
        </button>
      </form>
    </div>
  );
}
