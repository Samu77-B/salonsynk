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
import type { QueueEntry, BarberMember, BarberService } from "./data";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */
type Props = {
  shopId: string;
  shopName: string;
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

function serviceOptionLabel(name: string, priceMinor: number): string {
  return priceMinor > 0 ? `${name} — ${formatPrice(priceMinor)}` : name;
}

/* ------------------------------------------------------------------ */
/*  Icons                                                             */
/* ------------------------------------------------------------------ */
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

function ChairIcon() {
  return (
    <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M5 10v8a1 1 0 001 1h12a1 1 0 001-1v-8M5 10l2-5h10l2 5M8 21v-2m8 2v-2"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Realtime hook                                                     */
/* ------------------------------------------------------------------ */
const ACTIVE_STATUSES = ["waiting", "in_chair"];

function useRealtimeQueue(shopId: string, serverQueue: QueueEntry[]) {
  const [liveQueue, setLiveQueue] = useState<QueueEntry[]>(serverQueue);

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
export function LiveQueueView({ shopId, shopName, queue, members, services, currentMemberId, stats }: Props) {
  const router = useRouter();
  const liveQueue = useRealtimeQueue(shopId, queue);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 12_000);
    return () => clearInterval(id);
  }, [router]);

  const waiting = liveQueue.filter((e) => e.status === "waiting");
  const inChair = liveQueue.filter((e) => e.status === "in_chair");

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="In Queue" value={waiting.length} accent="blue" />
        <StatCard label="In Chair" value={inChair.length} accent="amber" />
        <StatCard label="Served Today" value={stats.todayServed} accent="emerald" />
      </div>

      {/* Collapsible add customer */}
      <AddCustomerPanel services={services} members={members} />

      {/* In Chair section */}
      {inChair.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2.5">
            In Chair ({inChair.length})
          </h2>
          <div className="space-y-2.5">
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

      {/* Waiting queue */}
      <section>
        <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2.5">
          Waiting Queue ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center rounded-xl border border-border/60 bg-card/40">
            No one in the queue right now.
          </p>
        ) : (
          <div className="space-y-2.5">
            {waiting.map((entry, idx) => (
              <WaitingCard
                key={entry.id}
                entry={entry}
                position={idx + 1}
                members={members}
                services={services}
                currentMemberId={currentMemberId}
                shopName={shopName}
              />
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] text-muted/70 text-center pt-1">
        Auto-refreshes every 12 seconds ·{" "}
        <button
          type="button"
          onClick={() => router.refresh()}
          className="underline hover:text-muted transition-colors"
        >
          Refresh now
        </button>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                         */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  const styles: Record<string, { glow: string; border: string }> = {
    blue: { glow: "bg-blue-500/25", border: "border-blue-500/20" },
    amber: { glow: "bg-amber-500/25", border: "border-amber-500/20" },
    emerald: { glow: "bg-emerald-500/25", border: "border-emerald-500/20" },
  };
  const style = styles[accent] ?? styles.blue;

  return (
    <div className={`relative overflow-hidden rounded-xl border ${style.border} bg-card/60 px-3 py-2.5 sm:px-4 sm:py-3`}>
      <div className={`absolute -top-3 -right-3 h-10 w-10 rounded-full blur-xl ${style.glow}`} />
      <p className="relative text-[10px] sm:text-xs text-muted leading-tight">{label}</p>
      <p className="relative text-xl sm:text-2xl font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared button styles                                              */
/* ------------------------------------------------------------------ */
const btnPrimary =
  "rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold text-white transition-colors disabled:opacity-50";
const btnOutline =
  "rounded-lg border border-border/80 bg-transparent px-3 py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors";

/* ------------------------------------------------------------------ */
/*  SMS helpers                                                       */
/* ------------------------------------------------------------------ */
function useQueueSmsActions(
  entryId: string,
  phone: string,
  guestName: string,
  shopName: string,
  notified: boolean
) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  const smsPreview = queueSmsBody("next", { clientName: guestName, shopName });
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

  return {
    isPending,
    error,
    showMessage,
    setShowMessage,
    customMessage,
    setCustomMessage,
    tel,
    sms,
    handleNotify,
    handleSendCustom,
    notified,
  };
}

/* ------------------------------------------------------------------ */
/*  Add customer accordion                                            */
/* ------------------------------------------------------------------ */
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
    <div className="rounded-xl border border-border/80 overflow-hidden bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-foreground/[0.03] transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">Add Customer</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <form action={handleSubmit} className="border-t border-border/60 px-4 py-4 space-y-3">
          <div>
            <label htmlFor="guest_name" className="block text-xs text-muted mb-1.5">
              Name
            </label>
            <input
              id="guest_name"
              name="guest_name"
              type="text"
              placeholder="Walk-in"
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="guest_phone" className="block text-xs text-muted mb-1.5">
              Phone
            </label>
            <input
              id="guest_phone"
              name="guest_phone"
              type="tel"
              placeholder="07..."
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="service_id" className="block text-xs text-muted mb-1.5">
              Service
            </label>
            <select
              id="service_id"
              name="service_id"
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
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
            <select
              id="preferred_barber_id"
              name="preferred_barber_id"
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
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
          <button
            type="submit"
            disabled={isPending}
            className={`w-full ${btnPrimary} bg-blue-600 hover:bg-blue-700 py-3`}
          >
            {isPending ? "Adding…" : "Add to Queue"}
          </button>
        </form>
      )}
    </div>
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
  shopName,
}: {
  entry: QueueEntry;
  position: number;
  members: BarberMember[];
  services: BarberService[];
  currentMemberId: string;
  shopName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const service = services.find((s) => s.id === entry.service_id);
  const preferred = members.find((m) => m.id === entry.preferred_barber_id);
  const notified = !!entry.next_sms_sent_at;
  const hasPhone = !!entry.guest_phone;

  const sms = useQueueSmsActions(
    entry.id,
    entry.guest_phone ?? "",
    entry.guest_name ?? "there",
    shopName,
    notified
  );

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
    <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-sm font-bold text-blue-400">
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
            <p className="text-[11px] text-muted/80 mt-0.5">{waitTime(entry.joined_at)}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {notified ? (
            <span className="text-xs font-medium text-emerald-400">Notified</span>
          ) : hasPhone ? (
            <span className="text-xs font-mono text-emerald-400">{entry.guest_phone}</span>
          ) : null}
        </div>
      </div>

      {/* Primary actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={isPending}
          className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700`}
        >
          Start
        </button>
        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          className={`${btnPrimary} bg-orange-600/90 hover:bg-orange-600`}
        >
          Remove
        </button>
      </div>

      {/* Phone / SMS actions */}
      {hasPhone && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={sms.handleNotify}
              disabled={sms.isPending}
              className={`${btnPrimary} bg-violet-600 hover:bg-violet-700`}
            >
              {sms.isPending ? "Sending…" : notified ? "Re-notify" : "Notify next"}
            </button>
            <a href={sms.tel} className={`${btnOutline} text-center`}>
              Call
            </a>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => sms.setShowMessage((v) => !v)}
              className={btnOutline}
            >
              Message
            </button>
            <a href={sms.sms} className={`${btnOutline} text-center`}>
              SMS app
            </a>
          </div>
          {sms.showMessage && (
            <div className="flex gap-2">
              <input
                type="text"
                value={sms.customMessage}
                onChange={(e) => sms.setCustomMessage(e.target.value)}
                placeholder="Custom SMS message…"
                className="flex-1 rounded-lg border border-border bg-canvas px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={sms.handleSendCustom}
                disabled={sms.isPending || !sms.customMessage.trim()}
                className={`${btnPrimary} bg-blue-600 hover:bg-blue-700 shrink-0`}
              >
                Send
              </button>
            </div>
          )}
          {sms.error && <p className="text-[11px] text-red-400">{sms.error}</p>}
        </>
      )}

      {!hasPhone && (
        <p className="text-[11px] text-muted/70 text-center">No phone — can&apos;t SMS</p>
      )}

      {actionError && <p className="text-xs text-red-400">{actionError}</p>}
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

  const smsPreview = queueSmsBody("next", { clientName: entry.guest_name ?? "there", shopName });
  const phoneLinks = hasPhone ? phoneHref(entry.guest_phone!, smsPreview) : null;

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
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
          <ChairIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{entry.guest_name || "Walk-in"}</p>
          {hasPhone && (
            <p className="text-xs font-mono text-emerald-400 mt-0.5">{entry.guest_phone}</p>
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
          <span className="text-sm font-semibold tabular-nums shrink-0">{formatPrice(price)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleComplete}
          disabled={isPending}
          className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700 py-2.5`}
        >
          {isPending ? "Completing…" : "Complete"}
        </button>
        <button
          type="button"
          onClick={handleNoShow}
          disabled={isPending}
          className={`${btnPrimary} bg-orange-600/90 hover:bg-orange-600 py-2.5`}
        >
          No-show
        </button>
      </div>

      {hasPhone && phoneLinks && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <a href={phoneLinks.tel} className={`${btnOutline} text-center`}>
              Call
            </a>
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
                className="flex-1 rounded-lg border border-border bg-canvas px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={handleSendCustom}
                disabled={isPending || !customMessage.trim()}
                className={`${btnPrimary} bg-blue-600 hover:bg-blue-700 shrink-0`}
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
