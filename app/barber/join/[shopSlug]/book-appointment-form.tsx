"use client";

import { useState, useTransition } from "react";
import { ANY_BARBER_BOOKING_VALUE, type BookAppointmentResult } from "./actions";

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

function BarberAvatar({ barber, size = "md" }: { barber: BarberOption | { display_name: string | null; avatar_url?: string | null }; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const text = size === "sm" ? "text-sm" : "text-lg";
  if (barber.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={barber.avatar_url}
        alt=""
        className={`${dim} mx-auto rounded-full object-cover border border-border shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} mx-auto flex items-center justify-center rounded-full bg-muted/20 ${text} font-semibold text-muted border border-border shrink-0`}
    >
      {(barber.display_name ?? "B").charAt(0).toUpperCase()}
    </div>
  );
}

function BookingConfirmed({ result, shopName, onBookAnother }: {
  result: BookAppointmentResult;
  shopName: string;
  onBookAnother: () => void;
}) {
  const showBarber = result.showBarber && result.barberName;

  return (
    <div className="text-center space-y-5 py-6">
      <div className="flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-3xl text-foreground">
          ✓
        </span>
      </div>
      <h2 className="text-2xl font-bold">Booking confirmed</h2>
      <div className="barber-panel p-5 text-center space-y-3">
        {showBarber ? (
          <>
            <div className="flex justify-center">
              <BarberAvatar
                barber={{
                  display_name: result.barberName ?? null,
                  avatar_url: result.barberAvatarUrl,
                }}
              />
            </div>
            <p className="text-sm font-semibold">{result.barberName}</p>
            <p className="text-xs text-muted">Your barber</p>
          </>
        ) : null}
        <div className={showBarber ? "pt-1 border-t border-border" : undefined}>
          <p className="text-sm text-muted">You&apos;re booked at {shopName}</p>
          <p className="text-lg font-semibold mt-2">{formatBookingWhen(result.startTime!)}</p>
        </div>
        {result.smsSent && (
          <p className="text-xs text-muted">We&apos;ve sent a confirmation text to your phone.</p>
        )}
      </div>
      <button
        type="button"
        onClick={onBookAnother}
        className="text-sm text-foreground hover:opacity-80 underline underline-offset-2"
      >
        Book another appointment
      </button>
    </div>
  );
}

export function BookAppointmentForm({
  shopId,
  shopName,
  barbers,
  services,
  showServices = true,
  nextAvailableOnly = false,
}: {
  shopId: string;
  shopName: string;
  barbers: BarberOption[];
  services: ServiceOption[];
  showServices?: boolean;
  nextAvailableOnly?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BookAppointmentResult | null>(null);
  const [barberId, setBarberId] = useState(ANY_BARBER_BOOKING_VALUE);
  const minDate = new Date().toISOString().slice(0, 10);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/barber/public-book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId,
            guestName: (formData.get("guest_name") as string) ?? "",
            guestPhone: (formData.get("guest_phone") as string) ?? "",
            barberId,
            serviceId: (formData.get("service_id") as string) ?? "",
            date: (formData.get("date") as string) ?? "",
            time: (formData.get("time") as string) ?? "",
            notes: (formData.get("notes") as string) ?? "",
          }),
        });
        const data = (await res.json().catch(() => null)) as BookAppointmentResult | null;
        setResult(
          data ?? { success: false, error: "Could not save your booking. Please try again." }
        );
      } catch (err) {
        console.error("BookAppointmentForm submit failed:", err);
        setResult({ success: false, error: "Could not save your booking. Please try again." });
      }
    });
  }

  if (result?.success && result.startTime) {
    return (
      <BookingConfirmed
        result={result}
        shopName={shopName}
        onBookAnother={() => {
          setResult(null);
          setBarberId(ANY_BARBER_BOOKING_VALUE);
        }}
      />
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

      {(nextAvailableOnly || barbers.length > 0) && (
        <fieldset>
          <legend className="block text-xs text-muted mb-2">
            {nextAvailableOnly ? "Barber" : "Choose your barber"}
          </legend>
          {nextAvailableOnly ? (
            <div className="barber-panel-highlight p-4 text-center">
              <span className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-accent/15 text-xl text-foreground border border-accent/30">
                ✦
              </span>
              <p className="text-sm font-medium mt-2">Any barber</p>
              <p className="text-xs text-muted mt-1">We&apos;ll assign whoever is available for your time.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBarberId(ANY_BARBER_BOOKING_VALUE)}
                  className={`barber-panel p-3 text-center transition-colors ${
                    barberId === ANY_BARBER_BOOKING_VALUE ? "barber-panel-highlight" : ""
                  }`}
                >
                  <span className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-accent/15 text-lg text-foreground">
                    ✦
                  </span>
                  <span className="text-xs font-medium leading-tight mt-2 block">Any barber</span>
                </button>
                {barbers.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBarberId(b.id)}
                    className={`barber-panel p-3 text-center transition-colors ${
                      barberId === b.id ? "barber-panel-highlight" : ""
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
              <p className="text-xs text-muted mt-2">
                Tap a photo to book with them, or choose any barber and we&apos;ll assign whoever is free.
              </p>
            </>
          )}
        </fieldset>
      )}

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

      <button type="submit" disabled={isPending} className={btnPrimary}>
        {isPending ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
