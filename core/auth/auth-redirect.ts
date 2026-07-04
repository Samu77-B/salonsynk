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
 * Must match Supabase redirect allow-list exactly (no query string).
 */
export function getAuthCallbackUrl(platform: AuthPlatform = "salon"): string {
  return `${PLATFORM_URLS[platform].replace(/\/$/, "")}/auth/callback`;
}
