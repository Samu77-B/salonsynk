"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import { phoneHref } from "@modules/barber/lib/queue-sms-messages";
import {
  createBarberAppointment,
  updateBarberAppointmentStatus,
  deleteBarberAppointment,
} from "./actions";
import type { BarberAppointment, BarberMember, BarberService } from "./data";

type Props = {
  date: string;
  appointments: BarberAppointment[];
  members: BarberMember[];
  services: BarberService[];
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatPrice(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "text-blue-400 bg-blue-500/10",
  in_chair: "text-amber-400 bg-amber-500/10",
  completed: "text-emerald-400 bg-emerald-500/10",
  no_show: "text-red-400 bg-red-500/10",
};

export function AppointmentsView({ date, appointments, members, services }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const barbers = members.filter((m) => m.display_name);

  function changeDate(newDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", newDate);
    router.push(`/barber/appointments?${params.toString()}`);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("date", date);
    startTransition(async () => {
      const result = await createBarberAppointment(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setShowForm(false);
      router.refresh();
    });
  }

  function handleStatus(id: string, status: BarberAppointment["status"]) {
    startTransition(async () => {
      const result = await updateBarberAppointmentStatus(id, status);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleCancel(id: string) {
    startTransition(async () => {
      const result = await deleteBarberAppointment(id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <label htmlFor="appt-date" className="block text-xs text-muted mb-1">
            Day
          </label>
          <input
            id="appt-date"
            type="date"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            className="rounded border border-border bg-canvas px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? "Close" : "New booking"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 rounded border border-red-500/30 bg-red-500/10 px-3 py-2">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-dashed border-border p-4 space-y-3"
        >
          <p className="text-sm font-medium">Add pre-booking</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-muted mb-1">Client name *</label>
              <input name="guest_name" required className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Phone</label>
              <input name="guest_phone" type="tel" placeholder="07..." className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Barber *</label>
              <select name="barber_id" required className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm">
                <option value="">Select…</option>
                {barbers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}{m.chair_number ? ` (Chair ${m.chair_number})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Service</label>
              <select name="service_id" className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm">
                <option value="">General cut (30 min)</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.duration_minutes} min
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Time *</label>
              <input name="time" type="time" required className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Email</label>
              <input name="guest_email" type="email" className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1">Notes</label>
              <input name="notes" className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm" />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save booking"}
          </button>
        </form>
      )}

      {appointments.length === 0 ? (
        <p className="text-sm text-muted text-center py-12">No bookings for this day.</p>
      ) : (
        <ul className="space-y-2">
          {appointments.map((appt) => {
            const barber = members.find((m) => m.id === appt.barber_id);
            const service = services.find((s) => s.id === appt.service_id);
            const phone = appt.guest_phone;
            const links = phone ? phoneHref(phone) : null;

            return (
              <li
                key={appt.id}
                className="rounded-lg border border-border bg-surface px-4 py-3 flex flex-wrap gap-3 items-start justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {formatTime(appt.start_time)}
                    </span>
                    <span className="text-sm font-medium">{appt.guest_name ?? "—"}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_STYLES[appt.status] ?? ""}`}
                    >
                      {appt.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {barber?.display_name ?? "Barber"}
                    {service ? ` · ${service.name}` : ""}
                    {service ? ` · ${formatPrice(service.price_minor)}` : ""}
                  </p>
                  {phone && links && (
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs font-mono text-muted">{phone}</span>
                      <a href={links.tel} className="text-xs text-blue-400 hover:underline">
                        Call
                      </a>
                      <a href={links.sms} className="text-xs text-blue-400 hover:underline">
                        SMS
                      </a>
                    </div>
                  )}
                  {appt.notes && <p className="text-xs text-muted mt-1">{appt.notes}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {appt.status === "scheduled" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatus(appt.id, "in_chair")}
                        disabled={isPending}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatus(appt.id, "no_show")}
                        disabled={isPending}
                        className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-400 disabled:opacity-50"
                      >
                        No-show
                      </button>
                    </>
                  )}
                  {appt.status === "in_chair" && (
                    <button
                      type="button"
                      onClick={() => handleStatus(appt.id, "completed")}
                      disabled={isPending}
                      className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      Complete
                    </button>
                  )}
                  {appt.status !== "canceled" && appt.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => handleCancel(appt.id)}
                      disabled={isPending}
                      className="rounded border border-border px-2 py-1 text-xs text-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
