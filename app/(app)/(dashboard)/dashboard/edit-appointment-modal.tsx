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
  status?: string;
  deposit_payment_intent_id?: string | null;
  before_photo_url?: string | null;
  after_photo_url?: string | null;
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
  onNoShowCharged,
}: {
  appointment: Appointment;
  members: Member[];
  services: Service[];
  clients: Client[];
  onUpdate: (id: string, data: UpdateAppointmentInput) => Promise<void>;
  onClose: () => void;
  onNoShowCharged?: () => void;
}) {
  const client = clients.find((c) => c.id === appointment.client_id);
  const start = new Date(appointment.start_time);
  const [stylistId, setStylistId] = useState(appointment.stylist_id);
  const [clientId, setClientId] = useState(appointment.client_id ?? "");
  const [serviceId, setServiceId] = useState(appointment.service_id ?? "");
  const [guestName, setGuestName] = useState(appointment.guest_name ?? "");
  const [email, setEmail] = useState(appointment.guest_email ?? client?.email ?? "");
  const [phone, setPhone] = useState(appointment.guest_phone ?? client?.phone ?? "");
  const [date, setDate] = useState(start.toISOString().slice(0, 10));
  const [time, setTime] = useState(timeFromISO(appointment.start_time));
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const [sendReminderSms, setSendReminderSms] = useState(appointment.send_reminder_sms ?? true);
  const [sendReviewRequest, setSendReviewRequest] = useState(appointment.send_review_request ?? true);
  const [sendAftercare, setSendAftercare] = useState(appointment.send_aftercare ?? false);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState(appointment.before_photo_url ?? "");
  const [afterPhotoUrl, setAfterPhotoUrl] = useState(appointment.after_photo_url ?? "");
  const [loading, setLoading] = useState(false);
  const [noShowLoading, setNoShowLoading] = useState(false);
  const canChargeNoShow = appointment.status === "scheduled";

  useEffect(() => {
    const c = clients.find((x) => x.id === appointment.client_id);
    setStylistId(appointment.stylist_id);
    setClientId(appointment.client_id ?? "");
    setServiceId(appointment.service_id ?? "");
    setGuestName(appointment.guest_name ?? "");
    setEmail(appointment.guest_email ?? c?.email ?? "");
    setPhone(appointment.guest_phone ?? c?.phone ?? "");
    setDate(new Date(appointment.start_time).toISOString().slice(0, 10));
    setTime(timeFromISO(appointment.start_time));
    setNotes(appointment.notes ?? "");
    setSendReminderSms(appointment.send_reminder_sms ?? true);
    setSendReviewRequest(appointment.send_review_request ?? true);
    setSendAftercare(appointment.send_aftercare ?? false);
    setBeforePhotoUrl(appointment.before_photo_url ?? "");
    setAfterPhotoUrl(appointment.after_photo_url ?? "");
  }, [appointment, clients]);

  const messagingOn = sendReminderSms || sendReviewRequest || sendAftercare;
  const hasContact = !!(email?.trim() || phone?.trim());

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
      guest_email: email?.trim() || null,
      guest_phone: phone?.trim() || null,
      start_time: toLocalISO(startDate),
      end_time: toLocalISO(endDate),
      notes: notes || null,
      send_reminder_sms: sendReminderSms,
      send_review_request: sendReviewRequest,
      send_aftercare: sendAftercare,
      before_photo_url: beforePhotoUrl?.trim() || null,
      after_photo_url: afterPhotoUrl?.trim() || null,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-xl my-auto" onClick={(e) => e.stopPropagation()}>
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
              onChange={(e) => {
                const newId = e.target.value;
                setClientId(newId);
                if (newId) {
                  const c = clients.find((x) => x.id === newId);
                  setEmail(c?.email ?? "");
                  setPhone(c?.phone ?? "");
                } else {
                  setEmail("");
                  setPhone("");
                }
              }}
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
              <option value="">—</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
              ))}
            </select>
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
          <div>
            <label className="block text-sm font-medium mb-1">Before photo (URL)</label>
            <input
              type="url"
              value={beforePhotoUrl}
              onChange={(e) => setBeforePhotoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">After photo (URL)</label>
            <input
              type="url"
              value={afterPhotoUrl}
              onChange={(e) => setAfterPhotoUrl(e.target.value)}
              placeholder="https://..."
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
          {canChargeNoShow && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 space-y-2">
            <p className="text-sm font-medium">No-show</p>
            <p className="text-xs text-muted-foreground">
              If the client did not arrive, mark as no-show and charge the deposit (if one was taken).
            </p>
            <button
              type="button"
              disabled={noShowLoading}
              onClick={async () => {
                if (!confirm("Mark this appointment as no-show and charge the no-show fee (if a deposit was taken)?")) return;
                setNoShowLoading(true);
                try {
                  const res = await fetch(`/api/appointments/${appointment.id}/no-show`, { method: "POST" });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    alert(data.error ?? "Failed to charge no-show fee");
                    return;
                  }
                  onNoShowCharged?.();
                  onClose();
                } finally {
                  setNoShowLoading(false);
                }
              }}
              className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
            >
              {noShowLoading ? "Charging…" : "Charge No-Show Fee"}
            </button>
          </div>
        )}
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
