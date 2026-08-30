/**
 * Site branding and links for SmartSynk — central hub for all Synk platforms.
 */

import { SITE } from "@core/config/site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";
import { PAYSYNK_SITE } from "@core/config/paysynk-site";

export const SMART_SITE = {
  name: "SmartSynk",
  tagline: "One login. Every location.",
  description:
    "The hub for salon, barber, nail, and retail groups — see all your locations in one place, then open any site to run the day.",
  url: "https://smartsynk.net",
  email: "hello@smartsynk.net",
  studio: "Paradigm Digital Studio",
  logo: "/imgs/smart/smartsynk-logo-v2.png",
  icon: "/imgs/smart/smartsynk-icon-v2.png",
  logoWht: "/imgs/smart/smartsynk-logo-wht-v2.png",
  platformIcons: {
    salon: "/imgs/smart/salonsynk-platform-icon.png",
    barber: "/imgs/smart/barbersynk-platform-icon.png",
    nail: "/imgs/smart/nailsynk-platform-icon.png",
  },
} as const;

/** Adjust real DB counts for public SmartSynk marketing stats (front page only). */
export const SMART_LANDING_STAT_DISPLAY = {
  /** 9 real businesses display as 90; each new signup adds 1 (91, 92, …). */
  businessOffset: 81,
  appointmentsMultiplier: 10,
  /** Shown as 1205 with zero real transactions; +1 per actual transaction (1206, 1207, …). */
  transactionBaseline: 1205,
} as const;

export type SmartLandingStats = {
  businesses: number;
  appointments: number;
  transactions: number;
  platforms: number;
};

export function displayLandingStats(raw: SmartLandingStats): SmartLandingStats {
  return {
    businesses: raw.businesses + SMART_LANDING_STAT_DISPLAY.businessOffset,
    appointments: raw.appointments * SMART_LANDING_STAT_DISPLAY.appointmentsMultiplier,
    transactions: SMART_LANDING_STAT_DISPLAY.transactionBaseline + raw.transactions,
    platforms: raw.platforms,
  };
}

export const SMART_NAV_ITEMS = [
  { label: "Platforms", href: "#platforms" },
  { label: "About", href: "#about" },
  { label: "FAQ", href: "#faq" },
] as const;

export const SMART_FAQ_ITEMS = [
  {
    q: "What is SmartSynk?",
    a: "SmartSynk is the hub for SalonSynk, BarberSynk, NailSynk, and PaySynk. If you own several locations — or mix salons, barber shops, nail bars, and retail — one login shows how they are all doing, then lets you open any site.",
  },
  {
    q: "I own multiple salons. Do my managers share my login?",
    a: "No. You sign in at smartsynk.net to see every location you own. Each salon, shop, or nail bar can have its own manager login that only opens that one site.",
  },
  {
    q: "Do I need a separate account for each platform?",
    a: "No. One SmartSynk account covers SalonSynk, BarberSynk, NailSynk, and PaySynk. Own two salons and a nail bar? They all appear on your SmartSynk overview.",
  },
  {
    q: "Which platform should I use?",
    a: "SalonSynk for hair salons, BarberSynk for barber shops with walk-in queues, NailSynk for nail studios, and PaySynk for retail shopfronts and payments. Visit each product site to learn more and sign up — then manage the group from SmartSynk.",
  },
  {
    q: "How do I get help or request a demo?",
    a: `Email us at ${SMART_SITE.email} and we'll point you to the right Synk platform for your business.`,
  },
] as const;

export const SMART_ABOUT = {
  headline: "One owner. Many locations. One hub.",
  body: "Whether you run Hair Top in East London and Birmingham, a barber shop and a nail bar under the same brand, a retail counter on PaySynk, or a growing group across the country — SmartSynk is where group owners see appointments, revenue, and activity across every location. Managers still log into their own site; you stay above the day-to-day with a clear view of the whole group.",
  specializationLabel: "our platforms:",
  watermark: "Sy",
} as const;

export const SMART_HERO_SLIDES = [
  {
    id: "salon" as const,
    headline: "SALON MANAGEMENT REIMAGINED",
    description:
      "Complete salon operations — appointments, clients, team, and payments — unified in one elegant platform.",
    cta: "Explore SalonSynk",
    href: SITE.url,
    image: "/imgs/smart/hero-salon.jpg",
  },
  {
    id: "barber" as const,
    headline: "YOUR SHOP. YOUR QUEUE. YOUR WAY.",
    description:
      "Real-time queue management, hybrid booking, and performance analytics built for modern barbershops.",
    cta: "Explore BarberSynk",
    href: BARBER_SITE.url,
    image: "/imgs/smart/hero-barber.jpg",
  },
  {
    id: "nail" as const,
    headline: "ELEVATE EVERY NAIL EXPERIENCE",
    description:
      "Streamline appointments, client records, and team workflows for nail studios that demand excellence.",
    cta: "Explore NailSynk",
    href: NAIL_SITE.url,
    image: "/imgs/smart/hero-nail.jpg",
  },
] as const;

/** Tabbed platform showcase on SmartSynk landing (replaces carousel). */
export type SmartShowcaseAccordionItem = {
  title: string;
  body: string;
  bullets?: readonly string[];
};

export type SmartPlatformId = "salon" | "barber" | "nail";

/** Marketing platforms listed on SmartSynk (includes PaySynk, which is a separate app). */
export type SmartMarketingPlatformId = SmartPlatformId | "paysynk";

export type SmartShowcaseTab = {
  id: SmartMarketingPlatformId;
  /** Pill label at top of section */
  label: string;
  productName: string;
  tagline: string;
  ctaLabel: string;
  href: string;
  color: string;
  image: string;
  imageAlt: string;
  accordion: readonly SmartShowcaseAccordionItem[];
  features: readonly string[];
};

export const SMART_SHOWCASE_TABS: readonly SmartShowcaseTab[] = [
  {
    id: "salon",
    label: "Hair salons",
    productName: SITE.name,
    tagline: "Complete salon operations — diary, clients, team, and payments in one platform.",
    ctaLabel: "Explore SalonSynk",
    href: SITE.url,
    color: "#2dd4bf",
    image: "/imgs/smart/panel-salon.jpg",
    imageAlt: "SalonSynk salon management platform",
    accordion: [
      {
        title: "Run the day with one diary for your whole team.",
        body: "See every stylist’s column in day or week view. Drag to reschedule, filter by chair, and add bookings without leaving the grid.",
        bullets: [
          "Whole-team diary with day and week views",
          "Drag to reschedule or reassign appointments",
          "Less double-booking and spreadsheet chaos",
        ],
      },
      {
        title: "Own the client relationship — records, colour history, and branded booking.",
        body: "Keep notes, formulas, and marketing opt-ins in one place. Clients book 24/7 on your branded page.",
        bullets: [
          "Client records with structured colour formula history",
          "Branded booking page and embed for your website",
          "Online booking: service, stylist, and time — any time",
        ],
      },
      {
        title: "Get paid and stay in touch when you are ready.",
        body: "Stripe is optional — run the diary first, connect payments when you want deposits or checkout. Reminders and campaigns cut no-shows.",
        bullets: [
          "Optional Stripe for deposits and in-salon checkout",
          "Email reminders and review requests",
          "Marketing campaigns to opted-in clients",
        ],
      },
    ],
    features: [
      "Team diary & scheduling",
      "Client records & colour history",
      "Branded online booking",
      "Optional Stripe payments",
      "Email reminders",
      "Marketing campaigns",
    ],
  },
  {
    id: "barber",
    label: "Barber shops",
    productName: BARBER_SITE.name,
    tagline: "Real-time queue management, hybrid booking, and performance analytics built for barbers.",
    ctaLabel: "Explore BarberSynk",
    href: BARBER_SITE.url,
    color: "#fbbf24",
    image: "/imgs/smart/panel-barber.jpg",
    imageAlt: "BarberSynk queue management for barber shops",
    accordion: [
      {
        title: "Keep walk-ins moving with a live queue every screen can see.",
        body: "No clipboards — add walk-ins from the desk or let clients join from their phone. The whole shop sees the same list in real time.",
        bullets: [
          "Live queue updates across every device in the shop",
          "Add walk-ins manually or via customer self-check-in",
          "Tap Start and Complete to move through the chair",
        ],
      },
      {
        title: "Run walk-ins and pre-booked appointments in one flow.",
        body: "Booked slots sit alongside the queue so nothing clashes and no client gets forgotten.",
        bullets: [
          "Hybrid booking: appointments plus walk-in queue",
          "QR code on your door — no app download for clients",
          "Works on tablet, phone, or laptop",
        ],
      },
      {
        title: "Know how the day is going without end-of-day maths.",
        body: "Track revenue, services completed, and cash vs card as you work. One flat fee — no per-cut commissions.",
        bullets: [
          "Daily revenue and performance stats",
          "Cash and card tracking per client",
          "From £25/mo per shop — no hidden fees",
        ],
      },
    ],
    features: [
      "Real-time queue",
      "QR self-check-in",
      "Hybrid walk-in & bookings",
      "Cash & card tracking",
      "Daily revenue stats",
      "Unlimited barbers",
    ],
  },
  {
    id: "nail",
    label: "Nail bars",
    productName: NAIL_SITE.name,
    tagline: "Walk-in queue management with automatic texts when it is a client’s turn.",
    ctaLabel: "Explore NailSynk",
    href: NAIL_SITE.url,
    color: "#f472b6",
    image: "/imgs/smart/panel-nail.jpg",
    imageAlt: "NailSynk walk-in queue for nail salons",
    accordion: [
      {
        title: "Serve walk-ins in order with a queue the whole team shares.",
        body: "Reception and technicians see the same live list — who is waiting, who is at the station, and who is next.",
        bullets: [
          "Live walk-in queue on every screen",
          "Instant updates when someone joins or starts",
          "No clipboards or shouting names across the salon",
        ],
      },
      {
        title: "Let clients join from the door with a branded QR sticker.",
        body: "They scan, enter their name, and wait nearby. No app download — works in any phone browser.",
        bullets: [
          "Branded window sticker with your unique QR code",
          "Public join page in seconds from their phone",
          "Staff can still add walk-ins at the desk",
        ],
      },
      {
        title: "Text clients automatically when their turn is coming up.",
        body: "When your technician taps Start, waiting clients get a message so they can step back in without hovering at reception.",
        bullets: [
          "SMS when you start the next client",
          "Clients wait nearby until notified",
          "From £25/mo per salon — no per-service commissions",
        ],
      },
    ],
    features: [
      "Live walk-in queue",
      "QR self-check-in",
      "Automatic SMS updates",
      "Team-wide queue view",
      "Branded join page",
      "No client app required",
    ],
  },
  {
    id: "paysynk",
    label: "Retail shops",
    productName: PAYSYNK_SITE.name,
    tagline: "Retail shopfronts and payments — products, checkout, and payouts in one place.",
    ctaLabel: "Explore PaySynk",
    href: PAYSYNK_SITE.url,
    color: "#22c55e",
    image: "/imgs/smart/panel-paysynk.svg",
    imageAlt: "PaySynk retail shopfront and payments",
    accordion: [
      {
        title: "Put your products online with a shop that is yours.",
        body: "Each PaySynk store gets a public shop page. Customers browse your catalogue and pay without leaving your brand.",
        bullets: [
          "Public shop page for every store",
          "Products, prices, and stock in one catalogue",
          "Share a simple link or QR from the till",
        ],
      },
      {
        title: "Take payment without a separate till system.",
        body: "Card checkout runs through Stripe. Record sales, track payouts, and keep retail money in the same picture as your other Synk locations.",
        bullets: [
          "Card payments on your shop page",
          "Payouts to your Stripe account",
          "Sales visible on the SmartSynk overview",
        ],
      },
      {
        title: "Approve shops from SmartSynk, then run them in PaySynk.",
        body: "PaySynk is its own app. Group owners still see stores from SmartSynk; merchants log in at paysynk.com to manage products and payments.",
        bullets: [
          "Pending shops stay private until you approve them",
          "Merchant login at paysynk.com",
          "Fits alongside salons, barber shops, and nail bars",
        ],
      },
    ],
    features: [
      "Public shop page",
      "Product catalogue",
      "Card checkout",
      "Stripe payouts",
      "Stock-aware listings",
      "SmartSynk overview",
    ],
  },
] as const;

export const SMART_PLATFORMS = [
  {
    id: "salon" as const,
    name: SITE.name,
    description: "Complete salon management",
    url: SITE.url,
    dashboardPath: "/dashboard",
    color: "#2dd4bf",
    icon: "scissors",
    panelImage: "/imgs/smart/panel-salon.jpg",
  },
  {
    id: "barber" as const,
    name: BARBER_SITE.name,
    description: "Streamline barbershop operations",
    url: BARBER_SITE.url,
    dashboardPath: "/barber/dashboard",
    color: "#fbbf24",
    icon: "barber-pole",
    panelImage: "/imgs/smart/panel-barber.jpg",
  },
  {
    id: "nail" as const,
    name: NAIL_SITE.name,
    description: "Elevate nail services and client experience",
    url: NAIL_SITE.url,
    dashboardPath: "/nail/queue",
    color: "#f472b6",
    icon: "nail-polish",
    panelImage: "/imgs/smart/panel-nail.jpg",
  },
  {
    id: "paysynk" as const,
    name: PAYSYNK_SITE.name,
    description: "Retail shopfronts and payments",
    url: PAYSYNK_SITE.url,
    dashboardPath: "/admin/paysynk",
    color: "#22c55e",
    icon: "cart",
    panelImage: "/imgs/smart/panel-paysynk.svg",
  },
] as const;

export const SMART_HOSTS = [
  "smartsynk.net",
  "www.smartsynk.net",
  "localhost:3000",
] as const;

export function isSmartSynkHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.includes("smartsynk.net") ||
    (process.env.NODE_ENV === "development" && h.startsWith("localhost"))
  );
}
