"use client";

import { useMemo, useState } from "react";
import { createGuestBooking } from "./actions";
import { ColourWaiverForm, type ColourWaiverValue } from "@/components/public/colour-waiver-form";
import type { BookingPolicy, ClassifiedService } from "@/lib/booking-policy";
import { findConsultationService } from "@/lib/booking-policy";

type Category = { id: string; name: string };
type Stylist = { id: string; display_name: string | null };

function ServiceSelect({
  services,
  categories,
  value,
  onChange,
}: {
  services: ClassifiedService[];
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    if (categories.length === 0) return null;
    const uncategorised = services.filter((s) => !s.category_id);
    const byCat = new Map<string, ClassifiedService[]>();
    for (const s of services) {
      if (s.category_id) {
        const list = byCat.get(s.category_id) ?? [];
        list.push(s);
        byCat.set(s.category_id, list);
      }
    }
    return { categories, byCat, uncategorised };
  }, [services, categories]);

  return (
    <div>
      <label className="block text-sm font-medium mb-1">Service</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="">Select</option>
        {grouped ? (
          <>
            {grouped.categories.map((cat) => {
              const items = grouped.byCat.get(cat.id) ?? [];
              if (items.length === 0) return null;
              return (
                <optgroup key={cat.id} label={cat.name}>
                  {items.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              );
            })}
            {grouped.uncategorised.length > 0 && (
              <optgroup label="Other">
                {grouped.uncategorised.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            )}
          </>
        ) : (
          services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))
        )}
      </select>
    </div>
  );
}

export function GuestBookingForm({
  salonId,
  salonName,
  services,
  stylists,
  stylistOverrides = {},
  categories = [],
  prefillStylistId,
  prefillStartIso,
  policy,
  clubHref,
}: {
  salonId: string;
  salonName: string;
  services: ClassifiedService[];
  stylists: Stylist[];
  stylistOverrides?: Record<string, Record<string, number>>;
  categories?: Category[];
  prefillStylistId?: string;
  prefillStartIso?: string;
  policy: BookingPolicy;
  clubHref?: string;
}) {
  const prefillStart = prefillStartIso ? new Date(prefillStartIso) : null;
  const validPrefillStylist =
    prefillStylistId && stylists.some((s) => s.id === prefillStylistId) ? prefillStylistId : undefined;
  const consultation = findConsultationService(services, policy.consultationServiceId);

  const [serviceId, setServiceId] = useState("");
  const [stylistId, setStylistId] = useState(validPrefillStylist ?? stylists[0]?.id ?? "");
  const [date, setDate] = useState(
    prefillStart && Number.isFinite(prefillStart.getTime())
      ? prefillStart.toISOString().slice(0, 10)
      : ""
  );
  const [time, setTime] = useState(
    prefillStart && Number.isFinite(prefillStart.getTime())
      ? prefillStart.toTimeString().slice(0, 5)
      : "09:00"
  );
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [silentService, setSilentService] = useState(false);
  const [hadColourBefore, setHadColourBefore] = useState<"" | "yes" | "no">("");
  const [patchTestChoice, setPatchTestChoice] = useState<"" | "will_test" | "decline">("");
  const [waiver, setWaiver] = useState<ColourWaiverValue>({
    agreed: false,
    signerName: "",
    signatureData: "",
  });
  const [joinClub, setJoinClub] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmationEmailError, setConfirmationEmailError] = useState<string | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [remappedToConsultation, setRemappedToConsultation] = useState(false);
  const [bookedServiceName, setBookedServiceName] = useState<string | null>(null);

  const selected = services.find((s) => s.id === serviceId);
  const colourNeedsHistory = Boolean(
    policy.newClientColourConsultation && selected?.isColour && !selected.isConsultation
  );
  const treatAsNewColour = colourNeedsHistory && hadColourBefore === "no";
  const effectiveService =
    treatAsNewColour && consultation ? consultation : selected;
  const colourNeedsPatch =
    Boolean(policy.patchTestWaiver && effectiveService?.isColour && !effectiveService.isConsultation);

  function handleServiceChange(id: string) {
    setServiceId(id);
    setHadColourBefore("");
    setPatchTestChoice("");
    setWaiver({ agreed: false, signerName: "", signatureData: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (policy.phoneRequired && guestPhone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid mobile number so we can text your confirmation and reminder.");
      return;
    }
    if (colourNeedsHistory && !hadColourBefore) {
      setError("Please tell us whether you have had colour at this salon before.");
      return;
    }
    if (colourNeedsHistory && hadColourBefore === "no" && !consultation) {
      setError("New colour clients need a consultation service. Please contact the salon to book.");
      return;
    }
    if (colourNeedsPatch && !patchTestChoice) {
      setError("Please confirm your patch test choice.");
      return;
    }
    if (colourNeedsPatch && patchTestChoice === "decline" && (!waiver.agreed || waiver.signerName.trim().length < 2)) {
      setError("Please e-sign the colour waiver to continue without a patch test.");
      return;
    }

    const bookedService = effectiveService ?? selected;
    setLoading(true);
    const start = new Date(`${date}T${time}:00`);
    const overrideDur =
      stylistId && bookedService?.id ? stylistOverrides[stylistId]?.[bookedService.id] : undefined;
    const end = new Date(start.getTime() + (overrideDur ?? bookedService?.duration_minutes ?? 60) * 60 * 1000);
    const result = await createGuestBooking(salonId, {
      serviceId: bookedService?.id || serviceId || undefined,
      stylistId: stylistId || undefined,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      guestName,
      guestEmail,
      guestPhone,
      silentService,
      returningColourClient: hadColourBefore === "yes",
      patchTestChoice: colourNeedsPatch ? patchTestChoice || undefined : undefined,
      waiver:
        colourNeedsPatch && patchTestChoice === "decline"
          ? { agreed: waiver.agreed, signerName: waiver.signerName, signatureData: waiver.signatureData }
          : undefined,
      joinClub: policy.clubPortalEnabled ? joinClub : undefined,
    });
    setLoading(false);
    if (result.error || !("appointmentId" in result)) {
      setConfirmationEmailError(null);
      setError(result.error || "Could not complete booking.");
    } else {
      setConfirmationEmailError(result.confirmationEmailError ?? null);
      setSmsSent(Boolean(result.smsSent));
      setRemappedToConsultation(Boolean(result.remappedToConsultation));
      setBookedServiceName(result.bookedServiceName ?? bookedService?.name ?? null);
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="space-y-2 text-center text-sm">
        <p className="text-green-400">Booking confirmed{bookedServiceName ? ` — ${bookedServiceName}` : ""}.</p>
        {remappedToConsultation ? (
          <p className="text-amber-200/90">
            New colour clients book a consultation first. We&apos;ve reserved a consultation rather than a full colour
            service.
          </p>
        ) : null}
        {confirmationEmailError ? (
          <p className="text-amber-200/90">
            We couldn&apos;t send the confirmation email ({confirmationEmailError}). Please save your date and time.
          </p>
        ) : (
          <p className="text-muted">
            We sent a confirmation to your email
            {policy.smsConfirmation || policy.phoneRequired
              ? smsSent
                ? " and a text to your phone."
                : ". A text reminder will follow before your appointment."
              : "."}
          </p>
        )}
        {policy.clubPortalEnabled && clubHref ? (
          <p>
            <a href={clubHref} target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Open {policy.clubName}
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ServiceSelect
        services={services}
        categories={categories}
        value={treatAsNewColour && consultation ? consultation.id : serviceId}
        onChange={handleServiceChange}
      />
      {colourNeedsHistory ? (
        <fieldset className="space-y-2 rounded-lg border border-border p-3">
          <legend className="text-sm font-medium">Have you had colour at {salonName} before?</legend>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="had-colour"
              checked={hadColourBefore === "yes"}
              onChange={() => setHadColourBefore("yes")}
              className="mt-0.5"
            />
            <span>Yes — I&apos;m a returning colour client</span>
          </label>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="had-colour"
              checked={hadColourBefore === "no"}
              onChange={() => setHadColourBefore("no")}
              className="mt-0.5"
            />
            <span>No — this would be my first colour here</span>
          </label>
          {treatAsNewColour ? (
            <p className="text-xs text-amber-200/90">
              New colour clients book a consultation first (not Full Head, Balayage, or similar) so we can check
              suitability and arrange a patch test.
              {consultation ? ` We&apos;ll reserve ${consultation.name}.` : ""}
            </p>
          ) : null}
        </fieldset>
      ) : null}
      {colourNeedsPatch ? (
        <fieldset className="space-y-2 rounded-lg border border-border p-3">
          <legend className="text-sm font-medium">Patch test</legend>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="patch-test"
              checked={patchTestChoice === "will_test"}
              onChange={() => setPatchTestChoice("will_test")}
              className="mt-0.5"
            />
            <span>I will complete a patch test before this colour appointment</span>
          </label>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="patch-test"
              checked={patchTestChoice === "decline"}
              onChange={() => setPatchTestChoice("decline")}
              className="mt-0.5"
            />
            <span>I decline a patch test and will e-sign a waiver</span>
          </label>
          {patchTestChoice === "decline" ? (
            <ColourWaiverForm
              salonName={salonName}
              waiverText={policy.waiverText}
              value={waiver}
              onChange={setWaiver}
            />
          ) : null}
        </fieldset>
      ) : null}
      <div>
        <label className="block text-sm font-medium mb-1">Preferred stylist</label>
        <select
          value={stylistId}
          onChange={(e) => setStylistId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {stylists.map((s) => (
            <option key={s.id} value={s.id}>{s.display_name || "Any"}</option>
          ))}
        </select>
      </div>
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
        <label className="block text-sm font-medium mb-1">Your name</label>
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          Phone{policy.phoneRequired ? " (required for texts)" : ""}
        </label>
        <input
          type="tel"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          required={policy.phoneRequired}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        {policy.phoneRequired ? (
          <p className="mt-1 text-xs text-muted">We text a confirmation and a reminder before your appointment.</p>
        ) : null}
      </div>
      {policy.clubPortalEnabled ? (
        <label className="flex items-start gap-2 py-1 cursor-pointer">
          <input
            type="checkbox"
            checked={joinClub}
            onChange={(e) => setJoinClub(e.target.checked)}
            className="mt-0.5 rounded border-border bg-background"
          />
          <span className="text-sm">
            Join {policy.clubName} — see your details, points, and visits
          </span>
        </label>
      ) : null}
      <label className="flex items-center gap-2 py-2 cursor-pointer">
        <input
          type="checkbox"
          checked={silentService}
          onChange={(e) => setSilentService(e.target.checked)}
          className="rounded border-border bg-background"
          aria-label="Silent Appointment"
        />
        <span className="text-sm font-medium">Silent Appointment</span>
      </label>
      <p className="text-xs text-muted-foreground -mt-2">
        Check this for a quiet session with no small talk.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
