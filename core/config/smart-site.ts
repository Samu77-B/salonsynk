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
} as const;

export const SMART_PLATFORMS = [
  {
    id: "salon" as const,
    name: SITE.name,
    description: "Complete salon management",
    url: SITE.url,
    dashboardPath: "/dashboard",
    color: "#2dd4bf",
    icon: "scissors",
  },
  {
    id: "barber" as const,
    name: BARBER_SITE.name,
    description: "Streamline barbershop operations",
    url: BARBER_SITE.url,
    dashboardPath: "/barber/dashboard",
    color: "#fbbf24",
    icon: "barber-pole",
  },
  {
    id: "nail" as const,
    name: NAIL_SITE.name,
    description: "Elevate nail services and client experience",
    url: NAIL_SITE.url,
    dashboardPath: "/nail/queue",
    color: "#f472b6",
    icon: "nail-polish",
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
