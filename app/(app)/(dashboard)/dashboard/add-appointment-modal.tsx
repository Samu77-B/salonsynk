"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { CreateAppointmentInput } from "./actions";
import { ServicePickerField } from "./service-picker-field";

type Member = { id: string; display_name: string | null; role: string };
type Service = { id: string; name: string; duration_minutes: number; processing_time_minutes?: number };
type Client = { id: string; name: string | null; email: string | null; phone: string | null; last_skin_test_at?: string | null };

function resolveInitialStylistId(members: Member[], initialStylistId?: string | null) {
  if (initialStylistId && members.some((m) => m.id === initialStylistId)) return initialStylistId;
  return members[0]?.id ?? "";
}

export function AddAppointmentModal({
  salonId,
  members,
  services,
  clients,
  currentDate,
  initialStylistId,
  initialTimeHHmm,
  stylistOverrides = {},
  clientPromptData = {},
  onCreate,
  onClose,
}: {
  salonId: string;
  members: Member[];
  services: Service[];
  clients: Client[];
  currentDate: string;
  /** When opening from a diary slot click, pre-select this stylist */
  initialStylistId?: string | null;
  /** HH:mm (24h) for the clicked slot */
  initialTimeHHmm?: string | null;
  stylistOverrides?: Record<string, Record<string, number>>;
  clientPromptData?: Record<string, { lastVisit?: string; lastFormula?: string; alertNotes?: string[] }>;
  onCreate: (data: CreateAppointmentInput) => Promise<{ error?: string | null }>;
  onClose: () => void;
}) {
  const [stylistId, setStylistId] = useState(() => resolveInitialStylistId(members, initialStylistId));
  const [clientId, setClientId] = useState<string>("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState(() => initialTimeHHmm ?? "09:00");
  const [notes, setNotes] = useState("");
  const [sendReminderSms, setSendReminderSms] = useState(true);
  const [sendReviewRequest, setSendReviewRequest] = useState(true);
  const [sendAftercare, setSendAftercare] = useState(false);
  const [allowScheduleOverlap, setAllowScheduleOverlap] = useState(false);
  const [silentService, setSilentService] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientPickerFocused, setClientPickerFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errorAndOverlapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (submitError) {
      errorAndOverlapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [submitError]);

  useEffect(() => {
    if (clientId) {
      const client = clients.find((c) => c.id === clientId);
      setEmail(client?.email ?? "");
      setPhone(client?.phone ?? "");
    } else {
      setEmail("");
      setPhone("");
    }
  }, [clientId, clients]);

  const messagingOn = sendReminderSms || sendReviewRequest || sendAftercare;
  const hasContact = !!(email?.trim() || phone?.trim());

  const selectedClient = clientId ? clients.find((c) => c.id === clientId) : null;

  const serviceSummariesForNotes = selectedServiceIds
    .map((sid) => services.find((x) => x.id === sid))
    .filter((s): s is Service => s !== undefined);

  const durationMinutes = useMemo(() => {
    if (serviceSummariesForNotes.length === 0) return 60;
    let sum = 0;
    for (const s of serviceSummariesForNotes) {
      const ov = stylistId ? stylistOverrides[stylistId]?.[s.id] : undefined;
      sum += ov ?? s.duration_minutes;
    }
    return Math.max(15, sum);
  }, [serviceSummariesForNotes, stylistId, stylistOverrides]);

  const filteredClients = useMemo(() => {
    const raw = clientSearch.trim();
    const q = raw.toLowerCase();
    const digits = raw.replace(/\D/g, "");
    if (!q.length) return clients.slice(0, 20);
    return clients.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const email = (c.email ?? "").toLowerCase();
      const phoneDigits = (c.phone ?? "").replace(/\D/g, "");
      if (name.includes(q) || email.includes(q)) return true;
      if (digits.length >= 3 && phoneDigits.includes(digits)) return true;
      return false;
    }).slice(0, 30);
  }, [clients, clientSearch]);

  const skinTestExpired = (() => {
    if (!selectedClient?.last_skin_test_at) return false;
    const testDate = new Date(selectedClient.last_skin_test_at);
    const monthsSince = (Date.now() - testDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
    return monthsSince >= 12;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stylistId) return;
    const [hours, mins] = time.split(":").map(Number);
    const start = new Date(date + "T12:00:00");
    start.setHours(hours, mins, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    setSubmitError(null);
    setLoading(true);
    try {
      const result = await onCreate({
        salonId,
        stylistId,
        clientId: clientId || null,
        serviceId: selectedServiceIds[0] ?? null,
        serviceIds: selectedServiceIds.length > 0 ? selectedServiceIds : undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        guestName: clientId ? null : guestName?.trim() || null,
        guestEmail: email?.trim() || null,
        guestPhone: phone?.trim() || null,
        notes: notes || null,
        sendReminderSms,
        sendReviewRequest,
        sendAftercare,
        allowScheduleOverlap,
        silentService,
      });
      if (result?.error) setSubmitError(result.error);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not save appointment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 pb-10 pt-[max(0.125rem,env(safe-area-inset-top))] sm:px-6 sm:pt-2 sm:pb-12"
      onClick={onClose}
    >
      <div className="w-full min-w-0 max-w-md xl:max-w-4xl max-h-[min(calc(100dvh-0.75rem),100%)] shrink-0 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-4 shadow-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Add appointment</h2>
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
          <div className="relative z-50">
            {selectedClient ? (
              <>
                <label className="block text-sm font-medium mb-1">Saved client</label>
                <div className="flex gap-2 items-center rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <span className="flex-1 min-w-0 truncate">
                    {selectedClient.name || selectedClient.email || selectedClient.phone || "Saved client"}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-sm text-accent hover:underline"
                    onClick={() => {
                      setClientId("");
                      setClientSearch("");
                    }}
                  >
                    Change
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="block text-sm font-medium mb-1" htmlFor="add-appointment-client-search">
                  Saved client
                </label>
                <input
                  id="add-appointment-client-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Search by name, email, or phone"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  onFocus={() => setClientPickerFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setClientPickerFocused(false), 150);
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                {clientPickerFocused && filteredClients.length > 0 && (
                  <ul
                    role="listbox"
                    aria-label="Matching clients"
                    className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-background py-1 shadow-lg z-[60]"
                  >
                    {filteredClients.map((c) => (
                      <li key={c.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={clientId === c.id}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted/40"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setGuestName("");
                            setClientId(c.id);
                            setClientSearch("");
                          }}
                        >
                          <span className="font-medium">{c.name || "Unnamed"}</span>
                          {(c.email || c.phone) && (
                            <span className="mt-0.5 block text-xs text-muted-foreground truncate">
                              {[c.email, c.phone].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {clientPickerFocused && clientSearch.trim().length > 0 && filteredClients.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No matches — use Walk-in guest below instead.</p>
                ) : null}
              </>
            )}
            {selectedClient && (() => {
              const prompts = clientPromptData[selectedClient.id];
              const hasPrompts = skinTestExpired || prompts?.lastVisit || prompts?.lastFormula || prompts?.alertNotes?.length;
              if (!hasPrompts) return null;

              const weeksSinceVisit = prompts?.lastVisit
                ? Math.floor((Date.now() - new Date(prompts.lastVisit).getTime()) / (7 * 24 * 60 * 60 * 1000))
                : null;

              return (
                <div className="mt-2 space-y-1.5">
                  {skinTestExpired && (
                    <p className="text-sm text-red-400 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
                      Skin test expired — last test was over 12 months ago. A new test may be required before colour services.
                    </p>
                  )}
                  {prompts?.alertNotes?.map((note, i) => (
                    <p key={i} className="text-sm text-amber-400 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                      {note}
                    </p>
                  ))}
                  {weeksSinceVisit !== null && weeksSinceVisit >= 6 && (
                    <p className="text-xs text-muted rounded-lg border border-border px-3 py-2">
                      Last visited {weeksSinceVisit} week{weeksSinceVisit === 1 ? "" : "s"} ago
                    </p>
                  )}
                  {prompts?.lastFormula && (
                    <p className="text-xs text-muted rounded-lg border border-border px-3 py-2">
                      Last colour formula: {prompts.lastFormula}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
            </div>
            <div className="space-y-4 min-w-0">
          {clientId ? (
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
          ) : (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground leading-snug">
                Walk-in guest{" "}
                <span className="font-normal opacity-90">
                  (not linked to your client list — name appears on this booking only.)
                </span>
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="For the diary column"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
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
              {!hasContact && (
                <p className="text-sm text-amber-600">
                  No email or phone – we can&apos;t send a booking confirmation or reminders.
                </p>
              )}
            </div>
          )}
          {clientId && !hasContact && (
            <p className="text-sm text-amber-600">
              No email or phone – we can&apos;t send a booking confirmation or reminders.
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
            id="add-appointment-service-search"
            services={services}
            stylistId={stylistId}
            stylistOverrides={stylistOverrides}
            selectedIds={selectedServiceIds}
            onSelectedIdsChange={setSelectedServiceIds}
            hint={`Type to add one or more; durations are combined for this appointment (${durationMinutes} min total).`}
          />
          {serviceSummariesForNotes.some((s) => (s.processing_time_minutes ?? 0) > 0) && (
            <p className="text-xs text-muted">
              At least one selected service uses processing time — another booking can overlap that window during processing.
            </p>
          )}
          <label className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={silentService}
              onChange={(e) => setSilentService(e.target.checked)}
              className="mt-0.5 rounded border-border"
              aria-label="Quiet session — client prefers minimal conversation"
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">Quiet session</span>
              <span className="block text-muted-foreground text-xs mt-0.5">
                Client prefers minimal small talk — same as Silent booking on checkout.
              </span>
            </span>
          </label>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">Messages to client</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReminderSms}
                onChange={(e) => setSendReminderSms(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Send reminder (SMS/text) before appointment</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReviewRequest}
                onChange={(e) => setSendReviewRequest(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Ask how their experience was after appointment</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendAftercare}
                onChange={(e) => setSendAftercare(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Send aftercare instructions after appointment</span>
            </label>
          </div>
          <div ref={errorAndOverlapRef} className="space-y-3 scroll-mt-4">
          {submitError && (
            <p className="text-sm text-red-400" role="alert">
              {submitError}
            </p>
          )}
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                id="allow-schedule-overlap"
                type="checkbox"
                checked={allowScheduleOverlap}
                onChange={(e) => setAllowScheduleOverlap(e.target.checked)}
                className="mt-1 rounded border-border"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">Add even if this overlaps another booking</span>
                <span className="mt-1 block text-muted">
                  Use for walk-ins or when the diary can’t model your situation (e.g. another client is only processing).
                  The calendar will show two bookings at once for this stylist.
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
              {loading ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
