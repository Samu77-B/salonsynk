"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createAppointment, deleteAppointment } from "./actions";
import { AddAppointmentModal } from "./add-appointment-modal";
import { EditAppointmentModal } from "./edit-appointment-modal";
import { validateMoveWithProcessing, type AppointmentBlockingInput } from "@/lib/diary-rules";
import type { UpdateAppointmentInput } from "@/lib/appointments/patch-appointment";

/** Route Handler + JSON — avoids Next.js server-action digest errors on diary saves (status, drag, form). */
async function patchAppointmentViaApi(
  id: string,
  updates: UpdateAppointmentInput
): Promise<{ error: string | null }> {
  const res = await fetch(`/api/appointments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
    credentials: "same-origin",
  });
  let parsed: { error?: string | null } = {};
  try {
    parsed = (await res.json()) as { error?: string | null };
  } catch {
    return { error: "Could not read response from server." };
  }
  if (!res.ok) {
    const msg = parsed.error?.trim();
    return { error: msg || `Update failed (${res.status}).` };
  }
  return { error: parsed.error ?? null };
}

type Member = { id: string; display_name: string | null; role: string; calendar_color?: string | null };
type Service = { id: string; name: string; duration_minutes: number; processing_time_minutes?: number };
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
  deposit_payment_intent_id?: string | null;
  before_photo_url?: string | null;
  after_photo_url?: string | null;
  send_reminder_sms?: boolean;
  send_review_request?: boolean;
  send_aftercare?: boolean;
  clients: { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null;
  services:
    | { name: string; duration_minutes: number; processing_time_minutes?: number }
    | { name: string; duration_minutes: number; processing_time_minutes?: number }[]
    | null;
  salon_members: { display_name: string | null } | { display_name: string | null }[] | null;
};

const DIARY_VISIBLE_STATUSES = ["scheduled", "completed", "canceled", "no_show"] as const;

function isDiaryVisibleStatus(status: string): boolean {
  return (DIARY_VISIBLE_STATUSES as readonly string[]).includes(status);
}

function appointmentAllowsDrag(status: string): boolean {
  return status !== "canceled" && status !== "no_show";
}

type AppointmentStatusBadge = { label: string; className: string };

/** Colour-coded tag on each card so completed / cancelled / no-show are obvious at a glance; scheduled = still to finish. */
function appointmentStatusBadge(status: string): AppointmentStatusBadge {
  // Dark, mostly opaque pill + light text so labels stay readable on stylist-tinted card backgrounds.
  const shell =
    "shadow-sm ring-1 ring-black/20 dark:ring-white/15 border bg-black/80 backdrop-blur-[2px]";
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: `${shell} border-emerald-400/70 text-emerald-200`,
      };
    case "canceled":
      return {
        label: "Cancelled",
        className: `${shell} border-zinc-500/70 text-zinc-200`,
      };
    case "no_show":
      return {
        label: "No-show",
        className: `${shell} border-amber-400/70 text-amber-200`,
      };
    default:
      return {
        label: "Scheduled",
        className: `${shell} border-sky-400/70 text-sky-200`,
      };
  }
}

function appointmentTitleStruckThrough(status: string): boolean {
  return status === "canceled" || status === "no_show";
}

const MIN_COL_PX = 108;

/** Defer refresh until after React finishes closing modals (avoids RSC race errors after server actions). */
function scheduleRouterRefresh(router: { refresh: () => void }) {
  queueMicrotask(() => {
    try {
      router.refresh();
    } catch (e) {
      console.error("[DiaryView] router.refresh failed", e);
    }
  });
}

function formatDate(d: Date) {
  const time = d.getTime();
  if (!Number.isFinite(time)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function minutesSinceDayStart(d: Date, day: Date): number {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  return (d.getTime() - dayStart.getTime()) / 60000;
}

/** Greedy lane packing: max concurrent = laneCount; each id gets lane index 0..laneCount-1. */
function assignOverlapLanes(
  items: { id: string; startMin: number; endMin: number }[]
): Map<string, { lane: number; laneCount: number }> {
  if (items.length === 0) return new Map();
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const laneEnd: number[] = [];
  const laneById = new Map<string, number>();
  for (const it of sorted) {
    let lane = -1;
    for (let i = 0; i < laneEnd.length; i++) {
      if (laneEnd[i] <= it.startMin) {
        lane = i;
        break;
      }
    }
    if (lane === -1) {
      lane = laneEnd.length;
      laneEnd.push(it.endMin);
    } else {
      laneEnd[lane] = it.endMin;
    }
    laneById.set(it.id, lane);
  }
  const laneCount = Math.max(1, laneEnd.length);
  const out = new Map<string, { lane: number; laneCount: number }>();
  for (const it of items) {
    out.set(it.id, { lane: laneById.get(it.id)!, laneCount });
  }
  return out;
}

function blockingInputsForStylistOnDay(
  allAppointments: Appointment[],
  day: Date,
  stylistId: string
): AppointmentBlockingInput[] {
  const dayStr = formatDate(day);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  return allAppointments
    .filter(
      (a) =>
        a.stylist_id === stylistId &&
        formatDate(new Date(a.start_time)) === dayStr &&
        (a.status === "scheduled" || a.status === "completed")
    )
    .map((a) => {
      const start = parseDate(a.start_time);
      const end = parseDate(a.end_time);
      if (!start || !end) return null;
      const startM = (start.getTime() - dayStart.getTime()) / 60000;
      const endM = (end.getTime() - dayStart.getTime()) / 60000;
      const svc = Array.isArray(a.services) ? a.services[0] : a.services;
      const proc = svc?.processing_time_minutes ?? 0;
      return {
        id: a.id,
        startMinutes: startM,
        endMinutes: endM,
        processingMinutes: Number(proc) || 0,
      };
    })
    .filter((v): v is AppointmentBlockingInput => v !== null);
}

/** Same clock time on a different calendar day (local). */
function sameLocalTimeOnDay(source: Date, targetDay: Date): Date {
  const d = new Date(targetDay);
  d.setHours(0, 0, 0, 0);
  d.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  return d;
}

export function DiaryView({
  salonId,
  salonName,
  members,
  services,
  clients,
  appointments,
  clientPhotoMap = {},
}: {
  salonId: string;
  salonName: string;
  members: Member[];
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  clientPhotoMap?: Record<string, string>;
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

  const daysToShow = useMemo(
    () =>
      view === "day"
        ? [dateObj]
        : Array.from({ length: 7 }, (_, i) => {
            const d = new Date(dateObj);
            d.setDate(d.getDate() - dateObj.getDay() + i);
            return d;
          }),
    [view, dateObj]
  );

  const filteredAppointments = useMemo(() => {
    let list = appointments.filter((a) => isDiaryVisibleStatus(a.status));
    if (filterStylistId) list = list.filter((a) => a.stylist_id === filterStylistId);
    const dayStart = new Date(daysToShow[0]);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(daysToShow[daysToShow.length - 1]);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(0, 0, 0, 0);
    return list.filter((a) => {
      const s = parseDate(a.start_time);
      if (!s) return false;
      return s >= dayStart && s < dayEnd;
    });
  }, [appointments, filterStylistId, daysToShow]);

  const visibleMembers = useMemo(
    () => (filterStylistId ? members.filter((m) => m.id === filterStylistId) : members),
    [members, filterStylistId]
  );

  async function handleRescheduleWithStylist(
    appointmentId: string,
    newStart: Date,
    newEnd: Date,
    targetStylistId: string
  ) {
    setError(null);
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return;
    const day = new Date(newStart);
    day.setHours(0, 0, 0, 0);
    const blocking = blockingInputsForStylistOnDay(appointments, day, targetStylistId);
    const newStartM = (newStart.getTime() - day.getTime()) / 60000;
    const newEndM = (newEnd.getTime() - day.getTime()) / 60000;
    const svc = Array.isArray(appointment.services) ? appointment.services[0] : appointment.services;
    const proc = Number(svc?.processing_time_minutes) || 0;
    const validation = validateMoveWithProcessing(blocking, appointment.id, newStartM, newEndM, proc);
    if (!validation.valid) {
      setError(validation.message ?? "Invalid move");
      return;
    }
    const updates: { start_time: string; end_time: string; stylist_id?: string } = {
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    };
    if (targetStylistId !== appointment.stylist_id) {
      updates.stylist_id = targetStylistId;
    }
    const result = await patchAppointmentViaApi(appointmentId, updates);
    if (result.error) setError(result.error);
    else {
      setMovingId(null);
      scheduleRouterRefresh(router);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this appointment?")) return;
    setError(null);
    const result = await deleteAppointment(id);
    if (result.error) setError(result.error);
  }

  const todayStr = formatDate(new Date());
  const dayHeaderPrefix = filterStylistId
    ? (() => {
        const m = members.find((x) => x.id === filterStylistId);
        const name = m?.display_name || m?.role;
        return name ? `${name} — ` : "";
      })()
    : "All stylists — ";

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="min-w-0 truncate text-xl font-bold sm:text-2xl">{salonName}</h1>
        <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2 sm:w-auto sm:items-center">
          <button
            type="button"
            onClick={() => {
              const d = new Date(currentDate + "T12:00:00");
              d.setDate(d.getDate() - (view === "day" ? 1 : 7));
              setCurrentDate(formatDate(d));
            }}
            className="min-h-[44px] rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
          >
            Prev
          </button>
          <span className="min-w-0 shrink-0 text-center text-xs font-medium text-muted sm:min-w-[160px] sm:text-sm md:min-w-[180px]">
            {view === "day"
              ? daysToShow[0].toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
              : `${daysToShow[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${daysToShow[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
          </span>
          <button
            type="button"
            onClick={() => {
              const d = new Date(currentDate + "T12:00:00");
              d.setDate(d.getDate() + (view === "day" ? 1 : 7));
              setCurrentDate(formatDate(d));
            }}
            className="min-h-[44px] rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(formatDate(new Date()))}
            className="min-h-[44px] rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
          >
            Today
          </button>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as "day" | "week")}
            aria-label="View"
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm sm:min-w-[5.5rem] sm:flex-none sm:px-3"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
          <select
            value={filterStylistId ?? ""}
            onChange={(e) => setFilterStylistId(e.target.value || null)}
            aria-label="Filter by stylist"
            className="min-h-[44px] min-w-0 flex-[1_1_100%] rounded-lg border border-border bg-background px-2 py-2 text-sm sm:max-w-[220px] sm:flex-1 sm:flex-none sm:px-3"
          >
            <option value="">All stylists</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || m.role}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity w-full sm:w-auto"
          >
            Add appointment
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 px-1">{error}</p>}

      {view === "day" ? (
        <div className="rounded-xl border-2 border-border bg-background shadow-sm overflow-hidden">
          <div className="border-b-2 border-border bg-muted/30 px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">
                  {dayHeaderPrefix}
                  {daysToShow[0].toLocaleDateString("en-GB", { weekday: "long", month: "long", day: "numeric" })}
                </div>
                <div className="text-xs leading-snug text-muted">
                  One column per stylist. Drag onto a column and time to reschedule (or move to another stylist).
                </div>
              </div>
              {formatDate(daysToShow[0]) === todayStr && (
                <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-xs font-medium shrink-0">
                  Today
                </span>
              )}
            </div>
          </div>

          {members.length === 0 ? (
            <div className="p-4 text-sm text-muted">Add a team member first.</div>
          ) : visibleMembers.length === 0 ? (
            <div className="p-4 text-sm text-muted">No stylist selected.</div>
          ) : (
            (() => {
              const day = daysToShow[0];
              const startHour = 6;
              const endHour = 19;
              const pxPerMin = 1.1;
              const gutterW = 88;
              const nCols = visibleMembers.length;
              const minTotalW = gutterW + nCols * MIN_COL_PX;
              const heightPx = (endHour - startHour + 1) * 60 * pxPerMin;

              return (
                <div className="overflow-x-auto">
                  <div className="flex border-b-2 border-borderGrid bg-muted/20" style={{ minWidth: `${minTotalW}px` }}>
                    <div style={{ width: `${gutterW}px` }} className="shrink-0" aria-hidden />
                    {visibleMembers.map((m) => {
                      const c = stylistColorMap[m.id] || "#16a34a";
                      return (
                        <div
                          key={m.id}
                          className="flex-1 min-w-[100px] border-l-2 border-borderGrid px-2 py-2 text-center"
                        >
                          <span
                            className="inline-block h-2 w-2 rounded-full align-middle mr-1.5"
                            style={{ backgroundColor: c }}
                            aria-hidden
                          />
                          <span className="text-xs font-semibold truncate align-middle">
                            {m.display_name || m.role}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="relative" style={{ minWidth: `${minTotalW}px`, height: `${heightPx}px` }}>
                    {Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i).map((h) => {
                      const top = (h - startHour) * 60 * pxPerMin;
                      return (
                        <div key={h} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${top}px` }}>
                          <div className="absolute left-0" style={{ width: `${gutterW}px` }}>
                            <div className="pl-4 pr-2 text-xs text-muted leading-6">
                              {new Date(0, 0, 0, h, 0).toLocaleTimeString("en-GB", { hour: "numeric" })}
                            </div>
                          </div>
                          <div
                            className="absolute left-0 right-0 border-t-2 border-borderGrid"
                            style={{ marginLeft: `${gutterW}px` }}
                          />
                        </div>
                      );
                    })}

                    <div
                      className="absolute flex inset-0"
                      style={{ marginLeft: `${gutterW}px` }}
                    >
                      {visibleMembers.map((member) => {
                        const colAppts = filteredAppointments.filter((a) => a.stylist_id === member.id);
                        const laneInputs = colAppts
                          .map((a) => {
                            const start = parseDate(a.start_time);
                            const end = parseDate(a.end_time);
                            if (!start || !end) return null;
                            return {
                              id: a.id,
                              startMin: minutesSinceDayStart(start, day),
                              endMin: minutesSinceDayStart(end, day),
                            };
                          })
                          .filter((v): v is { id: string; startMin: number; endMin: number } => v !== null);
                        const lanes = assignOverlapLanes(laneInputs);

                        return (
                          <div
                            key={member.id}
                            className="relative flex-1 min-w-[100px] border-l-2 border-borderGrid first:border-l-0"
                          >
                            <div
                              className="absolute inset-0 z-0"
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
                                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                const y = e.clientY - rect.top;
                                const minsFromStart = Math.max(
                                  0,
                                  Math.min(
                                    (endHour - startHour + 1) * 60,
                                    Math.round(y / pxPerMin / 15) * 15
                                  )
                                );
                                const newStart = new Date(day);
                                newStart.setHours(startHour, 0, 0, 0);
                                newStart.setMinutes(newStart.getMinutes() + minsFromStart);
                                const durationMs =
                                  new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
                                const newEnd = new Date(newStart.getTime() + durationMs);
                                void handleRescheduleWithStylist(id, newStart, newEnd, member.id);
                              }}
                            />
                            {colAppts.map((a) => {
                              const start = parseDate(a.start_time);
                              const end = parseDate(a.end_time);
                              if (!start || !end) return null;
                              const topMins = minutesSinceDayStart(start, day) - startHour * 60;
                              const durMins = (end.getTime() - start.getTime()) / 60000;
                              const top = Math.max(0, topMins) * pxPerMin;
                              const height = Math.max(44, durMins * pxPerMin);
                              const svc = Array.isArray(a.services) ? a.services[0] : a.services;
                              const client = Array.isArray(a.clients) ? a.clients[0] : a.clients;
                              const phone = client?.phone ?? a.guest_phone ?? "";
                              const label = client?.name || a.guest_name || "Walk-in";
                              const serviceName = svc?.name || "Service";
                              const color = stylistColorMap[a.stylist_id] || "#16a34a";
                              const lane = lanes.get(a.id) ?? { lane: 0, laneCount: 1 };
                              const { lane: li, laneCount: lc } = lane;
                              const pct = 100 / lc;
                              const gap = 3;
                              const drag = appointmentAllowsDrag(a.status);
                              const statusBadge = appointmentStatusBadge(a.status);
                              const muted = a.status === "canceled" || a.status === "no_show";
                              const titleStrike = appointmentTitleStruckThrough(a.status);

                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => setEditId(a.id)}
                                  draggable={drag}
                                  onDragStart={(e) => {
                                    if (!drag) {
                                      e.preventDefault();
                                      return;
                                    }
                                    setMovingId(a.id);
                                    e.dataTransfer.setData("text/plain", a.id);
                                    e.dataTransfer.effectAllowed = "move";
                                  }}
                                  onDragEnd={() => setMovingId(null)}
                                  className={`absolute z-10 text-left rounded-lg border shadow-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/40 touch-manipulation min-h-[44px] ${titleStrike ? "line-through decoration-foreground/50" : ""}`}
                                  style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    left: `calc(${li * pct}% + ${gap / 2}px)`,
                                    width: `calc(${pct}% - ${gap}px)`,
                                    borderColor: `${color}99`,
                                    backgroundColor: `${color}22`,
                                    opacity: movingId === a.id ? 0.7 : muted ? 0.65 : 1,
                                  }}
                                >
                                  <span
                                    className={`mb-1 inline-block shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadge.className}`}
                                  >
                                    {statusBadge.label}
                                  </span>
                                  <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                                    {a.client_id && clientPhotoMap[a.client_id] && (
                                      <Image
                                        src={clientPhotoMap[a.client_id]}
                                        alt=""
                                        width={24}
                                        height={24}
                                        className="h-6 w-6 rounded-full object-cover shrink-0"
                                      />
                                    )}
                                    <span className="truncate min-w-0">
                                      {formatTime(start)}–{formatTime(end)} · {label}
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-medium text-foreground/90 truncate dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]">
                                    {serviceName}
                                  </div>
                                  {phone && lc <= 2 && (
                                    <div className="text-[10px] font-medium text-foreground/90 truncate dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]">
                                      {phone}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-border bg-background shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b-2 border-border bg-muted/30">
            <p className="text-xs text-muted">
              Week view: each day lists appointments in time order. Drag a card onto another day to move it (same time of day). Day view is best for dragging between stylists.
            </p>
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {daysToShow.map((day) => {
              const dayStr = formatDate(day);
              const dayList = filteredAppointments
                .filter((a) => {
                  const s = parseDate(a.start_time);
                  return s !== null && formatDate(s) === dayStr;
                })
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

              return (
                <div
                  key={dayStr}
                  className="rounded-lg border-2 border-border bg-muted/10 flex flex-col min-h-[120px]"
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
                    const s = parseDate(apt.start_time);
                    const en = parseDate(apt.end_time);
                    if (!s || !en) return;
                    const newStart = sameLocalTimeOnDay(s, day);
                    const newEnd = new Date(newStart.getTime() + (en.getTime() - s.getTime()));
                    void handleRescheduleWithStylist(id, newStart, newEnd, apt.stylist_id);
                  }}
                >
                  <div className="px-2 py-2 border-b-2 border-border bg-muted/20 shrink-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold">
                        {day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                      {dayStr === todayStr && (
                        <span className="text-[10px] rounded-full bg-accent/15 text-accent px-1.5 py-0.5 font-medium">
                          Today
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted">Drop here to move day</span>
                  </div>
                  <div className="p-2 space-y-2 flex-1 min-h-0 overflow-y-auto max-h-[min(420px,55vh)]">
                    {dayList.length === 0 ? (
                      <p className="text-xs text-muted py-2">No appointments</p>
                    ) : (
                      dayList.map((a) => {
                        const start = parseDate(a.start_time);
                        const end = parseDate(a.end_time);
                        if (!start || !end) return null;
                        const svc = Array.isArray(a.services) ? a.services[0] : a.services;
                        const client = Array.isArray(a.clients) ? a.clients[0] : a.clients;
                        const label = client?.name || a.guest_name || "Walk-in";
                        const serviceName = svc?.name || "Service";
                        const color = stylistColorMap[a.stylist_id] || "#16a34a";
                        const stylistName =
                          members.find((m) => m.id === a.stylist_id)?.display_name ||
                          members.find((m) => m.id === a.stylist_id)?.role ||
                          "";
                        const drag = appointmentAllowsDrag(a.status);
                        const statusBadge = appointmentStatusBadge(a.status);
                        const muted = a.status === "canceled" || a.status === "no_show";
                        const titleStrike = appointmentTitleStruckThrough(a.status);

                        return (
                          <div
                            key={a.id}
                            draggable={drag}
                            onDragStart={(e) => {
                              if (!drag) {
                                e.preventDefault();
                                return;
                              }
                              setMovingId(a.id);
                              e.dataTransfer.setData("text/plain", a.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => setMovingId(null)}
                            className={`rounded-lg border px-2 py-2.5 min-h-[44px] ${drag ? "cursor-grab active:cursor-grabbing" : ""}`}
                            style={{
                              borderColor: `${color}99`,
                              backgroundColor: `${color}18`,
                              opacity: movingId === a.id ? 0.75 : muted ? 0.65 : 1,
                            }}
                          >
                            <span
                              className={`mb-1.5 inline-block shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadge.className}`}
                            >
                              {statusBadge.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditId(a.id)}
                              className="w-full text-left"
                            >
                              <div className="flex items-start gap-2">
                                {a.client_id && clientPhotoMap[a.client_id] ? (
                                  <Image
                                    src={clientPhotoMap[a.client_id]}
                                    alt=""
                                    width={36}
                                    height={36}
                                    className="h-9 w-9 rounded-full object-cover shrink-0 mt-0.5"
                                  />
                                ) : (
                                  <div
                                    className="h-9 w-9 rounded-full shrink-0 mt-0.5 bg-muted/40 border-2 border-border"
                                    aria-hidden
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-foreground">
                                    {formatTime(start)}–{formatTime(end)}
                                  </div>
                                  <div
                                    className={`text-sm font-medium truncate ${titleStrike ? "line-through decoration-foreground/50" : ""}`}
                                  >
                                    {label}
                                  </div>
                                  <div className="text-xs font-medium text-foreground/90 truncate">{serviceName}</div>
                                  {!filterStylistId && stylistName && (
                                    <div className="text-[10px] font-medium text-foreground/85 truncate mt-0.5">
                                      {stylistName}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                            <div className="flex gap-2 mt-2 pt-2 border-t-2 border-border">
                              <button
                                type="button"
                                onClick={() => setEditId(a.id)}
                                className="text-xs text-accent hover:underline touch-manipulation"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(a.id)}
                                className="text-xs text-red-400 hover:underline touch-manipulation"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted px-1">
        Day: drag a booking onto another stylist column or time. Week: drag onto a day column. Add / Edit / Delete as before.
      </p>

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
            else {
              setAddOpen(false);
              scheduleRouterRefresh(router);
            }
            return result;
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
              const result = await patchAppointmentViaApi(id, data);
              if (result.error) setError(result.error);
              else {
                setEditId(null);
                scheduleRouterRefresh(router);
              }
              return result;
            }}
            onDelete={(id) => {
              setEditId(null);
              void handleDelete(id);
            }}
            onClose={() => setEditId(null)}
            onNoShowCharged={() => scheduleRouterRefresh(router)}
          />
        );
      })()}
    </div>
  );
}
