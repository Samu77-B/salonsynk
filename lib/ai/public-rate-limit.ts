const buckets = new Map<string, { count: number; resetAt: number }>();

/** Lightweight in-memory rate limit for public AI endpoints (per IP + route). */
export function checkPublicRateLimit(
  key: string,
  options?: { maxRequests?: number; windowMs?: number }
): { ok: true } | { ok: false; retryAfterSec: number } {
  const maxRequests = options?.maxRequests ?? 30;
  const windowMs = options?.windowMs ?? 60_000;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= maxRequests) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true };
}
