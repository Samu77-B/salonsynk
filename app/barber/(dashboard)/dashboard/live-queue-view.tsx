"use client";

import { useTransition, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@core/supabase/client";
import { formatEstimatedWait } from "@modules/barber/lib/queue-sms-messages";
import {
  startService,
  completeService,
  removeFromQueue,
  addToQueue,
  notifyQueueCustomer,
  sendQueueCustomMessage,
} from "./actions";
import {
  updateBarberAppointmentStatus,
  deleteBarberAppointment,
} from "../appointments/actions";
import type { QueueEntry, BarberMember, BarberService, TodayAppointment } from "./data";
import {
  appointmentVisibleToMember,
  staffQueueRowVisibleToMember,
} from "@core/queue/platform-queue-access";

type Props = {
  shopId: string;
  shopName: string;
  queue: QueueEntry[];
  todayAppointments: TodayAppointment[];
  members: BarberMember[];
  services: BarberService[];
  currentMemberId: string;
  isManagerView: boolean;
  stats: { todayServed: number; todayCash: number; todayCard: number; todayRevenue: number };
  dashboardAlertsEnabled?: boolean;
};

type ManagerAlertBanner = {
  id: string;
  message: string;
};

function playManagerAlertChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.09;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.45);
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    /* autoplay / unsupported */
  }
}

function formatBookingTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatPrice(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function serviceOptionLabel(name: string, priceMinor: number): string {
  return priceMinor > 0 ? `${name} — ${formatPrice(priceMinor)}` : name;
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

function PersonIcon() {
  return (
    <svg className="h-4 w-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}
function ChairIcon() {
  return (
    <svg className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M5 10v8a1 1 0 001 1h12a1 1 0 001-1v-8M5 10l2-5h10l2 5M8 21v-2m8 2v-2"
      />
    </svg>
  );
}

const ACTIVE_STATUSES = ["waiting", "in_chair"];

const fieldClass =
  "w-full h-11 rounded border border-border px-3 text-sm leading-5 focus:outline-none focus:ring-1 focus:ring-accent box-border";
const selectClass = fieldClass;
const messageInputClass =
  "flex-1 rounded border border-border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent box-border";
const btnPrimary = "btn-accent px-3 py-2 text-xs sm:text-sm disabled:opacity-50";
const btnOutline = "btn-outline px-3 py-2 text-xs sm:text-sm disabled:opacity-50";

function useRealtimeQueue(
  shopId: string,
  serverQueue: QueueEntry[],
  onNewWaiting?: (row: QueueEntry) => void
) {
  const [liveQueue, setLiveQueue] = useState<QueueEntry[]>(serverQueue);
  const onNewWaitingRef = useRef(onNewWaiting);
  useEffect(() => {
    onNewWaitingRef.current = onNewWaiting;
  }, [onNewWaiting]);

  const serverRef = useRef(serverQueue);
  useEffect(() => {
    if (serverRef.current !== serverQueue) {
      serverRef.current = serverQueue;
      setLiveQueue(serverQueue);
    }
  }, [serverQueue]);

  const applyInsert = useCallback((row: QueueEntry) => {
    if (row.shop_id !== shopId) return;
    if (!ACTIVE_STATUSES.includes(row.status)) return;
    setLiveQueue((prev) => {
      if (prev.some((e) => e.id === row.id)) return prev;
      return [...prev, row].sort((a, b) => a.position - b.position);
    });
    if (row.status === "waiting") {
      onNewWaitingRef.current?.(row);
    }
  }, [shopId]);

  const applyUpdate = useCallback((row: QueueEntry) => {
    if (row.shop_id !== shopId) return;
    setLiveQueue((prev) => {
      if (!ACTIVE_STATUSES.includes(row.status)) {
        return prev.filter((e) => e.id !== row.id);
      }
      const idx = prev.findIndex((e) => e.id === row.id);
      if (idx === -1) return [...prev, row].sort((a, b) => a.position - b.position);
      const next = [...prev];
      next[idx] = row;
      return next.sort((a, b) => a.position - b.position);
    });
  }, [shopId]);

  const applyDelete = useCallback((old: { id: string }) => {
    setLiveQueue((prev) => prev.filter((e) => e.id !== old.id));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`barber_queue:${shopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "barber_queue", filter: `shop_id=eq.${shopId}` },
        (payload) => applyInsert(payload.new as QueueEntry)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "barber_queue", filter: `shop_id=eq.${shopId}` },
        (payload) => applyUpdate(payload.new as QueueEntry)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "barber_queue", filter: `shop_id=eq.${shopId}` },
        (payload) => applyDelete(payload.old as { id: string })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, applyInsert, applyUpdate, applyDelete]);

  return liveQueue;
}

export function LiveQueueView({
  shopId,
  shopName,
  queue,
  todayAppointments,
  members,
  services,
  currentMemberId,
  isManagerView,
  stats,
  dashboardAlertsEnabled = false,
}: Props) {
  const router = useRouter();
  const [alertBanner, setAlertBanner] = useState<ManagerAlertBanner | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushManagerAlert = useCallback(
    (message: string) => {
      if (!dashboardAlertsEnabled) return;
      playManagerAlertChime();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setAlertBanner({ id, message });
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setAlertBanner(null), 6000);
      router.refresh();
    },
    [dashboardAlertsEnabled, router]
  );

  const onNewWaiting = useCallback(
    (row: QueueEntry) => {
      const name = row.guest_name?.trim() || "A customer";
      pushManagerAlert(`${name} joined the queue`);
    },
    [pushManagerAlert]
  );

  const liveQueue = useRealtimeQueue(shopId, queue, onNewWaiting);

  useEffect(() => {
    if (!dashboardAlertsEnabled) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`barber_appointments_alerts:${shopId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "barber_appointments",
          filter: `shop_id=eq.${shopId}`,
        },
        (payload) => {
          const row = payload.new as {
            guest_name?: string | null;
            start_time?: string;
            status?: string;
          };
          if (row.status && row.status !== "scheduled") return;
          const name = row.guest_name?.trim() || "A customer";
          const when = row.start_time
            ? new Date(row.start_time).toLocaleString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "soon";
          pushManagerAlert(`${name} booked for ${when}`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, dashboardAlertsEnabled, pushManagerAlert]);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 12_000);
    return () => clearInterval(id);
  }, [router]);

  const rowVisible = (entry: QueueEntry) =>
    staffQueueRowVisibleToMember(
      {
        preferred_staff_id: entry.preferred_barber_id,
        assigned_staff_id: entry.assigned_barber_id,
        status: entry.status,
      },
      currentMemberId,
      isManagerView
    );

  const waiting = liveQueue.filter((e) => e.status === "waiting" && rowVisible(e));
  const inChair = liveQueue.filter((e) => e.status === "in_chair" && rowVisible(e));
  const todayScheduled = todayAppointments.filter(
    (a) => a.status === "scheduled" && appointmentVisibleToMember(a.barber_id, currentMemberId, isManagerView)
  );
  const todayInChair = todayAppointments.filter(
    (a) => a.status === "in_chair" && appointmentVisibleToMember(a.barber_id, currentMemberId, isManagerView)
  );
  const waitingTotal = waiting.length + todayScheduled.length;
  const inChairTotal = inChair.length + todayInChair.length;

  return (
    <div className="space-y-5">
      {alertBanner ? (
        <div
          role="status"
          className="rounded border border-accent/40 bg-accent/15 px-4 py-3 text-sm font-medium text-foreground shadow-sm"
        >
          {alertBanner.message}
        </div>
      ) : null}

      {isManagerView ? (
        <p className="text-xs text-muted">
          Manager alerts:{" "}
          {dashboardAlertsEnabled ? "sound & banner on" : "sound & banner off"}.{" "}
          <Link href="/barber/team#alerts" className="underline hover:text-foreground">
            Change in Team
          </Link>
        </p>
      ) : null}

      <div className={`grid gap-2 sm:gap-3 ${isManagerView ? "grid-cols-3" : "grid-cols-2"}`}>
        {isManagerView ? (
          <>
            <StatCard label="In Queue" value={waitingTotal} />
            <StatCard label="In Chair" value={inChairTotal} />
            <StatCard label="Served Today" value={stats.todayServed} />
          </>
        ) : (
          <>
            <StatCard label="Waiting for me" value={waitingTotal} />
            <StatCard label="In my chair" value={inChairTotal} />
          </>
        )}
      </div>

      {isManagerView ? <AddCustomerPanel services={services} members={members} /> : null}

      {inChairTotal > 0 && (
        <section>
          <h2 className="text-xs font-bold text-foreground uppercase tracking-widest mb-2.5">
            In Chair ({inChairTotal})
          </h2>
          <div className="space-y-2.5">
            {todayInChair.map((appt) => (
              <TodayBookingInChairCard
                key={`appt-${appt.id}`}
                appointment={appt}
                members={members}
                services={services}
              />
            ))}
            {inChair.map((entry) => (
              <InChairCard
                key={entry.id}
                entry={entry}
                members={members}
                services={services}
                shopName={shopName}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-bold text-foreground uppercase tracking-widest mb-2.5">
          Waiting Queue ({waitingTotal})
        </h2>
        {waitingTotal === 0 ? (
          <p className="text-sm text-muted py-10 text-center barber-panel">
            {isManagerView
              ? "No one in the queue right now."
              : "No clients waiting for you right now."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {todayScheduled.map((appt) => (
              <TodayBookingWaitingCard
                key={`appt-${appt.id}`}
                appointment={appt}
                members={members}
                services={services}
                isManagerView={isManagerView}
              />
            ))}
            {waiting.map((entry, idx) => (
              <WaitingCard
                key={entry.id}
                entry={entry}
                position={idx + 1}
                members={members}
                services={services}
                currentMemberId={currentMemberId}
                isManagerView={isManagerView}
                shopName={shopName}
              />
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] text-muted text-center pt-1">
        Auto-refreshes every 12 seconds ·{" "}
        <button
          type="button"
          onClick={() => router.refresh()}
          className="underline hover:text-foreground transition-colors"
        >
          Refresh now
        </button>
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="barber-panel px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="text-[10px] sm:text-xs text-muted leading-tight">{label}</p>
      <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5 text-foreground">{value}</p>
    </div>
  );
}

function useQueueSmsActions(
  entryId: string,
  guestName: string,
  shopName: string,
  notified: boolean
) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  function handleNotify() {
    setError(null);
    startTransition(async () => {
      const result = await notifyQueueCustomer(entryId, "next");
      if (result.error) setError(result.error);
    });
  }

  function handleSendCustom() {
    setError(null);
    startTransition(async () => {
      const result = await sendQueueCustomMessage(entryId, customMessage);
      if (result.error) setError(result.error);
      else {
        setShowMessage(false);
        setCustomMessage("");
      }
    });
  }

  return {
    isPending,
    error,
    showMessage,
    setShowMessage,
    customMessage,
    setCustomMessage,
    handleNotify,
    handleSendCustom,
    notified,
  };
}

function AddCustomerPanel({
  services,
  members,
}: {
  services: BarberService[];
  members: BarberMember[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addToQueue(formData);
      if (result.error) alert(result.error);
      else setOpen(false);
    });
  }

  return (
    <div className="barber-panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-foreground/[0.04] transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">Add Customer</span>
        <ChevronIcon open={open} />
      </button>

      <div className={`barber-roll-down ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <div className="barber-roll-down-inner">
          <form action={handleSubmit} className="border-t border-border px-4 py-4 space-y-3">
            <div>
              <label htmlFor="guest_name" className="block text-xs text-muted mb-1.5">
                Name
              </label>
              <input id="guest_name" name="guest_name" type="text" placeholder="Walk-in" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="guest_phone" className="block text-xs text-muted mb-1.5">
                Phone
              </label>
              <input id="guest_phone" name="guest_phone" type="tel" placeholder="07..." className={fieldClass} />
            </div>
            <div>
              <label htmlFor="service_id" className="block text-xs text-muted mb-1.5">
                Service
              </label>
              <select id="service_id" name="service_id" className={selectClass}>
                <option value="">Any</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {serviceOptionLabel(s.name, s.price_minor)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="preferred_barber_id" className="block text-xs text-muted mb-1.5">
                Preferred Barber
              </label>
              <select id="preferred_barber_id" name="preferred_barber_id" className={selectClass}>
                <option value="">Next available</option>
                {members
                  .filter((m) => m.is_accepting_walk_ins)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name ?? "Barber"}
                      {m.chair_number ? ` (Chair ${m.chair_number})` : ""}
                    </option>
                  ))}
              </select>
            </div>
            <button type="submit" disabled={isPending} className={`w-full ${btnPrimary} py-3`}>
              {isPending ? "Adding…" : "Add to Queue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function TodayBookingWaitingCard({
  appointment,
  members,
  services,
  isManagerView,
}: {
  appointment: TodayAppointment;
  members: BarberMember[];
  services: BarberService[];
  isManagerView: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const barber = members.find((m) => m.id === appointment.barber_id);
  const service = services.find((s) => s.id === appointment.service_id);
  const hasPhone = !!appointment.guest_phone;

  function handleStart() {
    setActionError(null);
    startTransition(async () => {
      const result = await updateBarberAppointmentStatus(appointment.id, "in_chair");
      if (result.error) setActionError(result.error);
      else router.refresh();
    });
  }

  function handleNoShow() {
    setActionError(null);
    startTransition(async () => {
      const result = await updateBarberAppointmentStatus(appointment.id, "no_show");
      if (result.error) setActionError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="barber-panel p-3.5 sm:p-4 space-y-3 border-l-2 border-l-accent/60">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/15">
          <CalendarIcon />
        </span>
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <PersonIcon />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold truncate">{appointment.guest_name ?? "Booking"}</p>
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-border text-muted">
                Booked
              </span>
            </div>
            <p className="text-xs text-muted truncate">
              {service ? service.name : "Any service"}
              {barber ? ` · ${barber.display_name ?? "Barber"}` : ""}
            </p>
            <p className="text-[11px] text-muted mt-0.5 tabular-nums">
              {formatBookingTime(appointment.start_time)}
            </p>
          </div>
        </div>
        {hasPhone && (
          <div className="shrink-0 text-right">
            <span className="text-xs font-mono text-foreground/80">{appointment.guest_phone}</span>
          </div>
        )}
      </div>

      <div className={`grid gap-2 ${isManagerView ? "grid-cols-2" : "grid-cols-1"}`}>
        <button type="button" onClick={handleStart} disabled={isPending} className={btnPrimary}>
          Start
        </button>
        {isManagerView ? (
          <button type="button" onClick={handleNoShow} disabled={isPending} className={btnOutline}>
            No-show
          </button>
        ) : null}
      </div>

      {actionError && <p className="text-xs text-red-400">{actionError}</p>}
    </div>
  );
}

function TodayBookingInChairCard({
  appointment,
  members,
  services,
}: {
  appointment: TodayAppointment;
  members: BarberMember[];
  services: BarberService[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const barber = members.find((m) => m.id === appointment.barber_id);
  const service = services.find((s) => s.id === appointment.service_id);
  const price = service?.price_minor ?? 0;
  const hasPhone = !!appointment.guest_phone;

  function handleComplete() {
    setActionError(null);
    startTransition(async () => {
      const result = await updateBarberAppointmentStatus(appointment.id, "completed");
      if (result.error) setActionError(result.error);
      else router.refresh();
    });
  }

  function handleCancel() {
    setActionError(null);
    startTransition(async () => {
      const result = await deleteBarberAppointment(appointment.id);
      if (result.error) setActionError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="barber-panel-highlight p-3.5 sm:p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-accent/15">
          <ChairIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold truncate">{appointment.guest_name ?? "Booking"}</p>
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-border text-muted">
              Booked
            </span>
          </div>
          {hasPhone && (
            <p className="text-xs font-mono text-foreground/80 mt-0.5">{appointment.guest_phone}</p>
          )}
          <p className="text-xs text-muted mt-0.5">
            {barber
              ? `${barber.display_name ?? "Barber"}${barber.chair_number ? ` · Chair ${barber.chair_number}` : ""}`
              : "—"}
            {service ? ` · ${service.name}` : ""}
            {` · ${formatBookingTime(appointment.start_time)}`}
          </p>
        </div>
        {price > 0 && (
          <span className="text-sm font-semibold tabular-nums shrink-0 text-foreground">{formatPrice(price)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={handleComplete} disabled={isPending} className={`${btnPrimary} py-2.5`}>
          {isPending ? "Completing…" : "Complete"}
        </button>
        <button type="button" onClick={handleCancel} disabled={isPending} className={`${btnOutline} py-2.5`}>
          Cancel
        </button>
      </div>

      {actionError && <p className="text-xs text-red-400">{actionError}</p>}
    </div>
  );
}

function WaitingCard({
  entry,
  position,
  members,
  services,
  currentMemberId,
  isManagerView,
  shopName,
}: {
  entry: QueueEntry;
  position: number;
  members: BarberMember[];
  services: BarberService[];
  currentMemberId: string;
  isManagerView: boolean;
  shopName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [assignBarberId, setAssignBarberId] = useState(
    entry.preferred_barber_id || currentMemberId
  );
  const service = services.find((s) => s.id === entry.service_id);
  const preferred = members.find((m) => m.id === entry.preferred_barber_id);
  const notified = !!entry.next_sms_sent_at;
  const hasPhone = !!entry.guest_phone;

  const sms = useQueueSmsActions(entry.id, entry.guest_name ?? "there", shopName, notified);

  function handleStart() {
    setActionError(null);
    startTransition(async () => {
      const barberId = isManagerView ? assignBarberId : currentMemberId;
      const result = await startService(entry.id, barberId);
      if (result.error) setActionError(result.error);
    });
  }

  function handleRemove() {
    setActionError(null);
    startTransition(async () => {
      const result = await removeFromQueue(entry.id, "left");
      if (result.error) setActionError(result.error);
    });
  }

  return (
    <div className="barber-panel p-3.5 sm:p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/15 text-sm font-bold text-foreground">
          {position}
        </span>
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <PersonIcon />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{entry.guest_name || "Walk-in"}</p>
            <p className="text-xs text-muted truncate">
              {service ? service.name : "Any service"}
              {preferred ? ` · ${preferred.display_name ?? "Barber"}` : ""}
            </p>
            <p className="text-[11px] text-muted mt-0.5">{formatEstimatedWait(position)}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {notified ? (
            <span className="text-xs font-medium text-foreground">Notified</span>
          ) : hasPhone ? (
            <span className="text-xs font-mono text-foreground/80">{entry.guest_phone}</span>
          ) : null}
        </div>
      </div>

      {isManagerView && !entry.preferred_barber_id ? (
        <div>
          <label htmlFor={`assign-${entry.id}`} className="block text-xs text-muted mb-1">
            Assign barber
          </label>
          <select
            id={`assign-${entry.id}`}
            className={selectClass}
            value={assignBarberId}
            onChange={(e) => setAssignBarberId(e.target.value)}
          >
            {members
              .filter((m) => m.is_accepting_walk_ins)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name ?? "Barber"}
                  {m.chair_number ? ` (Chair ${m.chair_number})` : ""}
                </option>
              ))}
          </select>
        </div>
      ) : null}

      <div className={`grid gap-2 ${isManagerView ? "grid-cols-2" : "grid-cols-1"}`}>
        <button type="button" onClick={handleStart} disabled={isPending} className={btnPrimary}>
          Start
        </button>
        {isManagerView ? (
          <button type="button" onClick={handleRemove} disabled={isPending} className={btnOutline}>
            Remove
          </button>
        ) : null}
      </div>

      {isManagerView && hasPhone && (
        <>
          <div className="grid grid-cols-1 gap-2">
            <button type="button" onClick={sms.handleNotify} disabled={sms.isPending} className={btnPrimary}>
              {sms.isPending ? "Sending…" : notified ? "Re-notify" : "Notify next"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button type="button" onClick={() => sms.setShowMessage((v) => !v)} className={btnOutline}>
              Message
            </button>
          </div>
          {sms.showMessage && (
            <div className="flex gap-2">
              <input
                type="text"
                value={sms.customMessage}
                onChange={(e) => sms.setCustomMessage(e.target.value)}
                placeholder="Custom SMS message…"
                className={messageInputClass}
              />
              <button
                type="button"
                onClick={sms.handleSendCustom}
                disabled={sms.isPending || !sms.customMessage.trim()}
                className={`${btnPrimary} shrink-0`}
              >
                Send
              </button>
            </div>
          )}
          {sms.error && <p className="text-[11px] text-red-400">{sms.error}</p>}
        </>
      )}

      {!isManagerView && !hasPhone && (
        <p className="text-[11px] text-muted text-center">Tap Start when they sit in your chair</p>
      )}

      {isManagerView && !hasPhone && (
        <p className="text-[11px] text-muted text-center">No phone — can&apos;t SMS</p>
      )}

      {actionError && <p className="text-xs text-red-400">{actionError}</p>}
    </div>
  );
}

function InChairCard({
  entry,
  members,
  services,
  shopName,
}: {
  entry: QueueEntry;
  members: BarberMember[];
  services: BarberService[];
  shopName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const barber = members.find((m) => m.id === entry.assigned_barber_id);
  const service = services.find((s) => s.id === entry.service_id);
  const price = service?.price_minor ?? 0;
  const hasPhone = !!entry.guest_phone;

  function handleComplete() {
    setActionError(null);
    startTransition(async () => {
      const result = await completeService(entry.id, "card", price);
      if (result.error) setActionError(result.error);
    });
  }

  function handleNoShow() {
    setActionError(null);
    startTransition(async () => {
      const result = await removeFromQueue(entry.id, "no_show");
      if (result.error) setActionError(result.error);
    });
  }

  function handleSendCustom() {
    if (!customMessage.trim()) return;
    setActionError(null);
    startTransition(async () => {
      const result = await sendQueueCustomMessage(entry.id, customMessage);
      if (result.error) setActionError(result.error);
      else {
        setShowMessage(false);
        setCustomMessage("");
      }
    });
  }

  const elapsed = entry.started_at
    ? Math.round((Date.now() - new Date(entry.started_at).getTime()) / 60_000)
    : 0;

  return (
    <div className="barber-panel-highlight p-3.5 sm:p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-accent/15">
          <ChairIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{entry.guest_name || "Walk-in"}</p>
          {hasPhone && (
            <p className="text-xs font-mono text-foreground/80 mt-0.5">{entry.guest_phone}</p>
          )}
          <p className="text-xs text-muted mt-0.5">
            {barber
              ? `${barber.display_name ?? "Barber"}${barber.chair_number ? ` · Chair ${barber.chair_number}` : ""}`
              : "—"}
            {service ? ` · ${service.name}` : ""}
            {elapsed > 0 ? ` · ${elapsed} min${elapsed !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
        {price > 0 && (
          <span className="text-sm font-semibold tabular-nums shrink-0 text-foreground">{formatPrice(price)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={handleComplete} disabled={isPending} className={`${btnPrimary} py-2.5`}>
          {isPending ? "Completing…" : "Complete"}
        </button>
        <button type="button" onClick={handleNoShow} disabled={isPending} className={`${btnOutline} py-2.5`}>
          No-show
        </button>
      </div>

      {hasPhone && (
        <>
          <div className="grid grid-cols-1 gap-2">
            <button type="button" onClick={() => setShowMessage((v) => !v)} className={btnOutline}>
              Message
            </button>
          </div>
          {showMessage && (
            <div className="flex gap-2">
              <input
                type="text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Custom SMS message…"
                className={messageInputClass}
              />
              <button
                type="button"
                onClick={handleSendCustom}
                disabled={isPending || !customMessage.trim()}
                className={`${btnPrimary} shrink-0`}
              >
                Send
              </button>
            </div>
          )}
        </>
      )}

      {actionError && <p className="text-xs text-red-400">{actionError}</p>}
    </div>
  );
}
