"use client";

import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { CreateAppointmentInput, UpdateAppointmentInput } from "./actions";
import { createAppointment, updateAppointment, deleteAppointment } from "./actions";
import { AddAppointmentModal } from "./add-appointment-modal";
import { EditAppointmentModal, type EditModalEntryAnchor } from "./edit-appointment-modal";
import { validateMoveWithProcessing, type AppointmentBlockingInput } from "@/lib/diary-rules";
import { dedupeOrderedServiceIds } from "@/lib/appointments/appointment-service-lines";
import { buildServiceDiaryColorMap, DEFAULT_DIARY_COLOR } from "@/lib/service-diary-color";

type Member = { id: string; display_name: string | null; role: string; avatar_url?: string | null };
type Service = { id: string; name: string; duration_minutes: number; processing_time_minutes?: number; color?: string | null; price_minor?: number | null };
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
  technician_id: string;
  service_id: string | null;
  /** When loaded from `/dashboard`, junction order for checkout + edit. */
  service_line_ids?: string[];
  service_line_bill?: { service_id: string; price_override_minor: number | null; assigned_technician_id: string | null }[];
  deposit_payment_intent_id?: string | null;
  bill_total_minor?: number | null;
  deposit_amount_minor?: number | null;
  clients: { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null;
  services:
    | { name: string; duration_minutes: number; processing_time_minutes?: number }
    | { name: string; duration_minutes: number; processing_time_minutes?: number }[]
    | null;
  nail_members: { display_name: string | null } | { display_name: string | null }[] | null;
};

/** Build a diary row client-side after POST /api/appointments (avoids router.refresh() RSC digest issues). */
function buildCreatedAppointment(
  id: string,
  input: CreateAppointmentInput,
  members: Member[],
  services: Service[],
  clients: Client[],
  technicianOverrides: Record<string, Record<string, number>>
): Appointment {
  const orderedSvc = dedupeOrderedServiceIds(
    input.serviceIds !== undefined && input.serviceIds.length > 0
      ? input.serviceIds
      : input.serviceId
        ? [input.serviceId]
        : []
  );
  const client = input.clientId ? clients.find((c) => c.id === input.clientId) : undefined;
  const technician = members.find((m) => m.id === input.technicianId);
  const svcList = orderedSvc
    .map((sid) => services.find((s) => s.id === sid))
    .filter((s): s is Service => s !== undefined);

  let servicesBlock: Appointment["services"] = null;
  if (svcList.length === 1) {
    servicesBlock = {
      name: svcList[0].name,
      duration_minutes: svcList[0].duration_minutes,
      processing_time_minutes: svcList[0].processing_time_minutes ?? 0,
    };
  } else if (svcList.length > 1) {
    const durSum = svcList.reduce((acc, s) => {
      const ov = technicianOverrides[input.technicianId]?.[s.id];
      return acc + (ov ?? s.duration_minutes);
    }, 0);
    servicesBlock = {
      name: svcList.map((s) => s.name).join(" · "),
      duration_minutes: durSum,
      processing_time_minutes: Math.max(...svcList.map((s) => s.processing_time_minutes ?? 0)),
    };
  }

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
    technician_id: input.technicianId,
    service_id: orderedSvc[0] ?? input.serviceId ?? null,
    service_line_ids: orderedSvc.length > 0 ? orderedSvc : undefined,
    clients: client ? { name: client.name, email: client.email, phone: client.phone } : null,
    services: servicesBlock,
    nail_members: technician ? { display_name: technician.display_name } : null,
  };
}

/** Local merge for drag-reschedule — card jumps before PATCH returns. */
function buildRescheduledAppointment(
  appointment: Appointment,
  newStart: Date,
  newEnd: Date,
  targetTechnicianId: string,
  membersList: Member[]
): Appointment {
  const technician = membersList.find((m) => m.id === targetTechnicianId);
  return {
    ...appointment,
    start_time: newStart.toISOString(),
    end_time: newEnd.toISOString(),
    technician_id: targetTechnicianId,
    nail_members: technician ? { display_name: technician.display_name } : appointment.nail_members,
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
  // Dark, mostly opaque pill + light text so labels stay readable on Technician-tinted card backgrounds.
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

/** Snap pointer Y (px from top of column) to 15-minute steps within the diary grid. */
function snapMinsFromY(y: number, pxPerMin: number, startHour: number, endHour: number): number {
  const maxMins = (endHour - startHour + 1) * 60;
  const raw = y / pxPerMin;
  return Math.max(0, Math.min(maxMins, Math.round(raw / 15) * 15));
}

/** HH:mm local for a slot on `day` at `minsFromGridStart` minutes after `startHour`:00. */
function hhmmFromGridMins(day: Date, startHour: number, minsFromGridStart: number): string {
  const d = new Date(day);
  d.setHours(startHour, 0, 0, 0);
  d.setMinutes(d.getMinutes() + minsFromGridStart);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

function blockingInputsForTechnicianOnDay(
  allAppointments: Appointment[],
  day: Date,
  technicianId: string
): AppointmentBlockingInput[] {
  const dayStr = formatDate(day);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  return allAppointments
    .filter(
      (a) =>
        a.technician_id === technicianId &&
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
  onToggleStatusSubmenu,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onMarkStatus: (status: string) => void;
  onToggleStatusSubmenu: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });

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

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 8;
    let left = menu.x;
    let top = menu.y;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (left + w > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - w - pad);
    if (top + h > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - h - pad);
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    setPos({ left, top });
  }, [menu.x, menu.y, menu.appointmentId, menu.statusSubmenuOpen]);

  const itemClass =
    "w-full text-left px-3 py-2 text-sm text-zinc-100 hover:bg-white/10 transition-colors flex items-center gap-2";

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[180px] rounded-lg border border-zinc-700/90 bg-zinc-950 py-1 text-zinc-100 shadow-2xl shadow-black/50 ring-1 ring-black/40"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onToggleStatusSubmenu}
          className={itemClass}
        >
          <span className="flex-1">Mark status</span>
          <span className="text-zinc-400 text-xs">&#9656;</span>
        </button>
        {menu.statusSubmenuOpen && (
          <div className="absolute left-full top-0 ml-1 min-w-[150px] rounded-lg border border-zinc-700/90 bg-zinc-950 py-1 shadow-2xl shadow-black/50 ring-1 ring-black/40">
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
  technicianOverrides = {},
  clientCompletedCounts = {},
  categories = [],
}: {
  salonId: string;
  salonName: string;
  members: Member[];
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  technicianOverrides?: Record<string, Record<string, number>>;
  clientCompletedCounts?: Record<string, number>;
  categories?: { id: string; name: string; color?: string | null }[];
}) {
  const [view, setView] = useState<"day" | "week">("day");
  const [currentDate, setCurrentDate] = useState(() => formatDate(new Date()));
  const [filterTechnicianId, setFilterTechnicianId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editEntryAnchor, setEditEntryAnchor] = useState<EditModalEntryAnchor | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [optimisticAppointments, setOptimisticAppointments] = useState<Appointment[]>([]);
  const [appointmentPatches, setAppointmentPatches] = useState<Record<string, Appointment>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  /** Hover guide on day grid: snapped time line + tooltip position */
  const [slotHover, setSlotHover] = useState<{
    memberId: string;
    topPx: number;
    timeLabel: string;
    technicianLabel: string;
    tooltipX: number;
    tooltipY: number;
  } | null>(null);
  const [addPrefill, setAddPrefill] = useState<{ technicianId?: string; timeHHmm?: string; clientId?: string } | null>(null);
  const [addModalKey, setAddModalKey] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const consumedAddQueryRef = useRef(false);

  const openAddModal = useCallback((prefill: { technicianId?: string; timeHHmm?: string; clientId?: string } | null) => {
    setAddPrefill(prefill);
    setAddModalKey((k) => k + 1);
    setSlotHover(null);
    setAddOpen(true);
  }, []);

  const openEditFromDiary = useCallback((appointmentId: string, e: React.MouseEvent<Element>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setEditEntryAnchor({ top: r.top, left: r.left, width: r.width, height: r.height });
    setEditId(appointmentId);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditId(null);
    setEditEntryAnchor(null);
  }, []);

  // Opens add-appointment modal from Checkout "Book next" deep link (?addAppointmentClient=…&prefillTechnician=…).
  useEffect(() => {
    if (consumedAddQueryRef.current) return;
    const cid = searchParams.get("addAppointmentClient");
    if (!cid?.trim()) return;
    if (!clients.some((c) => c.id === cid.trim())) return;
    const st = searchParams.get("prefillTechnician");
    const technicianOk = !!(st?.trim() && members.some((m) => m.id === st.trim()));
    consumedAddQueryRef.current = true;
    openAddModal(
      technicianOk
        ? { clientId: cid.trim(), technicianId: st!.trim(), timeHHmm: "09:00" }
        : { clientId: cid.trim(), timeHHmm: "09:00" }
    );
    const path = pathname || "/nail/diary";
    router.replace(path, { scroll: false });
  }, [clients, members, pathname, router, searchParams, openAddModal]);

  useEffect(() => {
    const ids = new Set(appointmentsFromServer.map((a) => a.id));
    setOptimisticAppointments((prev) => prev.filter((a) => !ids.has(a.id)));
  }, [appointmentsFromServer]);

  useEffect(() => {
    setAppointmentPatches((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      const next = { ...prev };
      let changed = false;
      for (const id of keys) {
        const serverRow = appointmentsFromServer.find((a) => a.id === id);
        const patched = prev[id];
        if (
          serverRow &&
          serverRow.start_time === patched.start_time &&
          serverRow.end_time === patched.end_time &&
          serverRow.technician_id === patched.technician_id
        ) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [appointmentsFromServer]);

  const appointments = useMemo(() => {
    const merged = appointmentsFromServer.map((a) => appointmentPatches[a.id] ?? a);
    const ids = new Set(appointmentsFromServer.map((a) => a.id));
    const extra = optimisticAppointments.filter((a) => !ids.has(a.id));
    return [...merged, ...extra];
  }, [appointmentsFromServer, optimisticAppointments, appointmentPatches]);

  useEffect(() => {
    if (view !== "day") setSlotHover(null);
  }, [view]);

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
  const serviceColorMap = useMemo(
    () => buildServiceDiaryColorMap(services, categories),
    [services, categories]
  );

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
    if (filterTechnicianId) list = list.filter((a) => a.technician_id === filterTechnicianId);
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
  }, [appointments, filterTechnicianId, daysToShow]);

  const visibleMembers = useMemo(
    () => (filterTechnicianId ? members.filter((m) => m.id === filterTechnicianId) : members),
    [members, filterTechnicianId]
  );

  async function handleRescheduleWithTechnician(
    appointmentId: string,
    newStart: Date,
    newEnd: Date,
    targetTechnicianId: string
  ) {
    setError(null);
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return;
    const day = new Date(newStart);
    day.setHours(0, 0, 0, 0);
    const blocking = blockingInputsForTechnicianOnDay(appointments, day, targetTechnicianId);
    const newStartM = (newStart.getTime() - day.getTime()) / 60000;
    const newEndM = (newEnd.getTime() - day.getTime()) / 60000;
    const svc = Array.isArray(appointment.services) ? appointment.services[0] : appointment.services;
    const proc = Number(svc?.processing_time_minutes) || 0;
    const validation = validateMoveWithProcessing(blocking, appointment.id, newStartM, newEndM, proc);
    if (!validation.valid) {
      setError(validation.message ?? "Invalid move");
      return;
    }
    const updates: { start_time: string; end_time: string; technician_id?: string } = {
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    };
    if (targetTechnicianId !== appointment.technician_id) {
      updates.technician_id = targetTechnicianId;
    }

    const optimistic = buildRescheduledAppointment(appointment, newStart, newEnd, targetTechnicianId, members);
    setAppointmentPatches((prev) => ({ ...prev, [appointmentId]: optimistic }));
    setMovingId(null);

    try {
      const result = await updateAppointment(appointmentId, updates);
      if (result.error) {
        setAppointmentPatches((prev) => {
          const n = { ...prev };
          delete n[appointmentId];
          return n;
        });
        setError(result.error);
        return;
      }
      scheduleRouterRefresh(router);
    } catch (e) {
      setAppointmentPatches((prev) => {
        const n = { ...prev };
        delete n[appointmentId];
        return n;
      });
      setError(e instanceof Error ? e.message : "Could not reschedule.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this appointment?")) return;
    setError(null);
    const result = await deleteAppointment(id);
    if (result.error) setError(result.error);
    else scheduleRouterRefresh(router);
  }

  const openContextMenu = useCallback((e: React.MouseEvent, appointmentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Start the menu further right so more of the booking card stays visible (clamp stays on-screen).
    const xOffset = Math.min(72, Math.max(28, Math.round(r.width * 0.34)));
    setContextMenu({
      appointmentId,
      x: Math.round(r.left + xOffset),
      y: Math.round(r.top + 6),
      statusSubmenuOpen: false,
    });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  async function handleContextMenuStatusChange(status: string) {
    if (!contextMenu) return;
    setError(null);
    const result = await updateAppointment(contextMenu.appointmentId, { status });
    if (result.error) setError(result.error);
    else scheduleRouterRefresh(router);
    setContextMenu(null);
  }

  const todayStr = formatDate(new Date());
  const dayHeaderPrefix = filterTechnicianId
    ? (() => {
        const m = members.find((x) => x.id === filterTechnicianId);
        const name = m?.display_name || m?.role;
        return name ? `${name} — ` : "";
      })()
    : "All technicians — ";

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
            aria-label="Day or week range"
            className="min-h-[44px] min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm sm:min-w-[5.5rem] sm:flex-none sm:px-3"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
          <select
            value={filterTechnicianId ?? ""}
            onChange={(e) => setFilterTechnicianId(e.target.value || null)}
            aria-label="Filter by technician"
            className="min-h-[44px] min-w-0 flex-[1_1_100%] rounded-md border border-border bg-background px-2 py-2 text-sm sm:max-w-[220px] sm:flex-1 sm:flex-none sm:px-3"
          >
            <option value="">All technicians</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || m.role}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => openAddModal(null)}
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
                  One column per technician. Hover a column to see the time at that slot; click empty space to add an appointment there. Drag onto a column and time to reschedule.
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
            <div className="p-4 text-sm text-muted">No technician selected.</div>
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
                                alt={m.display_name || "Technician"}
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
                        const colAppts = filteredAppointments.filter((a) => a.technician_id === member.id);
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
                              className="pointer-events-none absolute inset-0 z-[1]"
                              aria-hidden
                            >
                              {Array.from({ length: gridSpanMins / 15 }).map((_, qi) => (
                                <div
                                  key={qi}
                                  className={`absolute left-0 right-0 ${qi % 2 === 1 ? "bg-muted/25 dark:bg-white/[0.04]" : "bg-transparent"}`}
                                  style={{ top: `${qi * 15 * pxPerMin}px`, height: `${15 * pxPerMin}px` }}
                                />
                              ))}
                            </div>
                            <div
                              className="absolute inset-0 z-[3] cursor-crosshair"
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                              }}
                              onMouseMove={(e) => {
                                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                const y = e.clientY - rect.top;
                                const minsFromStart = snapMinsFromY(y, pxPerMin, startHour, endHour);
                                const snappedTopPx = minsFromStart * pxPerMin;
                                const slot = new Date(day);
                                slot.setHours(startHour, 0, 0, 0);
                                slot.setMinutes(slot.getMinutes() + minsFromStart);
                                const technicianLabel = member.display_name || member.role || "Technician";
                                /** Portal to document.body so coords match pointer (Reveal’s transform breaks fixed inside it) */
                                const pad = 8;
                                const approxW = Math.min(220, window.innerWidth - 2 * pad);
                                const approxH = 48;
                                const gap = 2;
                                let left = e.clientX + gap;
                                let top = e.clientY + gap;
                                if (left + approxW > window.innerWidth - pad) {
                                  left = e.clientX - approxW - gap;
                                }
                                if (top + approxH > window.innerHeight - pad) {
                                  top = e.clientY - approxH - gap;
                                }
                                left = Math.max(pad, Math.min(left, window.innerWidth - approxW - pad));
                                top = Math.max(pad, Math.min(top, window.innerHeight - approxH - pad));
                                setSlotHover({
                                  memberId: member.id,
                                  topPx: snappedTopPx,
                                  timeLabel: formatTime(slot),
                                  technicianLabel,
                                  tooltipX: Math.round(left),
                                  tooltipY: Math.round(top),
                                });
                              }}
                              onMouseLeave={() => setSlotHover(null)}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest("button")) return;
                                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                const y = e.clientY - rect.top;
                                const minsFromStart = snapMinsFromY(y, pxPerMin, startHour, endHour);
                                const hhmm = hhmmFromGridMins(day, startHour, minsFromStart);
                                openAddModal({ technicianId: member.id, timeHHmm: hhmm });
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const id = e.dataTransfer.getData("text/plain");
                                if (!id) return;
                                const apt = appointments.find((a) => a.id === id);
                                if (!apt) return;
                                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                const y = e.clientY - rect.top;
                                const minsFromStart = snapMinsFromY(y, pxPerMin, startHour, endHour);
                                const newStart = new Date(day);
                                newStart.setHours(startHour, 0, 0, 0);
                                newStart.setMinutes(newStart.getMinutes() + minsFromStart);
                                const durationMs =
                                  new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
                                const newEnd = new Date(newStart.getTime() + durationMs);
                                void handleRescheduleWithTechnician(id, newStart, newEnd, member.id);
                              }}
                            />
                            {slotHover?.memberId === member.id && (
                              <div
                                className="pointer-events-none absolute left-0 right-0 z-[5] border-t-2 border-accent/60"
                                style={{ top: `${slotHover.topPx}px` }}
                                aria-hidden
                              />
                            )}
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
                              const color = (a.service_id && serviceColorMap[a.service_id]) || DEFAULT_DIARY_COLOR;
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
                                  onClick={(e) => openEditFromDiary(a.id, e)}
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
                                  </span>
                                  <div className="text-xs font-semibold text-foreground truncate">
                                    {formatTime(start)}–{formatTime(end)} · {label}
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
              Week view: each day lists appointments in time order. Drag a card onto another day to move it (same time of day). Day view is best for dragging between technicians.
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
                    void handleRescheduleWithTechnician(id, newStart, newEnd, apt.technician_id);
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
                        const color = (a.service_id && serviceColorMap[a.service_id]) || DEFAULT_DIARY_COLOR;
                        const technicianName =
                          members.find((m) => m.id === a.technician_id)?.display_name ||
                          members.find((m) => m.id === a.technician_id)?.role ||
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
                            </span>
                            <button
                              type="button"
                              onClick={(e) => openEditFromDiary(a.id, e)}
                              className="w-full text-left"
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  className="h-9 w-9 rounded-full shrink-0 mt-0.5 bg-muted/40 border border-border"
                                  aria-hidden
                                />
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
                                  {!filterTechnicianId && technicianName && (
                                    <div className="text-[10px] font-medium text-foreground/85 truncate mt-0.5">
                                      {technicianName}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                            <div className="flex gap-2 mt-2 pt-2 border-t border-border">
                              <button
                                type="button"
                                onClick={(e) => openEditFromDiary(a.id, e)}
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

      {typeof window !== "undefined" &&
        view === "day" &&
        slotHover &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[100] max-w-[min(220px,calc(100vw-1rem))] rounded-md border border-zinc-600/80 bg-zinc-950/95 px-2 py-1 text-[11px] leading-tight text-zinc-100 shadow-lg shadow-black/40 ring-1 ring-black/30"
            style={{
              left: slotHover.tooltipX,
              top: slotHover.tooltipY,
            }}
            role="status"
            aria-live="polite"
          >
            <div className="font-semibold tabular-nums text-zinc-50">{slotHover.timeLabel}</div>
            <div className="truncate text-zinc-400">{slotHover.technicianLabel}</div>
          </div>,
          document.body
        )}

      <p className="text-xs text-muted px-1">
        Day: hover for snapped time (label follows your pointer), click empty space to add there; drag to reschedule. Week:
        drag onto a day column. Edit / Delete on each booking.
      </p>

      {addOpen && (
        <AddAppointmentModal
          key={addModalKey}
          salonId={salonId}
          members={members}
          services={services}
          clients={clients}
          categories={categories}
          currentDate={currentDate}
          initialTechnicianId={addPrefill?.technicianId ?? undefined}
          initialTimeHHmm={addPrefill?.timeHHmm ?? undefined}
          initialClientId={addPrefill?.clientId ?? undefined}
          technicianOverrides={technicianOverrides}
          clientCompletedCounts={clientCompletedCounts}
          entryAnimation="from-top"
          onCreate={async (data) => {
            const result = await createAppointment(data);
            if (result.error) setError(result.error);
            else if ("appointmentId" in result && result.appointmentId) {
              setOptimisticAppointments((prev) => [
                ...prev,
                buildCreatedAppointment(result.appointmentId, data, members, services, clients, technicianOverrides),
              ]);
              setAddOpen(false);
            } else {
              scheduleRouterRefresh(router);
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
            categories={categories}
            technicianOverrides={technicianOverrides}
            entryAnchor={editEntryAnchor}
            onUpdate={async (id, data) => {
              const result = await updateAppointment(id, data);
              if (result.error) setError(result.error);
              else {
                closeEditModal();
                scheduleRouterRefresh(router);
              }
              return result;
            }}
            onDelete={(id) => {
              closeEditModal();
              void handleDelete(id);
            }}
            onClose={closeEditModal}
          />
        );
      })()}

      {contextMenu &&
        createPortal(
          <DiaryContextMenu
            menu={contextMenu}
            onClose={closeContextMenu}
            onMarkStatus={(status) => void handleContextMenuStatusChange(status)}
            onToggleStatusSubmenu={() =>
              setContextMenu((prev) =>
                prev ? { ...prev, statusSubmenuOpen: !prev.statusSubmenuOpen } : null
              )
            }
          />,
          document.body
        )}
    </div>
  );
}
