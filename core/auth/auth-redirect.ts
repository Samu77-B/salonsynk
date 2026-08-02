import { SITE } from "@core/config/site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";

export type AuthPlatform = "salon" | "barber" | "nail";

/** OTP / email-link types accepted by `/auth/callback` + `verifyOtp`. */
export type AuthLinkType = "invite" | "recovery" | "magiclink" | "signup";

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

function isSynkProductHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.includes("salonsynk.com") ||
    h.includes("barbersynk.com") ||
    h.includes("nailsynk.com") ||
    h.includes("smartsynk.net") ||
    h === "localhost" ||
    h.startsWith("127.0.0.1")
  );
}

/**
 * Rewrite Supabase action links onto the correct product domain.
 * Prefer setting redirect_to; if the link already points at a Synk host
 * (often the project Site URL = salonsynk.com), move it to this platform.
 */
export function normalizeAuthActionLink(
  actionLink: string,
  platform: AuthPlatform = "salon"
): string {
  try {
    const url = new URL(actionLink);
    const canonical = getAuthCallbackUrl(platform);
    const canonicalUrl = new URL(canonical);

    url.searchParams.set("redirect_to", canonical);

    if (isSynkProductHost(url.hostname) && url.hostname !== canonicalUrl.hostname) {
      url.protocol = canonicalUrl.protocol;
      url.host = canonicalUrl.host;
      if (url.pathname === "/" || url.pathname === "") {
        url.pathname = canonicalUrl.pathname;
      }
    }

    return url.toString();
  } catch {
    return actionLink;
  }
}

/**
 * Build a set-password / login URL that opens on the product domain.
 *
 * Prefer `hashed_token` → `https://{platform}/auth/callback?token_hash=…&type=…`
 * so verify runs server-side on the correct host. Supabase `action_link` goes
 * through the project verify endpoint and often falls back to Site URL
 * (salonsynk.com), which is why Barber/Nail welcome emails were opening SalonSynk.
 */
export function buildPlatformAuthLink(
  linkData: unknown,
  platform: AuthPlatform,
  type: AuthLinkType
): string | null {
  if (!linkData || typeof linkData !== "object") return null;
  const root = linkData as Record<string, unknown>;
  const props =
    root.properties && typeof root.properties === "object"
      ? (root.properties as Record<string, unknown>)
      : undefined;

  const hashedToken =
    (typeof props?.hashed_token === "string" && props.hashed_token) ||
    (typeof root.hashed_token === "string" && root.hashed_token) ||
    null;

  if (hashedToken) {
    const callback = new URL(getAuthCallbackUrl(platform));
    callback.searchParams.set("token_hash", hashedToken);
    callback.searchParams.set("type", type);
    return callback.toString();
  }

  const user =
    root.user && typeof root.user === "object"
      ? (root.user as Record<string, unknown>)
      : undefined;

  const actionLink =
    (typeof props?.action_link === "string" && props.action_link) ||
    (typeof root.action_link === "string" && root.action_link) ||
    (typeof user?.action_link === "string" && user.action_link) ||
    null;

  if (actionLink) return normalizeAuthActionLink(actionLink, platform);
  return null;
}
