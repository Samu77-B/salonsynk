/**
 * Page-aware copy for the in-app AI help agent.
 * Keep in sync with real product behaviour (see Help page and navigation).
 */

export type PageHelpContext = {
  pageId: string;
  pageLabel: string;
  /** Short line shown in the chat widget header / “Need help?” area */
  helpPrompt: string;
  /** Longer factual context injected into the model system prompt */
  knowledge: string;
};

const DEFAULT: PageHelpContext = {
  pageId: "general",
  pageLabel: "SalonSynk",
  helpPrompt: "Need help with SalonSynk? Ask me anything about the app.",
  knowledge: `SalonSynk is salon management software: diary, team, clients, checkout (Stripe), online booking, reminders, reports, campaigns, services/products, and settings. Users are staff or owners of a single salon context after login.`,
};

function match(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getPageHelpContext(pathname: string): PageHelpContext {
  const path = pathname || "/";

  if (match(path, "/dashboard")) {
    return {
      pageId: "diary",
      pageLabel: "Diary",
      helpPrompt: "Need help with the diary? I can explain views, colours, dragging, and booking.",
      knowledge: `Diary (/dashboard): Day view shows time columns per stylist (profile photos in headers). Week view lists days. Appointments are coloured by service (not staff). Click an appointment to edit; right-click for status, sale, or running late. Drag to reschedule or move between stylists. Add appointment opens a modal with client prompts (last visit, skin test, colour notes). Stylist-specific service durations may apply if set in Team.`,
    };
  }
  if (match(path, "/team")) {
    return {
      pageId: "team",
      pageLabel: "Team",
      helpPrompt: "Need help managing team members, roles, or PINs?",
      knowledge: `Team (/team): Owners can add/edit/deactivate/delete members, set roles, profile photos, employment type, passcodes (PIN) for admin access, and per-stylist service duration overrides. Invites can be sent for members with email.`,
    };
  }
  if (match(path, "/clients")) {
    return {
      pageId: "clients",
      pageLabel: "Clients",
      helpPrompt: "Need help with clients, notes, or loyalty?",
      knowledge: `Clients (/clients): Client list and detail. Detail includes notes (types: general, colour formula, skin test, etc.), patch/skin test dates, colour formulas, photos, and loyalty tier/points when recorded. List may warn if skin test is overdue.`,
    };
  }
  if (match(path, "/checkout")) {
    return {
      pageId: "checkout",
      pageLabel: "Checkout",
      helpPrompt: "Need help taking payments at checkout?",
      knowledge: `Checkout (/checkout): In-salon payment flow with Stripe — select stylist, client or walk-in, services (and products where applicable). Silent appointment option for clients who prefer a quiet session.`,
    };
  }
  if (match(path, "/reports")) {
    return {
      pageId: "reports",
      pageLabel: "Reports",
      helpPrompt: "Need help reading reports or the business snapshot?",
      knowledge: `Reports (/reports): Owners and managers see KPIs. Sales come from the sales ledger (Stripe). Bookings/completion from appointments. Snapshot tabs: General (revenue, appointments, new clients, rebooking), Staff (per stylist), Gone Aways (lapsed clients). Daily/weekly/monthly/custom range; optional VAT toggle in snapshot; PDF export available.`,
    };
  }
  if (match(path, "/targets")) {
    return {
      pageId: "targets",
      pageLabel: "Targets & incentives",
      helpPrompt: "Need help with staff targets or client loyalty?",
      knowledge: `Targets (/targets): Owners set staff targets (revenue, appointments, or retail) per week or month. Progress uses ledger sales and completed appointments. Client loyalty tab shows points, visits, and tier (bronze/silver/gold). Dashboard shows a small target progress widget when targets exist.`,
    };
  }
  if (match(path, "/campaigns")) {
    return {
      pageId: "campaigns",
      pageLabel: "Campaigns",
      helpPrompt: "Need help with marketing campaigns?",
      knowledge: `Campaigns (/campaigns): Marketing campaigns for the salon (owners/managers). Uses salon data and integrations as configured.`,
    };
  }
  if (match(path, "/services")) {
    return {
      pageId: "services",
      pageLabel: "Services",
      helpPrompt: "Need help editing services, durations, or diary colours?",
      knowledge: `Services (/services): Manage the salon service list — name, duration, price, optional colour (used on diary appointment blocks), processing time where available. Custom per-stylist durations are set under Team, not here.`,
    };
  }
  if (match(path, "/settings")) {
    return {
      pageId: "settings",
      pageLabel: "Settings",
      helpPrompt: "Need help with branding, deposits, Stripe, or reminders?",
      knowledge: `Settings (/settings): Business name/slug, branding (logo, colours), renter admin fee where applicable, no-show and deposit rules, Stripe Connect and subscription, appointment reminder intervals (12h/24h/48h), marketing and Google review link, “we miss you” style marketing fields, tax vault totals where shown.`,
    };
  }
  if (match(path, "/products")) {
    return {
      pageId: "products",
      pageLabel: "Products",
      helpPrompt: "Need help with retail products?",
      knowledge: `Products (/products): Retail product catalogue for the salon, used with checkout and reports where product-tagged sales apply.`,
    };
  }
  if (match(path, "/help")) {
    return {
      pageId: "help",
      pageLabel: "Help",
      helpPrompt: "Browsing help? I can expand on any topic here.",
      knowledge: `Help page: Static documentation plus contact form to support email. The AI agent complements this page but should not contradict official pricing or legal terms not stated in this context.`,
    };
  }
  if (match(path, "/onboarding")) {
    return {
      pageId: "onboarding",
      pageLabel: "Onboarding",
      helpPrompt: "Need help finishing salon setup?",
      knowledge: `Onboarding: User creates or joins their salon so the dashboard unlocks. Until complete, diary and other salon pages are not available.`,
    };
  }
  if (match(path, "/pin")) {
    return {
      pageId: "pin",
      pageLabel: "PIN entry",
      helpPrompt: "Locked out or forgot how PIN access works?",
      knowledge: `PIN screen (/pin): If the salon owner set a 4-digit passcode on your member record, you must enter it after login to open dashboard areas. Owners set PINs in Team settings. This is separate from Supabase email/password login.`,
    };
  }
  if (match(path, "/admin")) {
    return {
      pageId: "admin",
      pageLabel: "Admin",
      helpPrompt: "Need help with super-admin tools?",
      knowledge: `Super-admin area: Cross-salon administration for platform operators — not day-to-day salon staff features.`,
    };
  }

  return DEFAULT;
}
