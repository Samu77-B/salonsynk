import { SITE } from "@core/config/site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";
import {
  DEFAULT_DASHBOARD_PATH,
  type ProductHost,
} from "@/lib/platform-host";

export type AuthPlatform = "salon" | "barber" | "nail";

const PLATFORM_URLS = {
  salon: SITE.url,
  barber: BARBER_SITE.url,
  nail: NAIL_SITE.url,
} as const;

function productForPlatform(platform: AuthPlatform): ProductHost {
  return platform;
}

/**
 * Canonical OAuth/email auth callback URL for a platform.
 * Includes a default `next` so invite links land on the correct dashboard.
 */
export function getAuthCallbackUrl(
  platform: AuthPlatform = "salon",
  next?: string
): string {
  const base = `${PLATFORM_URLS[platform].replace(/\/$/, "")}/auth/callback`;
  const product = productForPlatform(platform);
  const resolvedNext = next ?? DEFAULT_DASHBOARD_PATH[product];
  return `${base}?next=${encodeURIComponent(resolvedNext)}`;
}

/** Ensure Supabase verify links redirect to the correct product domain callback. */
export function normalizeAuthActionLink(
  actionLink: string,
  platform: AuthPlatform = "salon"
): string {
  try {
    const url = new URL(actionLink);
    const canonical = getAuthCallbackUrl(platform);
    url.searchParams.set("redirect_to", canonical);
    return url.toString();
  } catch {
    return actionLink;
  }
}
