export type AiBookingService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceMinor: number | null;
};

export type AiBookingStylist = {
  id: string;
  name: string;
};

export type AiBookingClient = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type AiBookingContext = {
  salonId: string;
  salonName: string;
  services: AiBookingService[];
  stylists: AiBookingStylist[];
  clients: AiBookingClient[];
  stylistOverrides: Record<string, Record<string, number>>;
};

export type SalonBookingCatalog = {
  salonId: string;
  salonName: string;
  services: AiBookingService[];
  stylists: AiBookingStylist[];
  clients: AiBookingClient[];
  stylistOverrides: Record<string, Record<string, number>>;
};

export type ResolveResult<T> =
  | { ok: true; item: T }
  | { ok: false; error: string; suggestions: string[] };

export type SlotCandidate = {
  startIso: string;
  endIso: string;
  dayLabel: string;
  timeLabel: string;
};

export type TimePreference = "morning" | "afternoon" | "evening" | "any";
