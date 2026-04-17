import { createHmac, randomBytes } from "crypto";

const PASSCODE_SECRET = process.env.PASSCODE_SECRET || "salonsynk-passcode-default-key";

/** Hash a 4-digit passcode with HMAC-SHA256 + salt. Returns "salt:hash". */
export function hashPasscode(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHmac("sha256", PASSCODE_SECRET)
    .update(salt + pin)
    .digest("hex");
  return `${salt}:${hash}`;
}

/** Verify a passcode against a stored "salt:hash" string. */
export function verifyPasscode(pin: string, stored: string): boolean {
  const [salt, expectedHash] = stored.split(":");
  if (!salt || !expectedHash) return false;
  const hash = createHmac("sha256", PASSCODE_SECRET)
    .update(salt + pin)
    .digest("hex");
  return hash === expectedHash;
}

/** Generate a signed token for the PIN session cookie. */
export function createPinSessionToken(memberId: string, salonId: string): string {
  const payload = `${memberId}:${salonId}:${Date.now()}`;
  const sig = createHmac("sha256", PASSCODE_SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  return `${payload}:${sig}`;
}

/** Verify a PIN session token. Returns { memberId, salonId } or null. maxAgeMs defaults to 12 hours. */
export function verifyPinSessionToken(
  token: string,
  maxAgeMs = 12 * 60 * 60 * 1000
): { memberId: string; salonId: string } | null {
  const parts = token.split(":");
  if (parts.length !== 4) return null;
  const [memberId, salonId, tsStr, sig] = parts;
  const ts = Number(tsStr);
  if (!memberId || !salonId || !ts || !sig) return null;
  if (Date.now() - ts > maxAgeMs) return null;
  const expectedSig = createHmac("sha256", PASSCODE_SECRET)
    .update(`${memberId}:${salonId}:${tsStr}`)
    .digest("hex")
    .slice(0, 16);
  if (sig !== expectedSig) return null;
  return { memberId, salonId };
}

/**
 * Short-lived elevated session for staff step-up (name + PIN) on shared devices.
 * Token format matches pin_session: `${memberId}:${salonId}:${ts}:${sig}`.
 */
export function createStaffElevationToken(actorMemberId: string, salonId: string): string {
  const payload = `${actorMemberId}:${salonId}:${Date.now()}`;
  const sig = createHmac("sha256", PASSCODE_SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  return `${payload}:${sig}`;
}

/** Verify elevated token. Defaults to 15 minutes. */
export function verifyStaffElevationToken(
  token: string,
  maxAgeMs = 15 * 60 * 1000
): { actorMemberId: string; salonId: string } | null {
  const parts = token.split(":");
  if (parts.length !== 4) return null;
  const [actorMemberId, salonId, tsStr, sig] = parts;
  const ts = Number(tsStr);
  if (!actorMemberId || !salonId || !ts || !sig) return null;
  if (Date.now() - ts > maxAgeMs) return null;
  const expectedSig = createHmac("sha256", PASSCODE_SECRET)
    .update(`${actorMemberId}:${salonId}:${tsStr}`)
    .digest("hex")
    .slice(0, 16);
  if (sig !== expectedSig) return null;
  return { actorMemberId, salonId };
}
