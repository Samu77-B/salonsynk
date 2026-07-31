"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import {
  createBarberAppointment,
  updateBarberAppointmentStatus,
  deleteBarberAppointment,
} from "./actions";
import type { BarberAppointment, BarberMember, BarberService } from "./data";
import { formatDurationMinutes } from "@/lib/format-duration";

type Props = {
  date: string;
  appointments: BarberAppointment[];
  members: BarberMember[];
  services: BarberService[];
};

const fieldClass =
  "w-full h-11 rounded border border-border px-3 text-sm leading-5 focus:outline-none focus:ring-1 focus:ring-accent box-border";
const selectClass = fieldClass;
const btnPrimary = "btn-accent px-3 py-2.5 text-xs sm:text-sm disabled:opacity-50";
const btnOutline = "btn-outline px-3 py-2.5 text-xs sm:text-sm disabled:opacity-50";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatPrice(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_chair: "In chair",
  completed: "Completed",
  no_show: "No-show",
  canceled: "Canceled",
};

export function AppointmentsView({ date, appointments, members, services }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const barbers = members.filter((m) => m.display_name);
  const scheduled = appointments.filter((a) => a.status === "scheduled").length;
  const inProgress = appointments.filter((a) => a.status === "in_chair").length;
  const done = appointments.filter((a) => a.status === "completed").length;

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
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="barber-panel px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] sm:text-xs text-muted leading-tight">Scheduled</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5 text-accent">{scheduled}</p>
        </div>
        <div className="barber-panel px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] sm:text-xs text-muted leading-tight">In Chair</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5 text-accent">{inProgress}</p>
        </div>
        <div className="barber-panel px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] sm:text-xs text-muted leading-tight">Completed</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5 text-accent">{done}</p>
        </div>
      </div>

      <div className="barber-panel overflow-hidden">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-foreground/[0.04] transition-colors"
          aria-expanded={showForm}
        >
          <span className="text-sm font-semibold">New Booking</span>
          <ChevronIcon open={showForm} />
        </button>

        <div className={`barber-roll-down ${showForm ? "is-open" : ""}`} aria-hidden={!showForm}>
          <div className="barber-roll-down-inner">
            <form onSubmit={handleCreate} className="border-t border-border px-4 py-4 space-y-3">
              <div>
                <label htmlFor="appt-date" className="block text-xs text-muted mb-1.5">
                  Day
                </label>
                <input
                  id="appt-date"
                  type="date"
                  value={date}
                  onChange={(e) => changeDate(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Client name *</label>
                <input name="guest_name" required className={fieldClass} placeholder="Name" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Phone</label>
                <input name="guest_phone" type="tel" placeholder="07..." className={fieldClass} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Barber *</label>
                <select name="barber_id" required className={selectClass}>
                  <option value="">Select…</option>
                  {barbers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                      {m.chair_number ? ` (Chair ${m.chair_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Service</label>
                <select name="service_id" className={selectClass}>
                  <option value="">General cut (30 min)</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatDurationMinutes(s.duration_minutes)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Time *</label>
                <input name="time" type="time" required className={fieldClass} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Email</label>
                <input name="guest_email" type="email" className={fieldClass} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">Notes</label>
                <input name="notes" className={fieldClass} placeholder="Optional" />
              </div>
              <button type="submit" disabled={isPending} className={`w-full ${btnPrimary} py-3`}>
                {isPending ? "Saving…" : "Save booking"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 barber-panel px-3 py-2">{error}</p>
      )}

      <section>
        <h2 className="text-xs font-bold text-accent uppercase tracking-widest mb-2.5">
          Bookings ({appointments.length})
        </h2>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center barber-panel">No bookings for this day.</p>
        ) : (
          <ul className="space-y-2.5">
            {appointments.map((appt) => {
              const barber = members.find((m) => m.id === appt.barber_id);
              const service = services.find((s) => s.id === appt.service_id);
              const highlighted = appt.status === "in_chair";

              return (
                <li
                  key={appt.id}
                  className={highlighted ? "barber-panel-highlight p-3.5 sm:p-4 space-y-3" : "barber-panel p-3.5 sm:p-4 space-y-3"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold tabular-nums text-accent">
                          {formatTime(appt.start_time)}
                        </span>
                        <span className="text-sm font-semibold truncate">{appt.guest_name ?? "—"}</span>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {barber?.display_name ?? "Barber"}
                        {service ? ` · ${service.name}` : ""}
                        {service && service.price_minor > 0 ? ` · ${formatPrice(service.price_minor)}` : ""}
                      </p>
                      {appt.guest_phone && (
                        <p className="text-xs font-mono text-foreground/80 mt-1">{appt.guest_phone}</p>
                      )}
                      {appt.notes && <p className="text-xs text-muted mt-1">{appt.notes}</p>}
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide px-2 py-1 rounded border border-border text-muted">
                      {STATUS_LABELS[appt.status] ?? appt.status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {appt.status === "scheduled" && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatus(appt.id, "in_chair")}
                          disabled={isPending}
                          className={btnPrimary}
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatus(appt.id, "no_show")}
                          disabled={isPending}
                          className={btnOutline}
                        >
                          No-show
                        </button>
                      </div>
                    )}
                    {appt.status === "in_chair" && (
                      <button
                        type="button"
                        onClick={() => handleStatus(appt.id, "completed")}
                        disabled={isPending}
                        className={`${btnPrimary} w-full`}
                      >
                        Complete
                      </button>
                    )}
                    {appt.status !== "canceled" && appt.status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => handleCancel(appt.id)}
                        disabled={isPending}
                        className={`${btnOutline} w-full`}
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
      </section>
    </div>
  );
}
