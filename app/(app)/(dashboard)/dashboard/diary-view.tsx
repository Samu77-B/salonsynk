"use client";

import { useState, useMemo } from "react";
import { createAppointment, updateAppointment, deleteAppointment } from "./actions";
import { AddAppointmentModal } from "./add-appointment-modal";
import { getAllowedSlots, validateMove, rangeToMinutes, type TimeRange } from "@/lib/diary-rules";

type Member = { id: string; display_name: string | null; role: string };
type Service = { id: string; name: string; duration_minutes: number };
type Client = { id: string; name: string | null; email: string | null; phone: string | null };
type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  client_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  stylist_id: string;
  service_id: string | null;
  clients: { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null;
  services: { name: string; duration_minutes: number } | { name: string; duration_minutes: number }[] | null;
  salon_members: { display_name: string | null } | { display_name: string | null }[] | null;
};

const VIEWS = ["day", "week"] as const;
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am–8pm

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}:00`;
}

export function DiaryView({
  salonId,
  salonName,
  members,
  services,
  clients,
  appointments,
}: {
  salonId: string;
  salonName: string;
  members: Member[];
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
}) {
  const [view, setView] = useState<"day" | "week">("day");
  const [currentDate, setCurrentDate] = useState(() => formatDate(new Date()));
  const [filterStylistId, setFilterStylistId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateObj = useMemo(() => new Date(currentDate + "T12:00:00"), [currentDate]);

  const filteredAppointments = useMemo(() => {
    let list = appointments.filter((a) => a.status === "scheduled" || a.status === "completed");
    if (filterStylistId) list = list.filter((a) => a.stylist_id === filterStylistId);
    const dayStart = new Date(dateObj);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + (view === "day" ? 1 : 7));
    return list.filter((a) => {
      const s = new Date(a.start_time);
      return s >= dayStart && s < dayEnd;
    });
  }, [appointments, filterStylistId, dateObj, view]);

  const daysToShow = view === "day" ? [dateObj] : Array.from({ length: 7 }, (_, i) => {
    const d = new Date(dateObj);
    d.setDate(d.getDate() - dateObj.getDay() + i);
    return d;
  });

  function getRangesForDay(day: Date, stylistId: string, excludeId?: string): TimeRange[] {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayStr = formatDate(day);
    return filteredAppointments
      .filter((a) => a.stylist_id === stylistId && formatDate(new Date(a.start_time)) === dayStr && a.id !== excludeId)
      .map((a) => {
        const start = new Date(a.start_time);
        const end = new Date(a.end_time);
        return {
          startMinutes: (start.getTime() - dayStart.getTime()) / 60000,
          endMinutes: (end.getTime() - dayStart.getTime()) / 60000,
        };
      })
      .filter((r) => r.startMinutes >= 0 && r.endMinutes <= 24 * 60);
  }

  async function handleReschedule(appointmentId: string, newStart: Date, newEnd: Date) {
    setError(null);
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return;
    const day = new Date(newStart);
    day.setHours(0, 0, 0, 0);
    const othersExcludingThis = getRangesForDay(day, appointment.stylist_id, appointmentId);
    const newStartM = (newStart.getTime() - day.getTime()) / 60000;
    const newEndM = (newEnd.getTime() - day.getTime()) / 60000;
    const validation = validateMove(othersExcludingThis, newStartM, newEndM);
    if (!validation.valid) {
      setError(validation.message ?? "Invalid move");
      return;
    }
    const result = await updateAppointment(appointmentId, {
      start_time: toLocalISO(newStart),
      end_time: toLocalISO(newEnd),
    });
    if (result.error) setError(result.error);
    else setMovingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this appointment?")) return;
    setError(null);
    const result = await deleteAppointment(id);
    if (result.error) setError(result.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{salonName}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(currentDate + "T12:00:00");
              d.setDate(d.getDate() - (view === "day" ? 1 : 7));
              setCurrentDate(formatDate(d));
            }}
            className="rounded-lg border border-border px-3 py-1 text-sm"
          >
            Prev
          </button>
          <span className="text-sm text-muted min-w-[140px] text-center">
            {view === "day"
              ? dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
              : `${daysToShow[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${daysToShow[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
          </span>
          <button
            onClick={() => {
              const d = new Date(currentDate + "T12:00:00");
              d.setDate(d.getDate() + (view === "day" ? 1 : 7));
              setCurrentDate(formatDate(d));
            }}
            className="rounded-lg border border-border px-3 py-1 text-sm"
          >
            Next
          </button>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as "day" | "week")}
            className="rounded-lg border border-border bg-background px-3 py-1 text-sm"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
          <select
            value={filterStylistId ?? ""}
            onChange={(e) => setFilterStylistId(e.target.value || null)}
            className="rounded-lg border border-border bg-background px-3 py-1 text-sm"
          >
            <option value="">All stylists</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || m.role}
              </option>
            ))}
          </select>
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Add appointment
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-16 p-2 text-left text-muted">Time</th>
              {daysToShow.map((d) => (
                <th key={d.toISOString()} className="p-2 text-left text-muted">
                  {d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour} className="border-b border-border/50">
                <td className="p-2 text-muted">{hour}:00</td>
                {daysToShow.map((day) => {
                  const cellStart = new Date(day);
                  cellStart.setHours(hour, 0, 0, 0);
                  const cellEnd = new Date(day);
                  cellEnd.setHours(hour + 1, 0, 0, 0);
                  const inCell = filteredAppointments.filter((a) => {
                    const s = new Date(a.start_time);
                    const e = new Date(a.end_time);
                    return s < cellEnd && e > cellStart && formatDate(s) === formatDate(day);
                  });
                  return (
                    <td
                      key={day.toISOString()}
                      className="relative h-12 align-top p-1"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain");
                        if (!id) return;
                        const apt = appointments.find((a) => a.id === id);
                        if (!apt) return;
                        const newStart = new Date(cellStart);
                        const durationMs =
                          new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
                        const newEnd = new Date(newStart.getTime() + durationMs);
                        handleReschedule(id, newStart, newEnd);
                      }}
                    >
                      {inCell.map((a) => {
                        const start = new Date(a.start_time);
                        const end = new Date(a.end_time);
                        const top = (start.getHours() - day.getHours() + start.getMinutes() / 60 - day.getMinutes() / 60) * 48;
                        const height = ((end.getTime() - start.getTime()) / 60000) * 0.8;
                        const client = Array.isArray(a.clients) ? a.clients[0] : a.clients;
                        const service = Array.isArray(a.services) ? a.services[0] : a.services;
                        const label = (client?.name || a.guest_name || "—") as string;
                        const sub = (service?.name || "") as string;
                        return (
                          <div
                            key={a.id}
                            draggable
                            onDragStart={(e) => {
                              setMovingId(a.id);
                              e.dataTransfer.setData("text/plain", a.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => setMovingId(null)}
                            className="absolute left-1 right-1 rounded border border-accent/50 bg-accent/20 px-2 py-1 cursor-move overflow-hidden"
                            style={{ top: `${top}px`, minHeight: `${Math.max(24, height)}px` }}
                          >
                            <span className="font-medium truncate block">{label}</span>
                            {sub && <span className="text-xs text-muted truncate block">{sub}</span>}
                            <div className="mt-1 flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(a.id)}
                                className="text-xs text-red-400 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">Drag appointments onto a time slot to reschedule. Use Add / Delete for new or remove.</p>

      {addOpen && (
        <AddAppointmentModal
          salonId={salonId}
          members={members}
          services={services}
          clients={clients}
          currentDate={currentDate}
          onCreate={async (data) => {
            const result = await createAppointment(data);
            if (result.error) setError(result.error);
            else setAddOpen(false);
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
