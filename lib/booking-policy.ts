export const JOJOANDFLO_SLUG = "jojoandflo";
export const COLOUR_WAIVER_VERSION = "colour-patch-test-v1";

export type BookingPolicy = {
  phoneRequired: boolean;
  smsConfirmation: boolean;
  newClientColourConsultation: boolean;
  patchTestWaiver: boolean;
  clubPortalEnabled: boolean;
  clubName: string;
  waiverText: string;
  consultationServiceId: string | null;
  /** Colour application cannot be booked sooner than this many days from today. */
  colourMinAdvanceDays: number;
  /** Percentage deposit required to confirm a colour booking. */
  colourDepositPercent: number;
  /** Cancel within this many hours of a colour appointment and the deposit is forfeited. */
  colourLateCancelHours: number;
};

export type ClassifiedService = {
  id: string;
  name: string;
  duration_minutes: number;
  category_id?: string | null;
  isColour: boolean;
  isConsultation: boolean;
};

const COLOUR_RE =
  /\b(colour|color|tint|dye|balayage|highlight|highlights|bleach|toner|root|roots|gloss|foils?|ombre|vivids?|fashion\s*colou?r|lightener|inoa|full\s*head|half\s*head)\b/i;
const CONSULT_RE = /\bconsult/i;

function boolFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

export function isJoJoAndFloSlug(slug: string | null | undefined): boolean {
  return (slug ?? "").trim().toLowerCase() === JOJOANDFLO_SLUG;
}

export function defaultClubName(slug: string, salonName: string): string {
  if (isJoJoAndFloSlug(slug)) return "JoJoFlo Club";
  const base = salonName.trim() || "Salon";
  return `${base} Club`;
}

export function defaultColourWaiverText(salonName: string): string {
  const salon = salonName.trim() || "the salon";
  return `COLOUR SERVICE — PATCH TEST WAIVER

I understand that a skin / patch test is recommended at least 48 hours before a colour service to check for an allergic reaction.

I confirm that ${salon} offered me a patch test and I decline to have one.

I accept that colouring without a recent patch test may cause an allergic reaction, including irritation, swelling, blistering, or in rare cases a more serious medical reaction.

I release ${salon} and its staff from liability arising from my decision to decline a patch test, except where the law does not allow liability to be excluded.

I am signing this electronically. My typed name and/or drawn signature have the same effect as a handwritten signature.`;
}

export function parseBookingPolicy(
  slug: string | null | undefined,
  settings: Record<string, unknown> | null | undefined,
  salonName: string
): BookingPolicy {
  const raw = (settings?.booking_policy as Record<string, unknown> | undefined) ?? {};
  const jojo = isJoJoAndFloSlug(slug);
  const customText = typeof raw.waiver_text === "string" ? raw.waiver_text.trim() : "";
  const clubFromPolicy = typeof raw.club_name === "string" ? raw.club_name.trim() : "";
  const loyalty = (settings?.loyalty as Record<string, unknown> | undefined) ?? {};
  const clubFromLoyalty = typeof loyalty.program_name === "string" ? loyalty.program_name.trim() : "";

  return {
    phoneRequired: boolFlag(raw.phone_required, jojo),
    smsConfirmation: boolFlag(raw.sms_confirmation, jojo),
    newClientColourConsultation: boolFlag(raw.new_client_colour_consultation, jojo),
    patchTestWaiver: boolFlag(raw.patch_test_waiver, jojo),
    clubPortalEnabled: boolFlag(raw.club_portal_enabled, jojo),
    clubName: clubFromPolicy || clubFromLoyalty || defaultClubName(slug ?? "", salonName),
    waiverText: customText || defaultColourWaiverText(salonName),
    consultationServiceId:
      typeof raw.consultation_service_id === "string" && raw.consultation_service_id.trim()
        ? raw.consultation_service_id.trim()
        : null,
    colourMinAdvanceDays: numberFlag(raw.colour_min_advance_days, jojo ? 6 : 0),
    colourDepositPercent: numberFlag(raw.colour_deposit_percent, jojo ? 10 : 0),
    colourLateCancelHours: numberFlag(raw.colour_late_cancel_hours, jojo ? 2 : 0),
  };
}

function numberFlag(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Math.max(0, Number(value));
  }
  return fallback;
}

export function colourMinBookableDate(policy: BookingPolicy, now = new Date()): Date | null {
  if (!policy.colourMinAdvanceDays) return null;
  const min = new Date(now);
  min.setHours(0, 0, 0, 0);
  min.setDate(min.getDate() + policy.colourMinAdvanceDays);
  return min;
}

export function toLocalDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function serializeBookingPolicy(policy: BookingPolicy): Record<string, unknown> {
  return {
    phone_required: policy.phoneRequired,
    sms_confirmation: policy.smsConfirmation,
    new_client_colour_consultation: policy.newClientColourConsultation,
    patch_test_waiver: policy.patchTestWaiver,
    club_portal_enabled: policy.clubPortalEnabled,
    club_name: policy.clubName,
    waiver_text: policy.waiverText,
    consultation_service_id: policy.consultationServiceId,
    colour_min_advance_days: policy.colourMinAdvanceDays,
    colour_deposit_percent: policy.colourDepositPercent,
    colour_late_cancel_hours: policy.colourLateCancelHours,
  };
}

export function classifyHairService(
  name: string,
  categoryName?: string | null
): { isColour: boolean; isConsultation: boolean } {
  const isConsultation = CONSULT_RE.test(name);
  const haystack = `${name} ${categoryName ?? ""}`;
  const looksColour = COLOUR_RE.test(haystack);
  return {
    isConsultation,
    isColour: looksColour && !isConsultation,
  };
}

export function classifyServicesForBooking(
  services: { id: string; name: string; duration_minutes: number; category_id?: string | null }[],
  categories: { id: string; name: string }[]
): ClassifiedService[] {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  return services.map((s) => {
    const classified = classifyHairService(s.name, s.category_id ? catName.get(s.category_id) ?? null : null);
    return {
      ...s,
      isColour: classified.isColour,
      isConsultation: classified.isConsultation,
    };
  });
}

export function findConsultationService(
  services: ClassifiedService[],
  preferredId: string | null
): ClassifiedService | null {
  if (preferredId) {
    const preferred = services.find((s) => s.id === preferredId);
    if (preferred) return preferred;
  }
  return services.find((s) => s.isConsultation) ?? null;
}

export function bookingPolicyActive(policy: BookingPolicy): boolean {
  return (
    policy.phoneRequired ||
    policy.smsConfirmation ||
    policy.newClientColourConsultation ||
    policy.patchTestWaiver ||
    policy.clubPortalEnabled ||
    policy.colourMinAdvanceDays > 0 ||
    policy.colourDepositPercent > 0
  );
}

export function bookingPolicyNotes(policy: BookingPolicy, salonName: string): string {
  const parts: string[] = [];
  if (policy.phoneRequired) {
    parts.push("A mobile number is required to book (confirmation and reminder texts).");
  }
  if (policy.newClientColourConsultation) {
    parts.push(
      `New colour clients must book a colour consultation first — not Full Head, Balayage, or other colour application services until they have been seen.`
    );
  }
  if (policy.patchTestWaiver) {
    parts.push(
      "Colour application requires a patch test, or an e-signed waiver if the client declines. Use the booking form to sign a waiver; do not complete a declined-patch-test colour booking in chat."
    );
  }
  if (policy.colourMinAdvanceDays > 0) {
    parts.push(
      `Colour bookings must be made at least ${policy.colourMinAdvanceDays} days in advance.`
    );
  }
  if (policy.colourDepositPercent > 0) {
    parts.push(
      `Colour bookings require a ${policy.colourDepositPercent}% deposit. Cancellations within ${policy.colourLateCancelHours || 2} hours of the appointment forfeit the deposit.`
    );
  }
  if (policy.clubPortalEnabled) {
    parts.push(`Clients can view their details, points, and visits in ${policy.clubName}.`);
  }
  if (parts.length === 0) return "";
  return `${salonName} booking rules: ${parts.join(" ")}`;
}
