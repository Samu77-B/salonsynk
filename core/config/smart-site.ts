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
  logo: "/imgs/smart/logo-wht.png",
} as const;

export const SMART_NAV_ITEMS = [
  { label: "Home", href: "#hero" },
  { label: "About", href: "#about" },
  { label: "Platforms", href: "#platforms" },
  { label: "Contact", href: `mailto:${SMART_SITE.email}` },
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
