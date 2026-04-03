import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  return (
    process.env.MARKETING_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "salonsynk-dev-unsubscribe"
  );
}

/** Signed token for one-click unsubscribe links in marketing emails. */
export function signUnsubscribeToken(clientId: string, salonId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365; // 1 year
  const payload = JSON.stringify({ c: clientId, s: salonId, exp });
  const body = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): { clientId: string; salonId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getSecret()).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed: { c?: string; s?: string; exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      c?: string;
      s?: string;
      exp?: number;
    };
  } catch {
    return null;
  }
  if (!parsed.c || !parsed.s || typeof parsed.exp !== "number") return null;
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return { clientId: parsed.c, salonId: parsed.s };
}
