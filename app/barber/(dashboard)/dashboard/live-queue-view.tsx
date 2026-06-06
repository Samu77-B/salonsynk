"use client";

import { useTransition, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@core/supabase/client";
import { startService, completeService, removeFromQueue, addToQueue } from "./actions";
import type { QueueEntry, BarberMember, BarberService } from "./data";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */
type Props = {
  shopId: string;
  queue: QueueEntry[];
  members: BarberMember[];
  services: BarberService[];
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

/* ------------------------------------------------------------------ */
/*  Realtime hook                                                     */
/* ------------------------------------------------------------------ */
const ACTIVE_STATUSES = ["waiting", "in_chair"];

function useRealtimeQueue(shopId: string, serverQueue: QueueEntry[]) {
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
    if (row.shop_id !== shopId) return;
    if (!ACTIVE_STATUSES.includes(row.status)) return;
    setLiveQueue((prev) => {
      if (prev.some((e) => e.id === row.id)) return prev;
      return [...prev, row].sort((a, b) => a.position - b.position);
    });
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

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
export function LiveQueueView({ shopId, queue, members, services, currentMemberId, stats }: Props) {
  const liveQueue = useRealtimeQueue(shopId, queue);

  const waiting = liveQueue.filter((e) => e.status === "waiting");
  const inChair = liveQueue.filter((e) => e.status === "in_chair");

  return (
    <div className="space-y-6">
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
/*  Add walk-in form                                                  */
/* ------------------------------------------------------------------ */
function AddWalkInForm({
  services,
  members,
}: {
  services: BarberService[];
  members: BarberMember[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(() => addToQueue(formData));
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex-1 min-w-[140px]">
        <label htmlFor="guest_name" className="block text-xs text-muted mb-1">Name</label>
        <input
          id="guest_name"
          name="guest_name"
          type="text"
          placeholder="Walk-in"
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
              {s.name} — {formatPrice(s.price_minor)}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[140px]">
        <label htmlFor="preferred_barber_id" className="block text-xs text-muted mb-1">Preferred Barber</label>
        <select
          id="preferred_barber_id"
          name="preferred_barber_id"
          className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Next available</option>
          {members
            .filter((m) => m.is_accepting_walk_ins)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name ?? "Barber"}{m.chair_number ? ` (Chair ${m.chair_number})` : ""}
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
}: {
  entry: QueueEntry;
  position: number;
  members: BarberMember[];
  services: BarberService[];
  currentMemberId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const service = services.find((s) => s.id === entry.service_id);
  const preferred = members.find((m) => m.id === entry.preferred_barber_id);

  function handleStart() {
    startTransition(() => startService(entry.id, currentMemberId));
  }

  function handleRemove() {
    startTransition(() => removeFromQueue(entry.id, "left"));
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 text-sm font-bold">
        {position}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.guest_name || "Walk-in"}</p>
        <p className="text-xs text-muted">
          {service ? service.name : "Any service"}
          {preferred ? ` · Prefers ${preferred.display_name ?? "—"}` : ""}
          {" · "}{waitTime(entry.joined_at)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  In-chair card (with Cash/Card payment toggle)                     */
/* ------------------------------------------------------------------ */
function InChairCard({
  entry,
  members,
  services,
}: {
  entry: QueueEntry;
  members: BarberMember[];
  services: BarberService[];
}) {
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card");
  const barber = members.find((m) => m.id === entry.assigned_barber_id);
  const service = services.find((s) => s.id === entry.service_id);
  const price = service?.price_minor ?? 0;

  function handleComplete() {
    startTransition(() => completeService(entry.id, paymentMethod, price));
  }

  function handleNoShow() {
    startTransition(() => removeFromQueue(entry.id, "no_show"));
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
            {barber ? `${barber.display_name ?? "Barber"}${barber.chair_number ? ` · Chair ${barber.chair_number}` : ""}` : "—"}
            {service ? ` · ${service.name}` : ""}
            {elapsed > 0 ? ` · ${elapsed} min${elapsed !== 1 ? "s" : ""} elapsed` : ""}
          </p>
        </div>
        {price > 0 && (
          <span className="text-sm font-semibold tabular-nums">{formatPrice(price)}</span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Cash/Card toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setPaymentMethod("card")}
            className={`px-4 py-1.5 font-medium transition-colors ${
              paymentMethod === "card"
                ? "bg-blue-600 text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            Card
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            className={`px-4 py-1.5 font-medium transition-colors ${
              paymentMethod === "cash"
                ? "bg-emerald-600 text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            Cash
          </button>
        </div>

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
    </div>
  );
}
