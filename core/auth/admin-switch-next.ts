import type { AuthPlatform } from "@core/auth/auth-redirect";
import { SITE } from "@core/config/site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";
import { SMART_SITE } from "@core/config/smart-site";

/** Safe relative path for post-switch redirects (blocks open redirects). */
export function sanitizeAdminSwitchNext(
  next: string | null | undefined,
  fallback: string
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

const PRODUCT_ORIGINS = [
  SITE.url.replace(/\/$/, ""),
  BARBER_SITE.url.replace(/\/$/, ""),
  NAIL_SITE.url.replace(/\/$/, ""),
] as const;

const SWITCH_PATHS = [
  "/api/admin/switch-salon",
  "/api/admin/switch-barber-shop",
  "/api/admin/switch-nail-salon",
] as const;

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isLocalDevOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const host = normalizeHostname(new URL(origin).hostname);
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function isAllowedProductOrigin(origin: string): boolean {
  const normalized = origin.replace(/\/$/, "");
  if (PRODUCT_ORIGINS.includes(normalized as (typeof PRODUCT_ORIGINS)[number])) return true;
  return isLocalDevOrigin(normalized);
}

/** Allowlisted absolute return URL for master-admin cross-domain handoff. */
export function isAllowedAdminReturnUrl(returnTo: string): boolean {
  try {
    const url = new URL(returnTo);
    if (!isAllowedProductOrigin(url.origin)) return false;
    if (!SWITCH_PATHS.some((path) => url.pathname === path)) return false;
    return Boolean(url.searchParams.get("salonId") || url.searchParams.get("shopId"));
  } catch {
    return false;
  }
}

export function platformFromAdminReturnUrl(returnTo: string): AuthPlatform {
  try {
    const host = normalizeHostname(new URL(returnTo).hostname);
    if (host.includes("barbersynk.com")) return "barber";
    if (host.includes("nailsynk.com")) return "nail";
    return "salon";
  } catch {
    return "salon";
  }
}

export function smartLoginUrlForAdminReturn(returnTo: string): string {
  const loginUrl = new URL(`${SMART_SITE.url.replace(/\/$/, "")}/login`);
  loginUrl.searchParams.set("next", returnTo);
  const platform = platformFromAdminReturnUrl(returnTo);
  if (platform !== "salon") loginUrl.searchParams.set("from", platform);
  return loginUrl.toString();
}

export function superAdminShouldHonorAuthNext(next: string): boolean {
  if (!next.startsWith("/") || next.startsWith("//")) return false;
  if (SWITCH_PATHS.some((path) => next.startsWith(path))) return true;
  if (next.startsWith("/barber/")) return true;
  if (next.startsWith("/nail/")) return true;
  if (next.startsWith("/dashboard") || next.startsWith("/billing")) return true;
  return false;
}
