"use client";

import { useTransition, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@core/supabase/client";
import { phoneHref, queueSmsBody } from "@modules/barber/lib/queue-sms-messages";
import {
  startService,
  completeService,
  removeFromQueue,
  addToQueue,
  notifyQueueCustomer,
  sendQueueCustomMessage,
} from "./actions";
import type { QueueEntry, StylistMember, SalonServiceOption } from "./data";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */
type Props = {
  salonId: string;
  salonName: string;
  queue: QueueEntry[];
  members: StylistMember[];
  services: SalonServiceOption[];
  currentMemberId: string;
  stats: { todayServed: number; todayCash: number; todayCard: number; todayRevenue: number };
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function waitTime(joinedAt: string): string {
  const mins = Math.round((Date.now() - new Date(joinedAt).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins === 1) return "1 min";
  return `${mins} mins`;
}

function formatPrice(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function serviceOptionLabel(name: string, priceMinor: number): string {
  return priceMinor > 0 ? `${name} — ${formatPrice(priceMinor)}` : name;
}

/* ------------------------------------------------------------------ */
/*  Realtime hook                                                     */
/* ------------------------------------------------------------------ */
const ACTIVE_STATUSES = ["waiting", "in_chair"];

function useRealtimeQueue(salonId: string, serverQueue: QueueEntry[]) {
  const [liveQueue, setLiveQueue] = useState<QueueEntry[]>(serverQueue);

  // Sync when the server re-renders with fresh data (e.g. after a server action)
  const serverRef = useRef(serverQueue);
  useEffect(() => {
    if (serverRef.current !== serverQueue) {
      serverRef.current = serverQueue;
      setLiveQueue(serverQueue);
    }
  }, [serverQueue]);

  const applyInsert = useCallback((row: QueueEntry) => {
    if (row.salon_id !== salonId) return;
    if (!ACTIVE_STATUSES.includes(row.status)) return;
    setLiveQueue((prev) => {
      if (prev.some((e) => e.id === row.id)) return prev;
      return [...prev, row].sort((a, b) => a.position - b.position);
    });
  }, [salonId]);

  const applyUpdate = useCallback((row: QueueEntry) => {
    if (row.salon_id !== salonId) return;
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
  }, [salonId]);

  const applyDelete = useCallback((old: { id: string }) => {
    setLiveQueue((prev) => prev.filter((e) => e.id !== old.id));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`salon_queue:${salonId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "salon_queue", filter: `salon_id=eq.${salonId}` },
        (payload) => applyInsert(payload.new as QueueEntry)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "salon_queue", filter: `salon_id=eq.${salonId}` },
        (payload) => applyUpdate(payload.new as QueueEntry)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "salon_queue", filter: `salon_id=eq.${salonId}` },
        (payload) => applyDelete(payload.old as { id: string })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salonId, applyInsert, applyUpdate, applyDelete]);

  return liveQueue;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
export function LiveQueueView({ salonId, salonName, queue, members, services, currentMemberId, stats }: Props) {
  const router = useRouter();
  const liveQueue = useRealtimeQueue(salonId, queue);

  // Fallback when Realtime is not enabled or RLS blocks websocket updates.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 12_000);
    return () => clearInterval(id);
  }, [router]);

  const waiting = liveQueue.filter((e) => e.status === "waiting");
  const inChair = liveQueue.filter((e) => e.status === "in_chair");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Auto-refreshes every 12 seconds</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-xs text-muted hover:text-foreground border border-border rounded px-2 py-1"
        >
          Refresh now
        </button>
      </div>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="In Queue" value={waiting.length} accent="blue" />
        <StatCard label="In Chair" value={inChair.length} accent="amber" />
        <StatCard label="Served Today" value={stats.todayServed} accent="emerald" />
        <StatCard label="Today Revenue" value={formatPrice(stats.todayRevenue)} accent="violet" />
      </div>

      {/* Add walk-in */}
      <AddWalkInForm services={services} members={members} />

      {/* In Chair section */}
      {inChair.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">
            In Chair ({inChair.length})
          </h2>
          <div className="space-y-2">
            {inChair.map((entry) => (
              <InChairCard
                key={entry.id}
                entry={entry}
                members={members}
                services={services}
                salonName={salonName}
              />
            ))}
          </div>
        </section>
      )}

      {/* Waiting queue */}
      <section>
        <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">
          Waiting ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">No one in the queue right now.</p>
        ) : (
          <div className="space-y-2">
            {waiting.map((entry, idx) => (
              <WaitingCard
                key={entry.id}
                entry={entry}
                position={idx + 1}
                members={members}
                services={services}
                currentMemberId={currentMemberId}
                salonName={salonName}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                         */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-500/30 bg-blue-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[accent] ?? ""}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phone + SMS actions                                               */
/* ------------------------------------------------------------------ */
function QueuePhoneActions({
  phone,
  guestName,
  salonName,
  entryId,
  notified,
}: {
  phone: string;
  guestName: string;
  salonName: string;
  entryId: string;
  notified?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  const smsPreview = queueSmsBody("next", { clientName: guestName, shopName: salonName });
  const { tel, sms } = phoneHref(phone, smsPreview);

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

  return (
    <div className="mt-1 space-y-1">
      <p className="text-xs text-muted font-mono">{phone}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <a
          href={tel}
          className="rounded border border-border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-canvas"
        >
          Call
        </a>
        <a
          href={sms}
          className="rounded border border-border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-canvas"
        >
          SMS app
        </a>
        <button
          type="button"
          onClick={handleNotify}
          disabled={isPending}
          className="rounded bg-violet-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {isPending ? "Sending…" : notified ? "Re-notify" : "Notify next"}
        </button>
        <button
          type="button"
          onClick={() => setShowMessage((v) => !v)}
          className="rounded border border-border px-2 py-0.5 text-[11px] font-medium text-muted hover:text-foreground"
        >
          Message
        </button>
      </div>
      {showMessage && (
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Custom SMS message…"
            className="flex-1 rounded border border-border bg-canvas px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={handleSendCustom}
            disabled={isPending || !customMessage.trim()}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add walk-in form                                                  */
/* ------------------------------------------------------------------ */
function AddWalkInForm({
  services,
  members,
}: {
  services: SalonServiceOption[];
  members: StylistMember[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addToQueue(formData);
      if (result.error) alert(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex-1 min-w-[120px]">
        <label htmlFor="guest_name" className="block text-xs text-muted mb-1">Name</label>
        <input
          id="guest_name"
          name="guest_name"
          type="text"
          placeholder="Walk-in"
          className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="min-w-[120px]">
        <label htmlFor="guest_phone" className="block text-xs text-muted mb-1">Phone</label>
        <input
          id="guest_phone"
          name="guest_phone"
          type="tel"
          placeholder="07..."
          className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="min-w-[140px]">
        <label htmlFor="service_id" className="block text-xs text-muted mb-1">Service</label>
        <select
          id="service_id"
          name="service_id"
          className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Any</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {serviceOptionLabel(s.name, s.price_minor)}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[140px]">
        <label htmlFor="preferred_stylist_id" className="block text-xs text-muted mb-1">Preferred stylist</label>
        <select
          id="preferred_stylist_id"
          name="preferred_stylist_id"
          className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Next available</option>
          {members
            .filter((m) => m.is_accepting_walk_ins)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name ?? "Stylist"}
              </option>
            ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Adding…" : "Add to Queue"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Waiting card                                                      */
/* ------------------------------------------------------------------ */
function WaitingCard({
  entry,
  position,
  members,
  services,
  currentMemberId,
  salonName,
}: {
  entry: QueueEntry;
  position: number;
  members: StylistMember[];
  services: SalonServiceOption[];
  currentMemberId: string;
  salonName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const service = services.find((s) => s.id === entry.service_id);
  const preferred = members.find((m) => m.id === entry.preferred_stylist_id);

  function handleStart() {
    setActionError(null);
    startTransition(async () => {
      const result = await startService(entry.id, currentMemberId);
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
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 text-sm font-bold">
        {position}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.guest_name || "Walk-in"}</p>
        <p className="text-xs text-muted">
          {service ? service.name : "Any service"}
          {preferred ? ` · Prefers ${preferred.display_name ?? "—"}` : ""}
          {" · "}{waitTime(entry.joined_at)}
          {entry.next_sms_sent_at ? " · Notified" : ""}
        </p>
        {entry.guest_phone ? (
          <QueuePhoneActions
            phone={entry.guest_phone}
            guestName={entry.guest_name ?? "there"}
            salonName={salonName}
            entryId={entry.id}
            notified={!!entry.next_sms_sent_at}
          />
        ) : (
          <p className="text-[11px] text-muted/70 mt-0.5">No phone — can&apos;t SMS</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        <button
          onClick={handleStart}
          disabled={isPending}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          Start
        </button>
        <button
          onClick={handleRemove}
          disabled={isPending}
          className="rounded border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
        >
          Remove
        </button>
      </div>
      {actionError && (
        <p className="w-full text-xs text-red-400 basis-full">{actionError}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  In-chair card                                                     */
/* ------------------------------------------------------------------ */
function InChairCard({
  entry,
  members,
  services,
  salonName,
}: {
  entry: QueueEntry;
  members: StylistMember[];
  services: SalonServiceOption[];
  salonName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const stylist = members.find((m) => m.id === entry.assigned_stylist_id);
  const service = services.find((s) => s.id === entry.service_id);
  const price = service?.price_minor ?? 0;

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

  const elapsed = entry.started_at
    ? Math.round((Date.now() - new Date(entry.started_at).getTime()) / 60_000)
    : 0;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600/20 text-amber-400 text-sm font-bold">
          ✂
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{entry.guest_name || "Walk-in"}</p>
          <p className="text-xs text-muted">
            {stylist ? `${stylist.display_name ?? "Stylist"}` : "—"}
            {service ? ` · ${service.name}` : ""}
            {elapsed > 0 ? ` · ${elapsed} min${elapsed !== 1 ? "s" : ""} elapsed` : ""}
          </p>
          {entry.guest_phone && (
            <QueuePhoneActions
              phone={entry.guest_phone}
              guestName={entry.guest_name ?? "there"}
              salonName={salonName}
              entryId={entry.id}
              notified={!!entry.next_sms_sent_at}
            />
          )}
        </div>
        {price > 0 && (
          <span className="text-sm font-semibold tabular-nums">{formatPrice(price)}</span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleComplete}
          disabled={isPending}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Completing…" : "Complete"}
        </button>
        <button
          onClick={handleNoShow}
          disabled={isPending}
          className="rounded border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors ml-auto"
        >
          No-show
        </button>
      </div>
      {actionError && <p className="text-xs text-red-400">{actionError}</p>}
    </div>
  );
}
