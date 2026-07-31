"use client";

import { useState, useTransition } from "react";
import { publicBookAppointment, type BookAppointmentResult } from "./actions";

type BarberOption = {
  id: string;
  display_name: string | null;
  chair_number: number | null;
};
type ServiceOption = { id: string; name: string; duration_minutes: number; price_minor: number };

const fieldClass =
  "w-full h-11 rounded border border-border px-3 text-sm leading-5 focus:outline-none focus:ring-1 focus:ring-accent box-border";
const selectClass = fieldClass;
const btnPrimary = "btn-accent w-full py-3 text-sm font-semibold disabled:opacity-50";

function formatPrice(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function formatBookingWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BookAppointmentForm({
  shopId,
  shopName,
  barbers,
  services,
  showServices = true,
}: {
  shopId: string;
  shopName: string;
  barbers: BarberOption[];
  services: ServiceOption[];
  showServices?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BookAppointmentResult | null>(null);
  const minDate = new Date().toISOString().slice(0, 10);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await publicBookAppointment(shopId, formData);
      setResult(res);
    });
  }

  if (result?.success && result.startTime) {
    return (
      <div className="text-center space-y-5 py-6">
        <div className="flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-3xl text-foreground">
            ✓
          </span>
        </div>
        <h2 className="text-2xl font-bold">Booking confirmed</h2>
        <div className="barber-panel p-5 text-center">
          <p className="text-sm text-muted">You&apos;re booked at {shopName}</p>
          <p className="text-lg font-semibold mt-2">{formatBookingWhen(result.startTime)}</p>
          <p className="text-sm text-muted mt-2">with {result.barberName}</p>
          {result.smsSent && (
            <p className="text-xs text-muted mt-3">We&apos;ve sent a confirmation text to your phone.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="text-sm text-foreground hover:opacity-80 underline underline-offset-2"
        >
          Book another appointment
        </button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="barber-panel p-4 sm:p-5 space-y-3">
      <h2 className="text-sm font-semibold text-center">Book for later</h2>

      {result?.error && (
        <p className="text-sm text-red-400 barber-panel px-3 py-2">{result.error}</p>
      )}

      <div>
        <label htmlFor="book_guest_name" className="block text-xs text-muted mb-1.5">
          Your name *
        </label>
        <input
          id="book_guest_name"
          name="guest_name"
          type="text"
          required
          placeholder="e.g. James"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="book_guest_phone" className="block text-xs text-muted mb-1.5">
          Mobile number
        </label>
        <input
          id="book_guest_phone"
          name="guest_phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="07..."
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="book_barber_id" className="block text-xs text-muted mb-1.5">
          Barber *
        </label>
        {barbers.length === 0 ? (
          <p className="text-sm text-muted barber-panel px-3 py-2.5">
            No barbers are available for booking right now. Please contact the shop.
          </p>
        ) : (
          <select id="book_barber_id" name="barber_id" required className={selectClass}>
            <option value="">Choose a barber…</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.display_name ?? "Barber"}
                {b.chair_number ? ` (Chair ${b.chair_number})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {showServices && services.length > 0 && (
        <div>
          <label htmlFor="book_service_id" className="block text-xs text-muted mb-1.5">
            Service
          </label>
          <select id="book_service_id" name="service_id" className={selectClass}>
            <option value="">General cut (30 min)</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.price_minor > 0 ? ` — ${formatPrice(s.price_minor)}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="book_date" className="block text-xs text-muted mb-1.5">
          Date *
        </label>
        <input id="book_date" name="date" type="date" required min={minDate} className={fieldClass} />
      </div>

      <div>
        <label htmlFor="book_time" className="block text-xs text-muted mb-1.5">
          Time *
        </label>
        <input id="book_time" name="time" type="time" required className={fieldClass} />
      </div>

      <button type="submit" disabled={isPending || barbers.length === 0} className={btnPrimary}>
        {isPending ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
