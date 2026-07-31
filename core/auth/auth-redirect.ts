import { SITE } from "@core/config/site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";

export type AuthPlatform = "salon" | "barber" | "nail";

const PLATFORM_URLS = {
  salon: SITE.url,
  barber: BARBER_SITE.url,
  nail: NAIL_SITE.url,
} as const;

/**
 * Canonical OAuth/email auth callback URL for a platform.
 * Must match the Supabase redirect allow-list exactly — no query string, or
 * Supabase discards it and falls back to the project Site URL (salonsynk.com).
 * The callback route derives the destination dashboard from the request host.
 */
export function getAuthCallbackUrl(platform: AuthPlatform = "salon"): string {
  return `${PLATFORM_URLS[platform].replace(/\/$/, "")}/auth/callback`;
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
