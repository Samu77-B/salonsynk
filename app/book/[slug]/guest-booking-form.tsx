"use client";

import { useState } from "react";
import { createGuestBooking } from "./actions";

type Service = { id: string; name: string; duration_minutes: number };
type Stylist = { id: string; display_name: string | null };

export function GuestBookingForm({
  salonId,
  salonName,
  services,
  stylists,
}: {
  salonId: string;
  salonName: string;
  services: Service[];
  stylists: Stylist[];
}) {
  const [serviceId, setServiceId] = useState("");
  const [stylistId, setStylistId] = useState(stylists[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const start = new Date(`${date}T${time}:00`);
    const service = services.find((s) => s.id === serviceId);
    const end = new Date(start.getTime() + (service?.duration_minutes ?? 60) * 60 * 1000);
    const result = await createGuestBooking(salonId, {
      serviceId: serviceId || undefined,
      stylistId: stylistId || undefined,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      guestName,
      guestEmail,
      guestPhone,
    });
    setLoading(false);
    if (result.error) setError(result.error);
    else setSuccess(true);
  }

  if (success) {
    return (
      <p className="text-green-400 text-center">
        Booking confirmed. We sent a confirmation to your email.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Service</label>
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Preferred stylist</label>
        <select
          value={stylistId}
          onChange={(e) => setStylistId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {stylists.map((s) => (
            <option key={s.id} value={s.id}>{s.display_name || "Any"}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Your name</label>
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Phone</label>
        <input
          type="tel"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
