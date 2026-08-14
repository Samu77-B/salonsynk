"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import {
  createNailAppointment,
  updateNailAppointmentStatus,
  deleteNailAppointment,
} from "./actions";
import type { NailAppointment, NailBookingMember, NailBookingService } from "./data";
import { formatDurationMinutes } from "@/lib/format-duration";

type Props = {
  date: string;
  appointments: NailAppointment[];
  upcomingAppointments: NailAppointment[];
  members: NailBookingMember[];
  services: NailBookingService[];
};

const fieldClass =
  "w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";
const btnPrimary =
  "rounded-lg bg-accent px-3 py-2.5 text-xs sm:text-sm font-medium text-background hover:opacity-90 disabled:opacity-50";
const btnOutline =
  "rounded-lg border border-border px-3 py-2.5 text-xs sm:text-sm font-medium hover:bg-canvas disabled:opacity-50";

function formatAppointmentWhen(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timePart = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

function formatPrice(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  no_show: "No-show",
  canceled: "Canceled",
};

export function AppointmentsView({
  date,
  appointments,
  upcomingAppointments,
  members,
  services,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const technicians = members.filter((m) => m.display_name);
  const scheduled = appointments.filter((a) => a.status === "scheduled").length;
  const done = appointments.filter((a) => a.status === "completed").length;
  const noShows = appointments.filter((a) => a.status === "no_show").length;

  function changeDate(newDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", newDate);
    router.push(`/nail/appointments?${params.toString()}`);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("date", date);
    startTransition(async () => {
      try {
        const result = await createNailAppointment(fd);
        if (result?.error) {
          setError(result.error);
          return;
        }
        setShowForm(false);
        router.refresh();
      } catch (err) {
        console.error("handleCreate booking failed:", err);
        setError("Could not save booking. Please try again.");
      }
    });
  }

  function handleStatus(id: string, status: NailAppointment["status"]) {
    startTransition(async () => {
      const result = await updateNailAppointmentStatus(id, status);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleCancel(id: string) {
    startTransition(async () => {
      const result = await deleteNailAppointment(id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border bg-surface px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] sm:text-xs text-muted leading-tight">Scheduled</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5">{scheduled}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] sm:text-xs text-muted leading-tight">Completed</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5">{done}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] sm:text-xs text-muted leading-tight">No-show</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5">{noShows}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-foreground/[0.04] transition-colors"
          aria-expanded={showForm}
        >
          <span className="text-sm font-semibold">New Booking</span>
          <svg
            className={`h-4 w-4 text-muted transition-transform duration-200 ${showForm ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showForm ? (
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
              <label className="block text-xs text-muted mb-1.5">Technician *</label>
              {technicians.length === 0 ? (
                <p className="text-sm text-muted rounded-lg border border-border px-3 py-2.5">
                  Add active team members in Team settings to book appointments.
                </p>
              ) : (
                <select name="technician_id" required className={fieldClass}>
                  <option value="">Select…</option>
                  {technicians.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                      {m.station_number ? ` (Station ${m.station_number})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">Service</label>
              {services.length === 0 ? (
                <p className="text-sm text-muted rounded-lg border border-border px-3 py-2.5 mb-2">
                  Add services in Services settings, or book a general appointment below.
                </p>
              ) : null}
              <select name="service_id" className={fieldClass}>
                <option value="">General appointment (30 min)</option>
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
            <button
              type="submit"
              disabled={isPending || technicians.length === 0}
              className={`w-full ${btnPrimary} py-3`}
            >
              {isPending ? "Saving…" : "Save booking"}
            </button>
          </form>
        ) : null}
      </div>

      {upcomingAppointments.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-2.5">
            Upcoming ({upcomingAppointments.length})
          </h2>
          <ul className="space-y-2.5">
            {upcomingAppointments.map((appt) => {
              const technician = members.find((m) => m.id === appt.technician_id);
              const service = services.find((s) => s.id === appt.service_id);
              return (
                <li
                  key={`upcoming-${appt.id}`}
                  className="rounded-xl border border-border bg-surface p-3.5 sm:p-4"
                >
                  <p className="text-sm font-semibold tabular-nums">{formatAppointmentWhen(appt.start_time)}</p>
                  <p className="text-sm font-medium mt-1 truncate">{appt.guest_name ?? "—"}</p>
                  <p className="text-xs text-muted mt-1">
                    {technician?.display_name ?? "Technician"}
                    {service ? ` · ${service.name}` : ""}
                    {appt.guest_phone ? ` · ${appt.guest_phone}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {error && (
        <p className="text-sm text-red-400 rounded-xl border border-border bg-surface px-3 py-2">{error}</p>
      )}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest mb-2.5">
          Bookings ({appointments.length})
        </h2>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center rounded-xl border border-border bg-surface">
            No bookings for this day.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {appointments.map((appt) => {
              const technician = members.find((m) => m.id === appt.technician_id);
              const service = services.find((s) => s.id === appt.service_id);

              return (
                <li key={appt.id} className="rounded-xl border border-border bg-surface p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {formatAppointmentWhen(appt.start_time)}
                        </span>
                        <span className="text-sm font-semibold truncate">{appt.guest_name ?? "—"}</span>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {technician?.display_name ?? "Technician"}
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

                  {appt.status === "scheduled" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatus(appt.id, "completed")}
                          disabled={isPending}
                          className={btnPrimary}
                        >
                          Complete
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
                      <button
                        type="button"
                        onClick={() => handleCancel(appt.id)}
                        disabled={isPending}
                        className={`${btnOutline} w-full`}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
