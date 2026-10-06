import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "ss_club_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

export type ClubSession = {
  salonId: string;
  clientId: string;
  slug: string;
  exp: number;
};

function secret(): string {
  return process.env.CLIENT_PORTAL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-club-secret";
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function encodeClubSession(session: ClubSession): string {
  const payloadB64 = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function decodeClubSession(token: string | undefined | null): ClubSession | null {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as ClubSession;
    if (!parsed.salonId || !parsed.clientId || !parsed.slug || !parsed.exp) return null;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clubCookieName(): string {
  return COOKIE_NAME;
}

export function clubCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function newClubSession(salonId: string, clientId: string, slug: string): ClubSession {
  return {
    salonId,
    clientId,
    slug,
    exp: Date.now() + MAX_AGE_SEC * 1000,
  };
}
