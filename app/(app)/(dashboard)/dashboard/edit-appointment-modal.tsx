"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentDbStatus, UpdateAppointmentInput } from "./actions";
import { uploadAppointmentPhoto } from "./actions";
import { ServicePickerField } from "./service-picker-field";
import {
  AppointmentBillSummary,
  billLinesToPatchPayload,
  type BillLineState,
} from "./appointment-bill-summary";
import { parsePoundsToMinor } from "@/lib/appointment-billing";

function isNextOpaqueServerErrorMessage(msg: string): boolean {
  return (
    msg.includes("Server Components render") ||
    msg.includes("digest property") ||
    msg.includes("omitted in production")
  );
}

function scheduleModalRefresh(router: ReturnType<typeof useRouter>) {
  queueMicrotask(() => {
    try {
      router.refresh();
    } catch (e) {
      console.error("[EditAppointmentModal] refresh failed", e);
    }
  });
}

function mapSubmitCatchError(e: unknown, router: ReturnType<typeof useRouter>): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (isNextOpaqueServerErrorMessage(msg)) {
    scheduleModalRefresh(router);
    return "The server returned a generic error while saving — your changes may still have been applied. Close this dialog and check the diary, or refresh the page.";
  }
  return msg.trim() ? msg : "Could not save.";
}

type Member = { id: string; display_name: string | null; role: string };
type Service = { id: string; name: string; duration_minutes: number; processing_time_minutes?: number; price_minor?: number | null };
type Client = { id: string; name: string | null; email: string | null; phone: string | null; last_skin_test_at?: string | null };
type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  deposit_payment_intent_id?: string | null;
  before_photo_url?: string | null;
  after_photo_url?: string | null;
  client_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  stylist_id: string;
  service_id: string | null;
  /** From appointment_services junction (dashboard load). */
  service_line_ids?: string[];
  service_line_bill?: { service_id: string; price_override_minor: number | null; assigned_stylist_id: string | null }[];
  notes: string | null;
  send_reminder_sms?: boolean;
  send_review_request?: boolean;
  send_aftercare?: boolean;
  change_charge_minor?: number | null;
  bill_total_minor?: number | null;
  deposit_amount_minor?: number | null;
};

function svcIdsSignature(ids: string[]): string {
  return [...ids].sort().join("|");
}

function initialAppointmentServiceIds(appointment: Appointment): string[] {
  const line = appointment.service_line_ids?.filter(Boolean) ?? [];
  if (line.length > 0) return line;
  return appointment.service_id ? [appointment.service_id] : [];
}

function timeFromISO(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "09:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isoDateSliceForInput(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function statusDisplayLabel(status: string): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "completed":
      return "Completed";
    case "no_show":
      return "No-show";
    case "canceled":
      return "Cancelled";
    default:
      return status;
  }
}

function PhotoUploadField({
  label,
  photoUrl,
  field,
  appointmentId,
  onUploaded,
}: {
  label: string;
  photoUrl: string;
  field: "before" | "after";
  appointmentId: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const result = await uploadAppointmentPhoto(appointmentId, field, fd);
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        onUploaded(result.url);
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Upload ${label}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {photoUrl ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={label}
            className="w-full aspect-[4/3] object-cover rounded-lg border border-border"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-900"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onUploaded("")}
              className="rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-border hover:border-accent/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted disabled:opacity-50"
        >
          {uploading ? (
            <span className="text-xs">Uploading…</span>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span className="text-xs">Upload or take photo</span>
            </>
          )}
        </button>
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

export type EditModalEntryAnchor = { top: number; left: number; width: number; height: number };

export function EditAppointmentModal({
  appointment,
  members,
  services,
  clients,
  categories = [],
  stylistOverrides = {},
  entryAnchor = null,
  onUpdate,
  onDelete,
  onClose,
  onNoShowCharged,
}: {
  appointment: Appointment;
  members: Member[];
  services: Service[];
  clients: Client[];
  categories?: { id: string; name: string }[];
  stylistOverrides?: Record<string, Record<string, number>>;
  entryAnchor?: EditModalEntryAnchor | null;
  onUpdate: (id: string, data: UpdateAppointmentInput) => Promise<{ error?: string | null }>;
  onDelete: (id: string) => void;
  onClose: () => void;
  onNoShowCharged?: () => void;
}) {
  const router = useRouter();
  const client = clients.find((c) => c.id === appointment.client_id);
  const [stylistId, setStylistId] = useState(appointment.stylist_id);
  const [clientId, setClientId] = useState(appointment.client_id ?? "");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() =>
    initialAppointmentServiceIds(appointment)
  );
  const [guestName, setGuestName] = useState(appointment.guest_name ?? "");
  const [email, setEmail] = useState(appointment.guest_email ?? client?.email ?? "");
  const [phone, setPhone] = useState(appointment.guest_phone ?? client?.phone ?? "");
  const [date, setDate] = useState(isoDateSliceForInput(appointment.start_time));
  const [time, setTime] = useState(timeFromISO(appointment.start_time));
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const [sendReminderSms, setSendReminderSms] = useState(appointment.send_reminder_sms ?? true);
  const [sendReviewRequest, setSendReviewRequest] = useState(appointment.send_review_request ?? true);
  const [sendAftercare, setSendAftercare] = useState(appointment.send_aftercare ?? false);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState(appointment.before_photo_url ?? "");
  const [afterPhotoUrl, setAfterPhotoUrl] = useState(appointment.after_photo_url ?? "");
  const [loading, setLoading] = useState(false);
  const [noShowLoading, setNoShowLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [allowScheduleOverlap, setAllowScheduleOverlap] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [chargePrompt, setChargePrompt] = useState<{
    pendingData: UpdateAppointmentInput;
  } | null>(null);
  const [chargeAmount, setChargeAmount] = useState("");
  const initialBillLines = (): BillLineState[] => {
    const ids = initialAppointmentServiceIds(appointment);
    return ids.map((serviceId) => {
      const row = appointment.service_line_bill?.find((l) => l.service_id === serviceId);
      const overrideMinor = row?.price_override_minor;
      return {
        serviceId,
        priceOverridePounds:
          overrideMinor != null && Number.isFinite(overrideMinor) ? (overrideMinor / 100).toFixed(2) : "",
        assignedStylistId: row?.assigned_stylist_id ?? "",
      };
    });
  };
  const [billLines, setBillLines] = useState<BillLineState[]>(initialBillLines);
  const [billTotalOverridePounds, setBillTotalOverridePounds] = useState(() =>
    appointment.bill_total_minor != null ? (appointment.bill_total_minor / 100).toFixed(2) : ""
  );
  const [depositPounds, setDepositPounds] = useState(() =>
    appointment.deposit_amount_minor != null ? (appointment.deposit_amount_minor / 100).toFixed(2) : ""
  );
  const errorAndOverlapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentStatus = appointment.status ?? "scheduled";
  const canChargeNoShow = currentStatus === "scheduled";

  useEffect(() => {
    if (submitError) {
      errorAndOverlapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [submitError]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cleanupTimeout = 0;
    let innerRaf = 0;

    const runFallbackFromTop = () => {
      panel.style.opacity = "0";
      panel.style.transform = "translateY(-20px)";
      const outerRaf = requestAnimationFrame(() => {
        innerRaf = requestAnimationFrame(() => {
          panel.style.transition =
            "opacity 0.24s cubic-bezier(0.22, 1, 0.36, 1), transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)";
          panel.style.opacity = "1";
          panel.style.transform = "translateY(0)";
          cleanupTimeout = window.setTimeout(() => {
            panel.style.transition = "";
            panel.style.removeProperty("opacity");
            panel.style.removeProperty("transform");
          }, 380);
        });
      });
      return () => {
        cancelAnimationFrame(outerRaf);
        cancelAnimationFrame(innerRaf);
      };
    };

    const runFromAnchor = (anchor: EditModalEntryAnchor) => {
      const pr = panel.getBoundingClientRect();
      const acx = anchor.left + anchor.width / 2;
      const acy = anchor.top + anchor.height / 2;
      const pcx = pr.left + pr.width / 2;
      const pcy = pr.top + pr.height / 2;
      const dx = acx - pcx;
      const dy = acy - pcy;

      panel.style.opacity = "0";
      panel.style.transform = `translate(${dx}px, ${dy}px)`;

      const outerRaf = requestAnimationFrame(() => {
        innerRaf = requestAnimationFrame(() => {
          panel.style.transition =
            "opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1), transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)";
          panel.style.opacity = "1";
          panel.style.transform = "translate(0, 0)";
          cleanupTimeout = window.setTimeout(() => {
            panel.style.transition = "";
            panel.style.removeProperty("opacity");
            panel.style.removeProperty("transform");
          }, 420);
        });
      });
      return () => {
        cancelAnimationFrame(outerRaf);
        cancelAnimationFrame(innerRaf);
      };
    };

    const cancelFall = entryAnchor ? runFromAnchor(entryAnchor) : runFallbackFromTop();
    return () => {
      cancelFall();
      clearTimeout(cleanupTimeout);
      panel.style.transition = "";
      panel.style.removeProperty("opacity");
      panel.style.removeProperty("transform");
    };
  }, [appointment.id, entryAnchor]);

  useEffect(() => {
    const c = clients.find((x) => x.id === appointment.client_id);
    setStylistId(appointment.stylist_id);
    setClientId(appointment.client_id ?? "");
    setSelectedServiceIds(initialAppointmentServiceIds(appointment));
    setGuestName(appointment.guest_name ?? "");
    setEmail(appointment.guest_email ?? c?.email ?? "");
    setPhone(appointment.guest_phone ?? c?.phone ?? "");
    setDate(isoDateSliceForInput(appointment.start_time));
    setTime(timeFromISO(appointment.start_time));
    setNotes(appointment.notes ?? "");
    setSendReminderSms(appointment.send_reminder_sms ?? true);
    setSendReviewRequest(appointment.send_review_request ?? true);
    setSendAftercare(appointment.send_aftercare ?? false);
    setBeforePhotoUrl(appointment.before_photo_url ?? "");
    setAfterPhotoUrl(appointment.after_photo_url ?? "");
    setAllowScheduleOverlap(false);
    setSubmitError(null);
  }, [appointment, clients]);

  const messagingOn = sendReminderSms || sendReviewRequest || sendAftercare;
  const hasContact = !!(email?.trim() || phone?.trim());

  const svcRows = selectedServiceIds
    .map((sid) => services.find((s) => s.id === sid))
    .filter((s): s is Service => s !== undefined);

  const durationMinutes = useMemo(() => {
    if (svcRows.length === 0) return 60;
    let sum = 0;
    for (const s of svcRows) {
      const ov = stylistId ? stylistOverrides[stylistId]?.[s.id] : undefined;
      sum += ov ?? s.duration_minutes;
    }
    return Math.max(15, sum);
  }, [svcRows, stylistId, stylistOverrides]);

  async function applyStatus(next: AppointmentDbStatus, confirmMessage?: string) {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setSubmitError(null);
    setStatusBusy(true);
    try {
      const result = await onUpdate(appointment.id, { status: next });
      if (result?.error) setSubmitError(result.error);
    } catch (e) {
      setSubmitError(mapSubmitCatchError(e, router));
    } finally {
      setStatusBusy(false);
    }
  }

  function buildUpdatePayload(): UpdateAppointmentInput {
    const [hours, mins] = time.split(":").map(Number);
    const startDate = new Date(date + "T12:00:00");
    startDate.setHours(hours, mins, 0, 0);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    return {
      stylist_id: stylistId,
      client_id: clientId || null,
      service_id: selectedServiceIds[0] ?? null,
      serviceBillLines: billLinesToPatchPayload(
        selectedServiceIds.map((serviceId) => {
          const existing = billLines.find((l) => l.serviceId === serviceId);
          return (
            existing ?? {
              serviceId,
              priceOverridePounds: "",
              assignedStylistId: "",
            }
          );
        })
      ),
      guest_name: guestName || null,
      guest_email: email?.trim() || null,
      guest_phone: phone?.trim() || null,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      notes: notes || null,
      send_reminder_sms: sendReminderSms,
      send_review_request: sendReviewRequest,
      send_aftercare: sendAftercare,
      before_photo_url: beforePhotoUrl?.trim() || null,
      after_photo_url: afterPhotoUrl?.trim() || null,
      allowScheduleOverlap,
      bill_total_minor: billTotalOverridePounds.trim() ? parsePoundsToMinor(billTotalOverridePounds) : null,
      deposit_amount_minor: depositPounds.trim() ? parsePoundsToMinor(depositPounds) : null,
      change_charge_minor: appointment.change_charge_minor ?? undefined,
    };
  }

  function hasChargeableChange(data: UpdateAppointmentInput): boolean {
    const origTime = timeFromISO(appointment.start_time);
    const origDate = isoDateSliceForInput(appointment.start_time);
    const timeChanged = data.start_time !== undefined && (
      origDate !== date || origTime !== time
    );
    const serviceChanged =
      svcIdsSignature(selectedServiceIds) !== svcIdsSignature(initialAppointmentServiceIds(appointment));
    return timeChanged || serviceChanged;
  }

  async function executeUpdate(data: UpdateAppointmentInput) {
    setSubmitError(null);
    setLoading(true);
    try {
      const result = await onUpdate(appointment.id, data);
      if (result?.error) setSubmitError(result.error);
    } catch (e) {
      setSubmitError(mapSubmitCatchError(e, router));
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stylistId) return;
    const data = buildUpdatePayload();
    if (hasChargeableChange(data) && currentStatus === "scheduled") {
      setChargePrompt({ pendingData: data });
      setChargeAmount("");
      return;
    }
    await executeUpdate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 pb-10 pt-[max(0.125rem,env(safe-area-inset-top))] sm:px-6 sm:pt-2 sm:pb-12" onClick={onClose}>
      <div
        ref={panelRef}
        className="w-full min-w-0 max-w-md xl:max-w-4xl max-h-[min(calc(100dvh-0.75rem),100%)] shrink-0 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-4 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Edit appointment</h2>
        <div className="mb-4 rounded-lg border border-border bg-muted/20 p-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Current status</p>
            <p className="text-sm font-semibold text-foreground" aria-live="polite">
              {statusDisplayLabel(currentStatus)}
            </p>
          </div>
          {currentStatus === "scheduled" && (
            <p className="text-[11px] text-muted-foreground leading-snug">
              After the client has been seen and the treatment is done, tap <span className="font-medium text-foreground">Mark completed</span>. The diary card will show a green{" "}
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Completed</span> tag.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {currentStatus === "scheduled" && (
              <button
                type="button"
                disabled={statusBusy || loading}
                onClick={() => void applyStatus("completed")}
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Mark completed
              </button>
            )}
            {(currentStatus === "scheduled" || currentStatus === "completed") && (
              <button
                type="button"
                disabled={statusBusy || loading}
                onClick={() =>
                  void applyStatus(
                    "canceled",
                    "Mark this appointment as cancelled? It will stay on the diary as cancelled."
                  )
                }
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
              >
                Mark cancelled
              </button>
            )}
            {currentStatus === "scheduled" && (
              <button
                type="button"
                disabled={statusBusy || loading || noShowLoading}
                onClick={() =>
                  void applyStatus(
                    "no_show",
                    "Mark as no-show without charging a deposit? Use “Charge no-show fee” if you need to capture a deposit."
                  )
                }
                className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 disabled:opacity-50"
              >
                Mark no-show (no charge)
              </button>
            )}
            {(currentStatus === "completed" || currentStatus === "canceled" || currentStatus === "no_show") && (
              <button
                type="button"
                disabled={statusBusy || loading}
                onClick={() =>
                  void applyStatus(
                    "scheduled",
                    "Put this appointment back to scheduled? Use if the status was set by mistake."
                  )
                }
                className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
              >
                Back to scheduled
              </button>
            )}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 xl:gap-x-8 xl:items-start gap-y-4">
            <div className="space-y-4 min-w-0">
              <div>
                <label className="block text-sm font-medium mb-1">Stylist</label>
                <select
                  value={stylistId}
                  onChange={(e) => setStylistId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.display_name || m.role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Client</label>
                <select
                  value={clientId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setClientId(newId);
                    if (newId) {
                      const c = clients.find((x) => x.id === newId);
                      setEmail(c?.email ?? "");
                      setPhone(c?.phone ?? "");
                    } else {
                      setEmail("");
                      setPhone("");
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Walk-in (guest)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.email || c.phone || c.id}</option>
                  ))}
                </select>
              </div>
              {!clientId && (
                <div>
                  <label className="block text-sm font-medium mb-1">Guest name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Name"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
            <div className="space-y-4 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07xxx xxxxxx"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {messagingOn && !hasContact && (
                <p className="text-sm text-amber-600">
                  No email or phone – reminders won&apos;t be sent.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium mb-1">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          <ServicePickerField
            id="edit-appointment-service-search"
            services={services}
            stylistId={stylistId}
            stylistOverrides={stylistOverrides}
            selectedIds={selectedServiceIds}
            onSelectedIdsChange={setSelectedServiceIds}
            categories={categories}
            hint={`Type to add one or more; combined duration for this appointment: ${durationMinutes} min.`}
          />
          <AppointmentBillSummary
            members={members}
            services={services}
            selectedServiceIds={selectedServiceIds}
            billLines={billLines}
            onBillLinesChange={setBillLines}
            billTotalOverridePounds={billTotalOverridePounds}
            onBillTotalOverrideChange={setBillTotalOverridePounds}
            depositPounds={depositPounds}
            onDepositChange={setDepositPounds}
            changeChargeMinor={appointment.change_charge_minor ?? null}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhotoUploadField
              label="Before photo"
              photoUrl={beforePhotoUrl}
              field="before"
              appointmentId={appointment.id}
              onUploaded={(url) => setBeforePhotoUrl(url)}
            />
            <PhotoUploadField
              label="After photo"
              photoUrl={afterPhotoUrl}
              field="after"
              appointmentId={appointment.id}
              onUploaded={(url) => setAfterPhotoUrl(url)}
            />
          </div>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">Messages to client</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReminderSms}
                onChange={(e) => setSendReminderSms(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Send reminder before appointment</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReviewRequest}
                onChange={(e) => setSendReviewRequest(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Ask how their experience was after</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendAftercare}
                onChange={(e) => setSendAftercare(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Send aftercare instructions after</span>
            </label>
          </div>
          {canChargeNoShow && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 space-y-2">
            <p className="text-sm font-medium">No-show with deposit</p>
            <p className="text-xs text-muted-foreground">
              If the client did not arrive and you took a deposit, capture it via Stripe and mark no-show.
            </p>
            <button
              type="button"
              disabled={noShowLoading || statusBusy}
              onClick={async () => {
                if (!confirm("Mark this appointment as no-show and charge the no-show fee (if a deposit was taken)?")) return;
                setNoShowLoading(true);
                try {
                  const res = await fetch(`/api/appointments/${appointment.id}/no-show`, { method: "POST" });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    alert(data.error ?? "Failed to charge no-show fee");
                    return;
                  }
                  onNoShowCharged?.();
                  onClose();
                } finally {
                  setNoShowLoading(false);
                }
              }}
              className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
            >
              {noShowLoading ? "Charging…" : "Charge no-show fee"}
            </button>
          </div>
        )}
          <div ref={errorAndOverlapRef} className="space-y-3 scroll-mt-4">
            {submitError && (
              <p className="text-sm text-red-400" role="alert">
                {submitError}
              </p>
            )}
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  id="edit-allow-schedule-overlap"
                  type="checkbox"
                  checked={allowScheduleOverlap}
                  onChange={(e) => setAllowScheduleOverlap(e.target.checked)}
                  className="mt-1 rounded border-border"
                />
                <span className="text-sm">
                  <span className="font-medium text-foreground">Save even if this overlaps another booking</span>
                  <span className="mt-1 block text-muted">
                    Use when you intentionally want this slot to sit on top of another (e.g. walk-in you already added).
                  </span>
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
              {loading ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(appointment.id)}
              className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors ml-auto"
            >
              Delete
            </button>
          </div>
        </form>

        {chargePrompt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setChargePrompt(null)}>
            <div className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-2">Chargeable change?</h3>
              <p className="text-sm text-muted mb-4">
                You&apos;ve changed the time or service for this appointment. Is this change chargeable to the client?
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Charge amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">&pound;</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
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
                  onClick={() => {
                    const data = chargePrompt.pendingData;
                    setChargePrompt(null);
                    void executeUpdate(data);
                  }}
                >
                  No charge
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
                  disabled={!chargeAmount || Number(chargeAmount) <= 0}
                  onClick={() => {
                    const data = {
                      ...chargePrompt.pendingData,
                      change_charge_minor: Math.round(Number(chargeAmount) * 100),
                    };
                    setChargePrompt(null);
                    void executeUpdate(data);
                  }}
                >
                  Apply charge
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
