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
      "Hover the day grid for snapped times; click empty space to add at that slot for that stylist",
      "Filters and per-stylist calendars so the floor stays clear",
      "Less double-booking and less spreadsheet chaos",
    ],
    bulletsFull: [
      "Day view (per stylist) and week list so you see the whole team at a glance",
      "Drag to reschedule or reassign appointments",
      "Filters to focus on the right column or day",
      "Add and edit appointments without leaving the diary",
      "Day grid: hover a stylist column to see the snapped time at your pointer; click empty space to open “add appointment” for that stylist and time",
      "Right-click a booking for quick actions (mark status, make sale, running late where configured)",
    ],
  },
  {
    title: "Own the client",
    bulletsHome: [
      "Client records with notes and structured colour formula history",
      "Per-client marketing opt-in for campaign emails",
      "Branded booking page and embed — your look, your URL",
    ],
    bulletsFull: [
      "Client database with notes and structured colour history (brand, formula, processing time, notes)",
      "Per-client marketing opt-in — campaigns only reach clients who’ve agreed and have an email on file",
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
      "Marketing campaigns to opted-in clients — pick an audience, compose, send",
      "Review requests with your Google review link",
      "Re-engagement (“We Miss You”) and aftercare-style messaging where enabled",
    ],
    bulletsFull: [
      "Email appointment reminders",
      "Marketing email campaigns (owners/managers): guided steps — audience, message with design or HTML editor, then review and send via Resend",
      "Campaign audiences: all marketing subscribers, clients with a no-show on record, male/female (from profile), or anyone who’s booked a specific service — with a live recipient count before you send",
      "Optional inbox preview line after the subject; every campaign email includes an unsubscribe link",
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
  "Marketing campaigns to opted-in clients with audience filters and a rich composer (where enabled for your role)",
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
