"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { CreateAppointmentInput } from "./actions";
import { AddAppointmentModal } from "./add-appointment-modal";
import { EditAppointmentModal } from "./edit-appointment-modal";
import { validateMoveWithProcessing, type AppointmentBlockingInput } from "@/lib/diary-rules";
import type { UpdateAppointmentInput } from "@/lib/appointments/patch-appointment";

/** Route Handler + JSON — avoids Next.js server-action digest errors on diary saves (add, delete, status, drag, form). */
async function createAppointmentViaApi(
  data: CreateAppointmentInput
): Promise<{ error?: string | null; appointmentId?: string }> {
  const res = await fetch("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "same-origin",
  });
  let parsed: { error?: string | null; appointmentId?: string } = {};
  try {
    parsed = (await res.json()) as { error?: string | null; appointmentId?: string };
  } catch {
    return { error: "Could not read response from server." };
  }
  if (!res.ok) {
    const msg = parsed.error?.trim();
    return { error: msg || `Create failed (${res.status}).` };
  }
  return { error: parsed.error ?? null, appointmentId: parsed.appointmentId };
}

async function deleteAppointmentViaApi(id: string): Promise<{ error?: string | null }> {
  const res = await fetch(`/api/appointments/${encodeURIComponent(id)}`, {
    method: "DELETE",
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
    return { error: msg || `Delete failed (${res.status}).` };
  }
  return { error: parsed.error ?? null };
}

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

type Member = { id: string; display_name: string | null; role: string; avatar_url?: string | null };
type Service = { id: string; name: string; duration_minutes: number; processing_time_minutes?: number; color?: string | null };
type Client = { id: string; name: string | null; email: string | null; phone: string | null; last_skin_test_at?: string | null };
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
  change_charge_minor?: number;
  clients: { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null;
  services:
    | { name: string; duration_minutes: number; processing_time_minutes?: number }
    | { name: string; duration_minutes: number; processing_time_minutes?: number }[]
    | null;
  salon_members: { display_name: string | null } | { display_name: string | null }[] | null;
};

/** Build a diary row client-side after POST /api/appointments (avoids router.refresh() RSC digest issues). */
function buildCreatedAppointment(
  id: string,
  input: CreateAppointmentInput,
  members: Member[],
  services: Service[],
  clients: Client[]
): Appointment {
  const client = input.clientId ? clients.find((c) => c.id === input.clientId) : undefined;
  const service = input.serviceId ? services.find((s) => s.id === input.serviceId) : undefined;
  const stylist = members.find((m) => m.id === input.stylistId);
  return {
    id,
    start_time: input.startTime,
    end_time: input.endTime,
    status: "scheduled",
    notes: input.notes ?? null,
    client_id: input.clientId,
    guest_name: input.guestName ?? null,
    guest_email: input.guestEmail ?? null,
    guest_phone: input.guestPhone ?? null,
    stylist_id: input.stylistId,
    service_id: input.serviceId,
    send_reminder_sms: input.sendReminderSms,
    send_review_request: input.sendReviewRequest,
    send_aftercare: input.sendAftercare,
    clients: client ? { name: client.name, email: client.email, phone: client.phone } : null,
    services: service
      ? {
          name: service.name,
          duration_minutes: service.duration_minutes,
          processing_time_minutes: service.processing_time_minutes ?? 0,
        }
      : null,
    salon_members: stylist ? { display_name: stylist.display_name } : null,
  };
}

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

type ContextMenuState = {
  appointmentId: string;
  x: number;
  y: number;
  statusSubmenuOpen: boolean;
};

function DiaryContextMenu({
  menu,
  onClose,
  onMarkStatus,
  onMakeSale,
  onRunningLate,
  onToggleStatusSubmenu,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onMarkStatus: (status: string) => void;
  onMakeSale: () => void;
  onRunningLate: () => void;
  onToggleStatusSubmenu: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) el.style.left = `${menu.x - rect.width}px`;
    if (rect.bottom > window.innerHeight) el.style.top = `${menu.y - rect.height}px`;
  }, [menu.x, menu.y]);

  const itemClass =
    "w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors flex items-center gap-2";

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[180px] rounded-lg border border-border bg-background shadow-xl py-1"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onToggleStatusSubmenu}
          className={itemClass}
        >
          <span className="flex-1">Mark status</span>
          <span className="text-muted text-xs">&#9656;</span>
        </button>
        {menu.statusSubmenuOpen && (
          <div className="absolute left-full top-0 ml-1 min-w-[150px] rounded-lg border border-border bg-background shadow-xl py-1">
            <button type="button" onClick={() => onMarkStatus("completed")} className={itemClass}>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
              Completed
            </button>
            <button type="button" onClick={() => onMarkStatus("no_show")} className={itemClass}>
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              No-show
            </button>
            <button type="button" onClick={() => onMarkStatus("canceled")} className={itemClass}>
              <span className="h-2 w-2 rounded-full bg-zinc-400 shrink-0" />
              Cancelled
            </button>
            <button type="button" onClick={() => onMarkStatus("scheduled")} className={itemClass}>
              <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />
              Scheduled
            </button>
          </div>
        )}
      </div>
      <button type="button" onClick={onMakeSale} className={itemClass}>
        Make sale
      </button>
      <button type="button" onClick={onRunningLate} className={itemClass}>
        Running late
      </button>
    </div>
  );
}

export function DiaryView({
  salonId,
  salonName,
  members,
  services,
  clients,
  appointments: appointmentsFromServer,
  clientPhotoMap = {},
  stylistOverrides = {},
  clientPromptData = {},
}: {
  salonId: string;
  salonName: string;
  members: Member[];
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  clientPhotoMap?: Record<string, string>;
  stylistOverrides?: Record<string, Record<string, number>>;
  clientPromptData?: Record<string, { lastVisit?: string; lastFormula?: string; alertNotes?: string[] }>;
}) {
  const [view, setView] = useState<"day" | "week">("day");
  const [currentDate, setCurrentDate] = useState(() => formatDate(new Date()));
  const [filterStylistId, setFilterStylistId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [optimisticAppointments, setOptimisticAppointments] = useState<Appointment[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [runningLateId, setRunningLateId] = useState<string | null>(null);
  const [dragChargePrompt, setDragChargePrompt] = useState<{ appointmentId: string } | null>(null);
  const [dragChargeAmount, setDragChargeAmount] = useState("");
  const router = useRouter();

  useEffect(() => {
    const ids = new Set(appointmentsFromServer.map((a) => a.id));
    setOptimisticAppointments((prev) => prev.filter((a) => !ids.has(a.id)));
  }, [appointmentsFromServer]);

  const appointments = useMemo(() => {
    const ids = new Set(appointmentsFromServer.map((a) => a.id));
    const extra = optimisticAppointments.filter((a) => !ids.has(a.id));
    return [...appointmentsFromServer, ...extra];
  }, [appointmentsFromServer, optimisticAppointments]);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const id = setInterval(tick, 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const dateObj = useMemo(() => new Date(currentDate + "T12:00:00"), [currentDate]);
  const serviceColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const svc of services) {
      if (svc.color) m[svc.id] = svc.color;
    }
    return m;
  }, [services]);

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
      if (appointment.status === "scheduled") {
        setDragChargePrompt({ appointmentId });
        setDragChargeAmount("");
      } else {
        scheduleRouterRefresh(router);
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this appointment?")) return;
    setError(null);
    const result = await deleteAppointmentViaApi(id);
    if (result.error) setError(result.error);
    else scheduleRouterRefresh(router);
  }

  const openContextMenu = useCallback((e: React.MouseEvent, appointmentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ appointmentId, x: e.clientX, y: e.clientY, statusSubmenuOpen: false });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  async function handleContextMenuStatusChange(status: string) {
    if (!contextMenu) return;
    setError(null);
    const result = await patchAppointmentViaApi(contextMenu.appointmentId, { status });
    if (result.error) setError(result.error);
    else scheduleRouterRefresh(router);
    setContextMenu(null);
  }

  function handleContextMenuMakeSale() {
    if (!contextMenu) return;
    const apt = appointments.find((a) => a.id === contextMenu.appointmentId);
    setContextMenu(null);
    if (apt) {
      const params = new URLSearchParams();
      if (apt.client_id) params.set("clientId", apt.client_id);
      if (apt.service_id) params.set("serviceId", apt.service_id);
      params.set("stylistId", apt.stylist_id);
      router.push(`/checkout?${params.toString()}`);
    } else {
      router.push("/checkout");
    }
  }

  function handleContextMenuRunningLate() {
    if (!contextMenu) return;
    setRunningLateId(contextMenu.appointmentId);
    setContextMenu(null);
  }

  async function confirmRunningLate() {
    if (!runningLateId) return;
    setError(null);
    const apt = appointments.find((a) => a.id === runningLateId);
    if (!apt) {
      setRunningLateId(null);
      return;
    }
    const client = Array.isArray(apt.clients) ? apt.clients[0] : apt.clients;
    const clientName = client?.name || apt.guest_name || "the client";
    const phone = client?.phone ?? apt.guest_phone;
    if (!phone) {
      setError(`No phone number on file for ${clientName} — cannot send a running-late message.`);
      setRunningLateId(null);
      return;
    }
    try {
      const res = await fetch("/api/appointments/running-late", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: runningLateId }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error || "Could not send running-late notification.");
      }
    } catch {
      setError("Could not send running-late notification.");
    }
    setRunningLateId(null);
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
        <h1 className="min-w-0 truncate text-2xl font-bold">{salonName}</h1>
        <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2 sm:w-auto sm:items-center">
          <button
            type="button"
            onClick={() => {
              const d = new Date(currentDate + "T12:00:00");
              d.setDate(d.getDate() - (view === "day" ? 1 : 7));
              setCurrentDate(formatDate(d));
            }}
            className="min-h-[44px] rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-white/10"
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
            className="min-h-[44px] rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-white/10"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(formatDate(new Date()))}
            className="min-h-[44px] rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-white/10"
          >
            Today
          </button>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as "day" | "week")}
            aria-label="View"
            className="min-h-[44px] min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm sm:min-w-[5.5rem] sm:flex-none sm:px-3"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
          <select
            value={filterStylistId ?? ""}
            onChange={(e) => setFilterStylistId(e.target.value || null)}
            aria-label="Filter by stylist"
            className="min-h-[44px] min-w-0 flex-[1_1_100%] rounded-md border border-border bg-background px-2 py-2 text-sm sm:max-w-[220px] sm:flex-1 sm:flex-none sm:px-3"
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
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity w-full sm:w-auto"
          >
            Add appointment
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 px-1">{error}</p>}

      {view === "day" ? (
        <div className="rounded-lg border border-border bg-white/5 shadow-sm overflow-hidden">
          <div className="border-b border-border px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground">
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
              const gutterW = 112;
              const nCols = visibleMembers.length;
              const minTotalW = gutterW + nCols * MIN_COL_PX;
              const heightPx = (endHour - startHour + 1) * 60 * pxPerMin;
              const gridSpanMins = (endHour - startHour + 1) * 60;
              const now = new Date(nowMs);
              const minsFromGridStart = minutesSinceDayStart(now, day) - startHour * 60;
              const nowLineTopPx =
                formatDate(day) === todayStr && minsFromGridStart >= 0 && minsFromGridStart <= gridSpanMins
                  ? minsFromGridStart * pxPerMin
                  : null;

              return (
                <div className="overflow-x-auto">
                  <div className="flex border-b border-border bg-white/5" style={{ minWidth: `${minTotalW}px` }}>
                    <div style={{ width: `${gutterW}px` }} className="shrink-0" aria-hidden />
                    {visibleMembers.map((m) => {
                      const initials = (m.display_name || m.role || "?").charAt(0).toUpperCase();
                      return (
                        <div
                          key={m.id}
                          className="flex-1 min-w-[100px] border-l border-border px-2 py-2 flex flex-col items-center gap-1"
                        >
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                            {m.avatar_url ? (
                              <Image
                                src={m.avatar_url}
                                alt={m.display_name || "Stylist"}
                                fill
                                className="object-cover"
                                sizes="32px"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                                {initials}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold truncate max-w-full">
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
                            className="absolute left-0 right-0 border-t border-borderGrid"
                            style={{ marginLeft: `${gutterW}px` }}
                          />
                        </div>
                      );
                    })}

                    {nowLineTopPx !== null && (
                      <div
                        className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                        style={{ top: `${nowLineTopPx}px`, transform: "translateY(-50%)" }}
                        aria-hidden
                      >
                        <div
                          style={{ width: `${gutterW}px` }}
                          className="shrink-0 flex items-center justify-end pr-1.5"
                        >
                          <span
                            className="rounded bg-background/95 px-1.5 py-0.5 text-accent shadow-sm ring-1 ring-accent/30"
                            title={`Current local time: ${formatTime(now)}`}
                          >
                            <span className="flex flex-col items-end gap-0.5 leading-tight">
                              <span className="text-[8px] font-medium text-accent/90 text-right">
                                Current local time
                              </span>
                              <span className="text-[10px] font-semibold tabular-nums">
                                {formatTime(now)}
                              </span>
                            </span>
                          </span>
                        </div>
                        <div
                          className="min-h-0 min-w-0 flex-1 border-t-2 border-accent shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
                          title={`Current local time: ${formatTime(now)}`}
                        />
                      </div>
                    )}

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
                            className="relative flex-1 min-w-[100px] border-l border-border first:border-l-0"
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
                              const color = (a.service_id && serviceColorMap[a.service_id]) || "#22c55e";
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
                                  onContextMenu={(e) => openContextMenu(e, a.id)}
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
                                  <span className="flex items-center gap-1 mb-1">
                                    <span
                                      className={`inline-block shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadge.className}`}
                                    >
                                      {statusBadge.label}
                                    </span>
                                    {(a.change_charge_minor ?? 0) > 0 && (
                                      <span className="inline-block shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        &pound;{((a.change_charge_minor ?? 0) / 100).toFixed(2)} charge
                                      </span>
                                    )}
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
        <div className="rounded-lg border border-border bg-white/5 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
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
                  className="rounded-lg border border-border bg-white/5 flex flex-col min-h-[120px]"
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
                  <div className="px-2 py-2 border-b border-border bg-white/5 shrink-0">
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
                        const color = (a.service_id && serviceColorMap[a.service_id]) || "#22c55e";
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
                            onContextMenu={(e) => openContextMenu(e, a.id)}
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
                            <span className="flex items-center gap-1 mb-1.5">
                              <span
                                className={`inline-block shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadge.className}`}
                              >
                                {statusBadge.label}
                              </span>
                              {(a.change_charge_minor ?? 0) > 0 && (
                                <span className="inline-block shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  &pound;{((a.change_charge_minor ?? 0) / 100).toFixed(2)} charge
                                </span>
                              )}
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
                                    className="h-9 w-9 rounded-full shrink-0 mt-0.5 bg-muted/40 border border-border"
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
                            <div className="flex gap-2 mt-2 pt-2 border-t border-border">
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
          stylistOverrides={stylistOverrides}
          clientPromptData={clientPromptData}
          onCreate={async (data) => {
            const result = await createAppointmentViaApi(data);
            if (result.error) setError(result.error);
            else {
              if (result.appointmentId) {
                setOptimisticAppointments((prev) => [
                  ...prev,
                  buildCreatedAppointment(result.appointmentId!, data, members, services, clients),
                ]);
              } else {
                scheduleRouterRefresh(router);
              }
              setAddOpen(false);
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
            stylistOverrides={stylistOverrides}
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

      {contextMenu && (
        <DiaryContextMenu
          menu={contextMenu}
          onClose={closeContextMenu}
          onMarkStatus={(status) => void handleContextMenuStatusChange(status)}
          onMakeSale={handleContextMenuMakeSale}
          onRunningLate={handleContextMenuRunningLate}
          onToggleStatusSubmenu={() =>
            setContextMenu((prev) =>
              prev ? { ...prev, statusSubmenuOpen: !prev.statusSubmenuOpen } : null
            )
          }
        />
      )}

      {runningLateId && (() => {
        const apt = appointments.find((a) => a.id === runningLateId);
        const client = apt ? (Array.isArray(apt.clients) ? apt.clients[0] : apt.clients) : null;
        const clientName = client?.name || apt?.guest_name || "the client";
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setRunningLateId(null)}
          >
            <div
              className="w-full max-w-sm rounded-lg border border-border bg-background p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-2">Running late</h2>
              <p className="text-sm text-muted mb-4">
                Send a running-late notification to {clientName}?
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setRunningLateId(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmRunningLate()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
                >
                  Send notification
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {dragChargePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { setDragChargePrompt(null); scheduleRouterRefresh(router); }}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Chargeable change?</h3>
            <p className="text-sm text-muted mb-4">
              You moved this appointment. Is this change chargeable to the client?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Charge amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">&pound;</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dragChargeAmount}
                  onChange={(e) => setDragChargeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm"
                  aria-label="Charge amount in pounds"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/30"
                onClick={() => { setDragChargePrompt(null); scheduleRouterRefresh(router); }}
              >
                No charge
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
                disabled={!dragChargeAmount || Number(dragChargeAmount) <= 0}
                onClick={async () => {
                  const id = dragChargePrompt.appointmentId;
                  const minor = Math.round(Number(dragChargeAmount) * 100);
                  setDragChargePrompt(null);
                  await patchAppointmentViaApi(id, { change_charge_minor: minor });
                  scheduleRouterRefresh(router);
                }}
              >
                Apply charge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
