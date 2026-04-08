/**
 * Outcome-led feature copy for homepage and /features.
 * Keep in sync with List of services.md and actual product behaviour.
 */

export type OutcomeGroup = {
  title: string;
  /** Shorter bullets for homepage */
  bulletsHome: string[];
  /** Expanded bullets for /features */
  bulletsFull: string[];
};

export const OUTCOME_GROUPS: OutcomeGroup[] = [
  {
    title: "Run the day",
    bulletsHome: [
      "Whole-team diary with day and week views — drag to reschedule or reassign",
      "Filters and per-stylist calendars so the floor stays clear",
      "Less double-booking and less spreadsheet chaos",
    ],
    bulletsFull: [
      "Day view (per stylist) and week list so you see the whole team at a glance",
      "Drag to reschedule or reassign appointments",
      "Filters to focus on the right column or day",
      "Add and edit appointments without leaving the diary",
    ],
  },
  {
    title: "Own the client",
    bulletsHome: [
      "Client records with notes and structured colour formula history",
      "Branded booking page and embed — your look, your URL",
      "Clients pick service, stylist, and time online",
    ],
    bulletsFull: [
      "Client database with notes and structured colour history (brand, formula, processing time, notes)",
      "Branded booking page at your public URL (e.g. salonsynk.com/book/your-salon)",
      "Embeddable booking that can match your primary brand colour",
      "Online booking: clients choose service, stylist, and time — 24/7",
    ],
  },
  {
    title: "Get paid",
    bulletsHome: [
      "Optional Stripe: deposits and in-salon checkout when you’re ready",
      "Diary and bookings work without Stripe — connect when you want payments",
      "Chair renters: split flows via Stripe Connect where configured",
    ],
    bulletsFull: [
      "Stripe is optional: run diary and bookings without connecting payments",
      "Connect Stripe for deposits and in-salon checkout",
      "Checkout supports stylist, client, and services; silent appointment option where configured",
      "Stripe Connect for chair renters — splits and admin fee where configured in your salon",
    ],
  },
  {
    title: "Stay in touch",
    bulletsHome: [
      "Email reminders to cut no-shows",
      "Review requests with your Google review link",
      "Re-engagement (“We Miss You”) and aftercare-style messaging where enabled",
    ],
    bulletsFull: [
      "Email appointment reminders",
      "Post-visit review requests using your Google review URL from settings",
      "We Miss You campaigns for lapsed clients (optional discount code in settings)",
      "Aftercare messaging via scheduled jobs where configured",
    ],
  },
];

/** Shown in pricing card, homepage box, and features page */
export const INCLUDED_IN_PLAN = [
  "Unlimited team members",
  "Unlimited clients",
  "Branded booking page",
  "No per-booking commissions",
  "Diary, team, and client management",
  "Reports and PDF exports from your dashboard",
  "Email reminders and review requests (where configured)",
] as const;

/** Label clearly so buyers trust you vs full-suite incumbents (see docs/FEATURES_ROADMAP.md) */
export const ROADMAP_HIGHLIGHTS = [
  "Inventory and barcode-led stock control",
  "Client memberships (e.g. blow-dry packages) as Stripe subscriptions",
  "Discount code redemption at checkout (codes can appear in We Miss You messages today)",
  "Richer multi-salon / HQ rollups across many locations",
  "Optional: AI voice receptionist for phone bookings",
] as const;

/** Lead-in; pair with a Privacy link in the UI */
export const UK_REASSURANCE_LEAD =
  "Built with UK salons and barbers in mind: pricing in GBP, card flows via Stripe where you connect it.";
