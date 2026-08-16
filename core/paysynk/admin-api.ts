import "server-only";

/**
 * Server-only client for the PaySynk SmartSynk admin API.
 * PaySynk is a separate app (own Neon DB). Do not import this from client components.
 */

import type {
  PaysynkAvailability,
  PaysynkCreateSignupInput,
  PaysynkCreateSignupResult,
  PaysynkOverview,
  PaysynkPatchSignupInput,
  PaysynkResult,
  PaysynkSignup,
  PaysynkSignupStatus,
} from "@core/paysynk/types";

export type {
  PaysynkAvailability,
  PaysynkCreateSignupInput,
  PaysynkCreateSignupResult,
  PaysynkOverview,
  PaysynkPatchSignupInput,
  PaysynkResult,
  PaysynkSignup,
  PaysynkSignupStatus,
} from "@core/paysynk/types";

const DEFAULT_DEV_URL = "http://localhost:3000";
const DEFAULT_PROD_URL = "https://www.paysynk.com";
const OVERVIEW_TIMEOUT_MS = 4000;
const MUTATION_TIMEOUT_MS = 15000;

function paysynkBaseUrl(): string {
  const explicit = process.env.PAYSYNK_ADMIN_API_URL?.trim();
  const raw = (explicit || (process.env.NODE_ENV === "production" ? DEFAULT_PROD_URL : DEFAULT_DEV_URL)).replace(
    /\/$/,
    ""
  );
  try {
    const url = new URL(raw);
    // Apex 308s to www and fetch drops Authorization on that host change → 401.
    if (url.hostname === "paysynk.com") url.hostname = "www.paysynk.com";
    return url.origin;
  } catch {
    return raw;
  }
}

/** PaySynk returns `/s/:slug`; open it on PaySynk, not on SmartSynk. */
export function resolvePaysynkShopUrl(shopUrl: string): string {
  const trimmed = shopUrl.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.hostname === "paysynk.com") url.hostname = "www.paysynk.com";
      return url.toString();
    } catch {
      return trimmed;
    }
  }
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${paysynkBaseUrl()}${path}`;
}

function paysynkApiKey(): string | null {
  const key = process.env.PAYSYNK_ADMIN_API_KEY?.trim();
  return key || null;
}

function errorMessage(body: string, status: number): string {
  if (!body) return `PaySynk returned ${status}`;
  const looksLikeHtml = /^\s*</.test(body) || body.includes("<!DOCTYPE");
  if (looksLikeHtml) {
    if (status === 404) {
      return "PaySynk API route not found on the live site (404). The /api/smartsynk endpoints exist locally but are not deployed to paysynk.com yet.";
    }
    return `PaySynk returned HTML instead of JSON (HTTP ${status}). Check PAYSYNK_ADMIN_API_URL and that /api/smartsynk is deployed.`;
  }
  try {
    const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
  } catch {
    /* use raw text */
  }
  const trimmed = body.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 240) : `PaySynk returned ${status}`;
}

function isSignupStatus(value: unknown): value is PaysynkSignupStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeOwner(raw: unknown): PaysynkSignup["owner"] {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    id: asString(o.id),
    name: asString(o.name),
    email: asString(o.email),
  };
}

function normalizeSignup(raw: unknown): PaysynkSignup | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const id = asString(s.id);
  if (!id) return null;
  return {
    id,
    platform: asString(s.platform, "paysynk"),
    name: asString(s.name),
    slug: asString(s.slug),
    shopUrl: asString(s.shopUrl),
    signupStatus: isSignupStatus(s.signupStatus) ? s.signupStatus : "pending",
    adminNotes: typeof s.adminNotes === "string" ? s.adminNotes : null,
    paymentsActive: asBoolean(s.paymentsActive),
    createdAt: asString(s.createdAt),
    owner: normalizeOwner(s.owner),
  };
}

function normalizeOverview(raw: unknown): PaysynkOverview {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const storesRaw = r.stores && typeof r.stores === "object" ? (r.stores as Record<string, unknown>) : {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    platform: asString(r.platform, "paysynk"),
    health: r.health,
    stores: {
      total: num(storesRaw.total),
      pending: num(storesRaw.pending),
      approved: num(storesRaw.approved),
      rejected: num(storesRaw.rejected),
    },
    ordersThisMonth: num(r.ordersThisMonth),
    revenueThisMonthMinor: num(r.revenueThisMonthMinor),
  };
}

function healthLooksDown(health: unknown): boolean {
  if (health === false) return true;
  if (typeof health === "string") {
    const h = health.toLowerCase();
    return h === "down" || h === "unhealthy" || h === "unavailable" || h === "error";
  }
  if (health && typeof health === "object" && "status" in health) {
    return healthLooksDown((health as { status: unknown }).status);
  }
  return false;
}

async function paysynkFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<PaysynkResult<unknown>> {
  const key = paysynkApiKey();
  if (!key) {
    return {
      ok: false,
      error: "PaySynk is not configured. Set PAYSYNK_ADMIN_API_KEY on the server.",
      availability: "unconfigured",
    };
  }

  const { timeoutMs = OVERVIEW_TIMEOUT_MS, headers, body, ...rest } = init;
  const url = `${paysynkBaseUrl()}${path}`;

  try {
    const res = await fetch(url, {
      ...rest,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      if (res.status === 401) {
        return {
          ok: false,
          error:
            "PaySynk rejected the API key (401). PAYSYNK_ADMIN_API_KEY on SalonSynk must match SMARTSYNK_API_KEY on PaySynk. After changing Vercel env vars, Redeploy both apps.",
          availability: "unavailable",
        };
      }
      return { ok: false, error: errorMessage(text, res.status), availability: "unavailable" };
    }

    if (!text) return { ok: true, data: null };
    try {
      return { ok: true, data: JSON.parse(text) as unknown };
    } catch {
      return { ok: false, error: "PaySynk returned invalid JSON.", availability: "unavailable" };
    }
  } catch (e) {
    const message =
      e instanceof Error && e.name === "TimeoutError"
        ? "PaySynk did not respond in time."
        : e instanceof Error
          ? e.message
          : "PaySynk is unreachable.";
    return { ok: false, error: message, availability: "unavailable" };
  }
}

export async function fetchPaysynkOverview(): Promise<PaysynkResult<PaysynkOverview>> {
  const result = await paysynkFetch("/api/smartsynk/overview", { timeoutMs: OVERVIEW_TIMEOUT_MS });
  if (!result.ok) return result;
  const data = normalizeOverview(result.data);
  if (healthLooksDown(data.health)) {
    return { ok: false, error: "PaySynk reported unhealthy.", availability: "unavailable" };
  }
  return { ok: true, data };
}

export async function fetchPaysynkSignups(
  status?: PaysynkSignupStatus
): Promise<PaysynkResult<PaysynkSignup[]>> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const result = await paysynkFetch(`/api/smartsynk/signups${query}`, {
    timeoutMs: MUTATION_TIMEOUT_MS,
  });
  if (!result.ok) return result;

  const raw = result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {};
  const list = Array.isArray(raw.signups) ? raw.signups : [];
  const signups = list.map(normalizeSignup).filter((s): s is PaysynkSignup => s !== null);
  return { ok: true, data: signups };
}

export async function createPaysynkSignup(
  input: PaysynkCreateSignupInput
): Promise<PaysynkResult<PaysynkCreateSignupResult>> {
  const result = await paysynkFetch("/api/smartsynk/signups", {
    method: "POST",
    timeoutMs: MUTATION_TIMEOUT_MS,
    body: JSON.stringify({
      fullName: input.fullName,
      storeName: input.storeName,
      email: input.email,
      ...(input.password ? { password: input.password } : {}),
      ...(input.approve ? { approve: true } : {}),
    }),
  });
  if (!result.ok) return result;

  const raw = result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {};
  const signup = normalizeSignup(raw.signup);
  if (!signup) {
    return { ok: false, error: "PaySynk did not return a signup.", availability: "unavailable" };
  }
  return {
    ok: true,
    data: {
      signup,
      temporaryPassword:
        typeof raw.temporaryPassword === "string" && raw.temporaryPassword
          ? raw.temporaryPassword
          : undefined,
    },
  };
}

export async function patchPaysynkSignup(
  id: string,
  input: PaysynkPatchSignupInput
): Promise<PaysynkResult<PaysynkSignup>> {
  const result = await paysynkFetch(`/api/smartsynk/signups/${encodeURIComponent(id)}`, {
    method: "PATCH",
    timeoutMs: MUTATION_TIMEOUT_MS,
    body: JSON.stringify(input),
  });
  if (!result.ok) return result;

  const raw = result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {};
  const signup = normalizeSignup(raw.signup ?? result.data);
  if (!signup) {
    return { ok: false, error: "PaySynk did not return an updated signup.", availability: "unavailable" };
  }
  return { ok: true, data: signup };
}

export function paysynkAvailabilityLabel(availability: PaysynkAvailability): string {
  if (availability === "unconfigured") return "Not configured";
  if (availability === "unavailable") return "Unavailable";
  return "Operational";
}
