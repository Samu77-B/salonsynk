"use client";

import { useState, useEffect } from "react";
import type { UpdateAppointmentInput } from "./actions";

type Member = { id: string; display_name: string | null; role: string };
type Service = { id: string; name: string; duration_minutes: number };
type Client = { id: string; name: string | null; email: string | null; phone: string | null };
type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  client_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  stylist_id: string;
  service_id: string | null;
  notes: string | null;
  send_reminder_sms?: boolean;
  send_review_request?: boolean;
  send_aftercare?: boolean;
};

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}:00`;
}

function timeFromISO(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function EditAppointmentModal({
  appointment,
  members,
  services,
  clients,
  onUpdate,
  onClose,
}: {
  appointment: Appointment;
  members: Member[];
  services: Service[];
  clients: Client[];
  onUpdate: (id: string, data: UpdateAppointmentInput) => Promise<void>;
  onClose: () => void;
}) {
  const start = new Date(appointment.start_time);
  const [stylistId, setStylistId] = useState(appointment.stylist_id);
  const [clientId, setClientId] = useState(appointment.client_id ?? "");
  const [serviceId, setServiceId] = useState(appointment.service_id ?? "");
  const [guestName, setGuestName] = useState(appointment.guest_name ?? "");
  const [date, setDate] = useState(start.toISOString().slice(0, 10));
  const [time, setTime] = useState(timeFromISO(appointment.start_time));
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const [sendReminderSms, setSendReminderSms] = useState(appointment.send_reminder_sms ?? true);
  const [sendReviewRequest, setSendReviewRequest] = useState(appointment.send_review_request ?? true);
  const [sendAftercare, setSendAftercare] = useState(appointment.send_aftercare ?? false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStylistId(appointment.stylist_id);
    setClientId(appointment.client_id ?? "");
    setServiceId(appointment.service_id ?? "");
    setGuestName(appointment.guest_name ?? "");
    setDate(new Date(appointment.start_time).toISOString().slice(0, 10));
    setTime(timeFromISO(appointment.start_time));
    setNotes(appointment.notes ?? "");
    setSendReminderSms(appointment.send_reminder_sms ?? true);
    setSendReviewRequest(appointment.send_review_request ?? true);
    setSendAftercare(appointment.send_aftercare ?? false);
  }, [appointment]);

  const service = services.find((s) => s.id === serviceId);
  const durationMinutes = service?.duration_minutes ?? 60;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stylistId) return;
    const [hours, mins] = time.split(":").map(Number);
    const startDate = new Date(date + "T12:00:00");
    startDate.setHours(hours, mins, 0, 0);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    setLoading(true);
    await onUpdate(appointment.id, {
      stylist_id: stylistId,
      client_id: clientId || null,
      service_id: serviceId || null,
      guest_name: guestName || null,
      start_time: toLocalISO(startDate),
      end_time: toLocalISO(endDate),
      notes: notes || null,
      send_reminder_sms: sendReminderSms,
      send_review_request: sendReviewRequest,
      send_aftercare: sendAftercare,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Edit appointment</h2>
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
          <div>
            <label className="block text-sm font-medium mb-1">Service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
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
              <span className="text-sm">Send reminder before appointment</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReviewRequest}
                onChange={(e) => setSendReviewRequest(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Ask how their experience was after</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendAftercare}
                onChange={(e) => setSendAftercare(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Send aftercare instructions after</span>
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
