/**
 * Site branding and links for SmartSynk — central hub for all Synk platforms.
 */

import { SITE } from "@core/config/site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";

export const SMART_SITE = {
  name: "SmartSynk",
  tagline: "One platform. Three worlds.",
  description:
    "SmartSynk unifies SalonSynk, BarberSynk, and NailSynk in one powerful platform.",
  url: "https://smartsynk.net",
  email: "hello@smartsynk.net",
  studio: "Paradigm Digital Studio",
  logo: "/imgs/smart/smartsynk-logo-v2.png",
  icon: "/imgs/smart/smartsynk-icon-v2.png",
  logoWht: "/imgs/smart/smartsynk-logo-wht-v2.png",
} as const;

export const SMART_PLATFORM_FOOTER_LOGOS = [
  {
    id: "salon" as const,
    href: "https://salonsynk.com",
    src: "/imgs/salon/salonsynk-footer-logo.png",
    alt: "SalonSynk",
  },
  {
    id: "barber" as const,
    href: "https://barbersynk.com",
    src: "/imgs/barber/barbersynk-footer-logo.png",
    alt: "BarberSynk",
  },
  {
    id: "nail" as const,
    href: "https://nailsynk.com",
    src: "/imgs/nail/nailsynk-footer-logo.png",
    alt: "NailSynk",
  },
] as const;

export const SMART_NAV_ITEMS = [
  { label: "Platforms", href: "#platforms" },
  { label: "About", href: "#about" },
  { label: "FAQ", href: "#faq" },
] as const;

export const SMART_FAQ_ITEMS = [
  {
    q: "What is SmartSynk?",
    a: "SmartSynk is the central hub for SalonSynk, BarberSynk, and NailSynk. One login gives platform owners and admins access across all three products.",
  },
  {
    q: "Do I need a separate account for each platform?",
    a: "No. Sign in once at smartsynk.net and you'll be routed to the right dashboard for your business — salon, barber shop, or nail studio.",
  },
  {
    q: "Which platform should I use?",
    a: "SalonSynk for hair salons, BarberSynk for barber shops with walk-in queues, and NailSynk for nail studios. Visit each product site to learn more and sign up.",
  },
  {
    q: "How do I get help or request a demo?",
    a: `Email us at ${SMART_SITE.email} and we'll point you to the right Synk platform for your business.`,
  },
] as const;

export const SMART_ABOUT = {
  headline: "we turn ideas into seamless operations.",
  body: "SmartSynk is the central hub connecting salon, barbershop, and nail studio management. One login, one ecosystem, built for the beauty and grooming industry.",
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

export type SmartShowcaseTab = {
  id: SmartPlatformId;
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
          "Simple monthly pricing — no per-service commissions",
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
