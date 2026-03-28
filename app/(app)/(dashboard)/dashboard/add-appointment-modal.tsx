"use client";

import { useState, useEffect } from "react";
import type { CreateAppointmentInput } from "./actions";

type Member = { id: string; display_name: string | null; role: string };
type Service = { id: string; name: string; duration_minutes: number; processing_time_minutes?: number };
type Client = { id: string; name: string | null; email: string | null; phone: string | null };

export function AddAppointmentModal({
  salonId,
  members,
  services,
  clients,
  currentDate,
  onCreate,
  onClose,
}: {
  salonId: string;
  members: Member[];
  services: Service[];
  clients: Client[];
  currentDate: string;
  onCreate: (data: CreateAppointmentInput) => Promise<{ error?: string | null }>;
  onClose: () => void;
}) {
  const [stylistId, setStylistId] = useState(members[0]?.id ?? "");
  const [clientId, setClientId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [sendReminderSms, setSendReminderSms] = useState(true);
  const [sendReviewRequest, setSendReviewRequest] = useState(true);
  const [sendAftercare, setSendAftercare] = useState(false);
  const [allowScheduleOverlap, setAllowScheduleOverlap] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) {
      const client = clients.find((c) => c.id === clientId);
      setEmail(client?.email ?? "");
      setPhone(client?.phone ?? "");
    } else {
      setEmail("");
      setPhone("");
    }
  }, [clientId, clients]);

  const service = services.find((s) => s.id === serviceId);
  const messagingOn = sendReminderSms || sendReviewRequest || sendAftercare;
  const hasContact = !!(email?.trim() || phone?.trim());
  const durationMinutes = service?.duration_minutes ?? 60;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stylistId) return;
    const [hours, mins] = time.split(":").map(Number);
    const start = new Date(date + "T12:00:00");
    start.setHours(hours, mins, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    setSubmitError(null);
    setLoading(true);
    try {
      const result = await onCreate({
        salonId,
        stylistId,
        clientId: clientId || null,
        serviceId: serviceId || null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        guestName: guestName || null,
        guestEmail: email?.trim() || null,
        guestPhone: phone?.trim() || null,
        notes: notes || null,
        sendReminderSms,
        sendReviewRequest,
        sendAftercare,
        allowScheduleOverlap,
      });
      if (result?.error) setSubmitError(result.error);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not save appointment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-xl my-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Add appointment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Stylist</label>
            <select
              value={stylistId}
              onChange={(e) => setStylistId(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.display_name || m.role}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Walk-in (guest)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.email || c.phone || c.id}</option>
              ))}
            </select>
          </div>
          {!clientId && (
            <div>
              <label className="block text-sm font-medium mb-1">Guest name</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07xxx xxxxxx"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          {messagingOn && !hasContact && (
            <p className="text-sm text-amber-600">
              No email or phone – reminders won&apos;t be sent.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
              ))}
            </select>
            {service && (service.processing_time_minutes ?? 0) > 0 && (
              <p className="text-xs text-muted mt-1">
                This service has <strong>{service.processing_time_minutes}</strong> min processing time (e.g. colour developing).
                Another appointment can overlap that window for the same stylist — configure under the Services tab.
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1 min-w-0">
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
            <label className="block text-sm font-medium mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">Messages to client</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReminderSms}
                onChange={(e) => setSendReminderSms(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Send reminder (SMS/text) before appointment</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReviewRequest}
                onChange={(e) => setSendReviewRequest(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Ask how their experience was after appointment</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendAftercare}
                onChange={(e) => setSendAftercare(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Send aftercare instructions after appointment</span>
            </label>
          </div>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowScheduleOverlap}
                onChange={(e) => setAllowScheduleOverlap(e.target.checked)}
                className="mt-1 rounded border-border"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">Add even if this overlaps another booking</span>
                <span className="mt-1 block text-muted">
                  Use for walk-ins or when the diary can’t model your situation (e.g. another client is only processing).
                  The calendar will show two bookings at once for this stylist.
                </span>
              </span>
            </label>
          </div>
          {submitError && (
            <p className="text-sm text-red-400" role="alert">
              {submitError}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
              {loading ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
