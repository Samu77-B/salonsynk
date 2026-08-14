"use client";

import { useState, useTransition } from "react";
import { ANY_TECHNICIAN_BOOKING_VALUE } from "@modules/nail/lib/resolve-booking-technician";

type TechnicianOption = {
  id: string;
  display_name: string | null;
  station_number: number | null;
  avatar_url: string | null;
};
type ServiceOption = { id: string; name: string; duration_minutes: number; price_minor: number };

export type BookAppointmentResult = {
  success: boolean;
  startTime?: string;
  technicianName?: string;
  technicianAvatarUrl?: string | null;
  showTechnician?: boolean;
  smsSent?: boolean;
  error?: string;
};

const fieldClass =
  "w-full rounded-lg border border-border bg-canvas px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

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

function TechnicianAvatar({
  technician,
  size = "md",
}: {
  technician: TechnicianOption | { display_name: string | null; avatar_url?: string | null };
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const text = size === "sm" ? "text-sm" : "text-lg";
  if (technician.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={technician.avatar_url}
        alt=""
        className={`${dim} rounded-full object-cover border border-border shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} flex items-center justify-center rounded-full bg-muted/20 ${text} font-semibold text-muted border border-border shrink-0`}
    >
      {(technician.display_name ?? "T").charAt(0).toUpperCase()}
    </div>
  );
}

function BookingConfirmed({
  result,
  salonName,
  onBookAnother,
}: {
  result: BookAppointmentResult;
  salonName: string;
  onBookAnother: () => void;
}) {
  const showTechnician = result.showTechnician && result.technicianName;

  return (
    <div className="text-center space-y-5 py-6">
      <div className="flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20 text-3xl">
          ✓
        </span>
      </div>
      <h2 className="text-2xl font-bold">Booking confirmed</h2>
      <div className="rounded-xl border border-border bg-surface p-5 text-center space-y-3">
        {showTechnician ? (
          <>
            <div className="flex justify-center">
              <TechnicianAvatar
                technician={{
                  display_name: result.technicianName ?? null,
                  avatar_url: result.technicianAvatarUrl,
                }}
              />
            </div>
            <p className="text-sm font-semibold">{result.technicianName}</p>
            <p className="text-xs text-muted">Your technician</p>
          </>
        ) : null}
        <div className={showTechnician ? "pt-1 border-t border-border" : undefined}>
          <p className="text-sm text-muted">You&apos;re booked at {salonName}</p>
          <p className="text-lg font-semibold mt-2">{formatBookingWhen(result.startTime!)}</p>
        </div>
        {result.smsSent && (
          <p className="text-xs text-muted">We&apos;ve sent a confirmation text to your phone.</p>
        )}
      </div>
      <button
        type="button"
        onClick={onBookAnother}
        className="text-sm text-accent hover:opacity-80 underline underline-offset-2"
      >
        Book another appointment
      </button>
    </div>
  );
}

export function BookAppointmentForm({
  salonId,
  salonName,
  technicians,
  services,
  showServices = true,
  nextAvailableOnly = false,
}: {
  salonId: string;
  salonName: string;
  technicians: TechnicianOption[];
  services: ServiceOption[];
  showServices?: boolean;
  nextAvailableOnly?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BookAppointmentResult | null>(null);
  const [technicianId, setTechnicianId] = useState(ANY_TECHNICIAN_BOOKING_VALUE);
  const minDate = new Date().toISOString().slice(0, 10);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/nail/public-book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salonId,
            guestName: (formData.get("guest_name") as string) ?? "",
            guestPhone: (formData.get("guest_phone") as string) ?? "",
            technicianId,
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
        salonName={salonName}
        onBookAnother={() => {
          setResult(null);
          setTechnicianId(ANY_TECHNICIAN_BOOKING_VALUE);
        }}
      />
    );
  }

  return (
    <form action={handleSubmit} className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-3">
      <h2 className="text-sm font-semibold text-center">Book for later</h2>

      {result?.error && (
        <p className="text-sm text-red-400 rounded-lg border border-border px-3 py-2">{result.error}</p>
      )}

      <div>
        <label htmlFor="book_guest_name" className="block text-sm font-medium mb-1">
          Your name *
        </label>
        <input
          id="book_guest_name"
          name="guest_name"
          type="text"
          required
          placeholder="e.g. Sarah"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="book_guest_phone" className="block text-sm font-medium mb-1">
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
        <p className="text-xs text-muted mt-1.5">Optional — we&apos;ll text a confirmation if you add it.</p>
      </div>

      {(nextAvailableOnly || technicians.length > 0) && (
        <fieldset>
          <legend className="block text-sm font-medium mb-2">
            {nextAvailableOnly ? "Technician" : "Choose your technician"}
          </legend>
          {nextAvailableOnly ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-accent bg-accent/10 ring-2 ring-accent p-4 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/20 text-2xl border border-border">
                ✦
              </span>
              <span className="text-sm font-medium">Any technician</span>
              <p className="text-xs text-muted">We&apos;ll assign whoever is available for your time.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setTechnicianId(ANY_TECHNICIAN_BOOKING_VALUE)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors ${
                    technicianId === ANY_TECHNICIAN_BOOKING_VALUE
                      ? "border-accent bg-accent/10 ring-2 ring-accent"
                      : "border-border hover:border-accent/50"
                  }`}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/20 text-2xl border border-border">
                    ✦
                  </span>
                  <span className="text-xs font-medium leading-tight">Any technician</span>
                </button>
                {technicians.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTechnicianId(t.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors ${
                      technicianId === t.id
                        ? "border-accent bg-accent/10 ring-2 ring-accent"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <TechnicianAvatar technician={t} />
                    <span className="text-xs font-medium leading-tight line-clamp-2">
                      {t.display_name ?? "Technician"}
                      {t.station_number ? ` · St.${t.station_number}` : ""}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">
                Tap a photo to book with them, or choose any technician and we&apos;ll assign whoever is free.
              </p>
            </>
          )}
        </fieldset>
      )}

      {showServices && services.length > 0 && (
        <div>
          <label htmlFor="book_service_id" className="block text-sm font-medium mb-1">
            Service
          </label>
          <select id="book_service_id" name="service_id" className={fieldClass}>
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

      <div>
        <label htmlFor="book_date" className="block text-sm font-medium mb-1">
          Date *
        </label>
        <input id="book_date" name="date" type="date" required min={minDate} className={fieldClass} />
      </div>

      <div>
        <label htmlFor="book_time" className="block text-sm font-medium mb-1">
          Time *
        </label>
        <input id="book_time" name="time" type="time" required className={fieldClass} />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
