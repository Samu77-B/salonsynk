"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createAppointment, updateAppointment, deleteAppointment } from "./actions";
import { AddAppointmentModal } from "./add-appointment-modal";
import { EditAppointmentModal } from "./edit-appointment-modal";
import { getAllowedSlots, validateMove, rangeToMinutes, type TimeRange } from "@/lib/diary-rules";

type Member = { id: string; display_name: string | null; role: string; calendar_color?: string | null };
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
  send_reminder_sms?: boolean;
  send_review_request?: boolean;
  send_aftercare?: boolean;
  clients: { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null;
  services: { name: string; duration_minutes: number } | { name: string; duration_minutes: number }[] | null;
  salon_members: { display_name: string | null } | { display_name: string | null }[] | null;
};

const VIEWS = ["day", "week"] as const;
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6am–8pm
// 15-minute slots: 6:00–20:00 (56 slots)
const SLOTS_15MIN = Array.from({ length: 56 }, (_, i) => {
  const totalMins = 6 * 60 + i * 15;
  return { hour: Math.floor(totalMins / 60), minute: totalMins % 60 };
});

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function AppointmentBlock({
  a,
  cellStart,
  members,
  stylistColorMap,
  appointments,
  onReschedule,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  slotIndex = 0,
  slotCount = 1,
}: {
  a: Appointment;
  cellStart: Date;
  members: Member[];
  stylistColorMap: Record<string, string>;
  appointments: Appointment[];
  onReschedule: (id: string, newStart: Date, newEnd: Date) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  slotIndex?: number;
  slotCount?: number;
}) {
  const start = new Date(a.start_time);
  const end = new Date(a.end_time);
  const startOffset = (start.getTime() - cellStart.getTime()) / 60000;
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  const top = startOffset * 0.8;
  const height = durationMinutes * 0.8;
  const client = Array.isArray(a.clients) ? a.clients[0] : a.clients;
  const service = Array.isArray(a.services) ? a.services[0] : a.services;
  const stylist = members.find((m) => m.id === a.stylist_id)?.display_name;
  const label = (client?.name || a.guest_name || "—") as string;
  const sub = (service?.name || "") as string;
  const blockColor = stylistColorMap[a.stylist_id];
  const isRow = slotCount > 1;
  const isCompact = isRow;
  return (
    <div
      className={`rounded-lg border overflow-hidden border-accent/50 bg-accent/20 flex flex-col shadow-sm ${isRow ? "flex-1 min-w-0" : "absolute left-1 right-1"}`}
      style={
        isRow
          ? {
              padding: "4px 6px",
              ...(blockColor ? { borderColor: `${blockColor}99`, backgroundColor: `${blockColor}20` } : {}),
            }
          : {
              top: `${top}px`,
              minHeight: `${Math.max(48, height)}px`,
              padding: "4px 8px",
              ...(blockColor ? { borderColor: `${blockColor}99`, backgroundColor: `${blockColor}20` } : {}),
            }
      }
    >
      <div
        draggable
        onDragStart={(e) => {
          onDragStart?.();
          e.dataTransfer.setData("text/plain", a.id);
          e.dataTransfer.effectAllowed = "move";
          const el = e.currentTarget.parentElement;
          if (el) {
            const rect = el.getBoundingClientRect();
            e.dataTransfer.setDragImage(el, e.clientX - rect.left, e.clientY - rect.top);
          }
        }}
        onDragEnd={() => onDragEnd?.()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = e.dataTransfer.getData("text/plain");
          if (!id || id === a.id) return;
          const apt = appointments.find((ap) => ap.id === id);
          if (!apt) return;
          const newStart = new Date(cellStart);
          const durationMs = new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
          const newEnd = new Date(newStart.getTime() + durationMs);
          onReschedule(id, newStart, newEnd);
        }}
        className="flex-1 min-h-0 cursor-move"
      >
        <span className={`font-medium truncate block ${isCompact ? "text-xs" : ""}`}>{label}</span>
        {!isCompact && stylist && <span className="text-xs text-muted truncate block">{stylist}</span>}
        {!isCompact && sub && <span className="text-xs text-muted truncate block">{sub}</span>}
        {isCompact && (stylist || sub) && (
          <span className="text-[10px] text-muted truncate block">{[stylist, sub].filter(Boolean).join(" · ")}</span>
        )}
      </div>
      <div
        className={`flex gap-1 shrink-0 relative z-10 ${isCompact ? "mt-0.5" : "mt-1"}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-xs text-accent hover:underline touch-manipulation py-1 px-0.5 -my-1 -mx-0.5"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-xs text-red-400 hover:underline touch-manipulation py-1 px-0.5 -my-1 -mx-0.5"
        >
          Delete
        </button>
      </div>
    </div>
  );
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
  const [editId, setEditId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const dateObj = useMemo(() => new Date(currentDate + "T12:00:00"), [currentDate]);
  const stylistColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const member of members) {
      if (member.calendar_color) m[member.id] = member.calendar_color;
    }
    return m;
  }, [members]);

  const daysToShow = view === "day"
    ? Array.from({ length: 2 }, (_, i) => {
        const d = new Date(dateObj);
        d.setDate(d.getDate() + i);
        return d;
      })
    : Array.from({ length: 7 }, (_, i) => {
        const d = new Date(dateObj);
        d.setDate(d.getDate() - dateObj.getDay() + i);
        return d;
      });

  const filteredAppointments = useMemo(() => {
    let list = appointments.filter((a) => a.status === "scheduled" || a.status === "completed");
    if (filterStylistId) list = list.filter((a) => a.stylist_id === filterStylistId);
    const dayStart = new Date(daysToShow[0]);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(daysToShow[daysToShow.length - 1]);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(0, 0, 0, 0);
    return list.filter((a) => {
      const s = new Date(a.start_time);
      return s >= dayStart && s < dayEnd;
    });
  }, [appointments, filterStylistId, daysToShow]);

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
    else {
      setMovingId(null);
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this appointment?")) return;
    setError(null);
    const result = await deleteAppointment(id);
    if (result.error) setError(result.error);
  }

  const todayStr = formatDate(new Date());

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold truncate min-w-0">{salonName}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(currentDate + "T12:00:00");
              d.setDate(d.getDate() - (view === "day" ? 2 : 7));
              setCurrentDate(formatDate(d));
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-muted min-w-0 sm:min-w-[180px] text-center shrink-0 font-medium">
            {view === "day"
              ? `${daysToShow[0].toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} – ${daysToShow[1].toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`
              : `${daysToShow[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${daysToShow[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
          </span>
          <button
            onClick={() => {
              const d = new Date(currentDate + "T12:00:00");
              d.setDate(d.getDate() + (view === "day" ? 2 : 7));
              setCurrentDate(formatDate(d));
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
          >
            Next
          </button>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as "day" | "week")}
            aria-label="View"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="day">2 days</option>
            <option value="week">Week</option>
          </select>
          <select
            value={filterStylistId ?? ""}
            onChange={(e) => setFilterStylistId(e.target.value || null)}
            aria-label="Filter by stylist"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity w-full sm:w-auto"
          >
            Add appointment
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 px-1">{error}</p>
      )}

      {view === "day" ? (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {daysToShow.map((day) => {
            const dayStr = formatDate(day);
            const isToday = dayStr === todayStr;
            return (
              <div
                key={dayStr}
                className="flex-1 min-w-0 rounded-xl border border-border bg-background shadow-sm overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                    {isToday && (
                      <span className="rounded-full bg-accent/20 text-accent px-2 py-0.5 text-xs font-medium">
                        Today
                      </span>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[200px] border-collapse text-sm">
                    <tbody>
                      {SLOTS_15MIN.map((slot, idx) => {
                        const cellStart = new Date(day);
                        cellStart.setHours(slot.hour, slot.minute, 0, 0);
                        const cellEnd = new Date(cellStart);
                        cellEnd.setMinutes(cellEnd.getMinutes() + 15);
                        const inCell = filteredAppointments
                          .filter((a) => {
                            const s = new Date(a.start_time);
                            return s >= cellStart && s < cellEnd && formatDate(s) === dayStr;
                          })
                          .sort((a, b) => {
                            const sa = new Date(a.start_time).getTime();
                            const sb = new Date(b.start_time).getTime();
                            if (sa !== sb) return sa - sb;
                            const stylistA = members.find((m) => m.id === a.stylist_id)?.display_name ?? "";
                            const stylistB = members.find((m) => m.id === b.stylist_id)?.display_name ?? "";
                            return stylistA.localeCompare(stylistB);
                          });
                        const timeLabel = `${slot.hour}:${String(slot.minute).padStart(2, "0")}`;
                        return (
                          <tr key={idx} className="border-b border-border/30">
                            <td className="w-14 p-1 text-muted text-[10px] align-top">{timeLabel}</td>
                            <td
                              className="relative h-3 min-h-3 align-top p-0.5 overflow-visible"
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
                                const durationMs = new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
                                const newEnd = new Date(newStart.getTime() + durationMs);
                                handleReschedule(id, newStart, newEnd);
                              }}
                            >
                              {inCell.length > 1 ? (
                                <div
                                  className="flex flex-row gap-1 h-full min-h-[12px]"
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
                                    const durationMs = new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
                                    const newEnd = new Date(newStart.getTime() + durationMs);
                                    handleReschedule(id, newStart, newEnd);
                                  }}
                                >
                                  {inCell.map((a, idx) => (
                                    <AppointmentBlock
                                      key={a.id}
                                      a={a}
                                      cellStart={cellStart}
                                      members={members}
                                      stylistColorMap={stylistColorMap}
                                      appointments={appointments}
                                      onReschedule={handleReschedule}
                                      onEdit={() => setEditId(a.id)}
                                      onDelete={() => handleDelete(a.id)}
                                      onDragStart={() => setMovingId(a.id)}
                                      onDragEnd={() => setMovingId(null)}
                                      slotIndex={idx}
                                      slotCount={inCell.length}
                                    />
                                  ))}
                                </div>
                              ) : (
                                inCell.map((a, idx) => (
                                  <AppointmentBlock
                                    key={a.id}
                                    a={a}
                                    cellStart={cellStart}
                                    members={members}
                                    stylistColorMap={stylistColorMap}
                                    appointments={appointments}
                                    onReschedule={handleReschedule}
                                    onEdit={() => setEditId(a.id)}
                                    onDelete={() => handleDelete(a.id)}
                                    onDragStart={() => setMovingId(a.id)}
                                    onDragEnd={() => setMovingId(null)}
                                    slotIndex={idx}
                                    slotCount={inCell.length}
                                  />
                                ))
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-14 p-2 text-left text-muted font-medium text-xs">Time</th>
                {daysToShow.map((d) => (
                  <th key={d.toISOString()} className="p-2 text-left text-muted font-medium text-xs">
                    {d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS_15MIN.map((slot, idx) => {
                const timeLabel = `${slot.hour}:${String(slot.minute).padStart(2, "0")}`;
                return (
                <tr key={idx} className="border-b border-border/30">
                  <td className="p-1 text-muted text-[10px]">{timeLabel}</td>
                  {daysToShow.map((day) => {
                    const dayCellStart = new Date(day);
                    dayCellStart.setHours(slot.hour, slot.minute, 0, 0);
                    const dayCellEnd = new Date(dayCellStart);
                    dayCellEnd.setMinutes(dayCellEnd.getMinutes() + 15);
                    const inCell = filteredAppointments
                      .filter((a) => {
                        const s = new Date(a.start_time);
                        return s >= dayCellStart && s < dayCellEnd && formatDate(s) === formatDate(day);
                      })
                      .sort((a, b) => {
                        const sa = new Date(a.start_time).getTime();
                        const sb = new Date(b.start_time).getTime();
                        if (sa !== sb) return sa - sb;
                        const stylistA = members.find((m) => m.id === a.stylist_id)?.display_name ?? "";
                        const stylistB = members.find((m) => m.id === b.stylist_id)?.display_name ?? "";
                        return stylistA.localeCompare(stylistB);
                      });
                    return (
                      <td
                        key={day.toISOString()}
                        className="relative h-3 min-h-3 align-top p-0.5 overflow-visible"
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
                          const newStart = new Date(dayCellStart);
                          const durationMs = new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
                          const newEnd = new Date(newStart.getTime() + durationMs);
                          handleReschedule(id, newStart, newEnd);
                        }}
                      >
                        {inCell.length > 1 ? (
                          <div
                            className="flex flex-row gap-1 h-full min-h-[12px]"
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
                              const newStart = new Date(dayCellStart);
                              const durationMs = new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
                              const newEnd = new Date(newStart.getTime() + durationMs);
                              handleReschedule(id, newStart, newEnd);
                            }}
                          >
                            {inCell.map((a, idx) => (
                              <AppointmentBlock
                                key={a.id}
                                a={a}
                                cellStart={dayCellStart}
                                members={members}
                                stylistColorMap={stylistColorMap}
                                appointments={appointments}
                                onReschedule={handleReschedule}
                                onEdit={() => setEditId(a.id)}
                                onDelete={() => handleDelete(a.id)}
                                onDragStart={() => setMovingId(a.id)}
                                onDragEnd={() => setMovingId(null)}
                                slotIndex={idx}
                                slotCount={inCell.length}
                              />
                            ))}
                          </div>
                        ) : (
                          inCell.map((a, idx) => (
                            <AppointmentBlock
                              key={a.id}
                              a={a}
                              cellStart={dayCellStart}
                              members={members}
                              stylistColorMap={stylistColorMap}
                              appointments={appointments}
                              onReschedule={handleReschedule}
                              onEdit={() => setEditId(a.id)}
                              onDelete={() => handleDelete(a.id)}
                              onDragStart={() => setMovingId(a.id)}
                              onDragEnd={() => setMovingId(null)}
                              slotIndex={idx}
                              slotCount={inCell.length}
                            />
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted px-1">Drag appointments onto a time slot to reschedule. Use Add / Delete for new or remove.</p>

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

      {editId && (() => {
        const apt = appointments.find((a) => a.id === editId);
        if (!apt) return null;
        return (
          <EditAppointmentModal
            key={editId}
            appointment={apt}
            members={members}
            services={services}
            clients={clients}
            onUpdate={async (id, data) => {
              const result = await updateAppointment(id, data);
              if (result.error) setError(result.error);
              else {
                setEditId(null);
                router.refresh();
              }
            }}
            onClose={() => setEditId(null)}
          />
        );
      })()}
    </div>
  );
}
