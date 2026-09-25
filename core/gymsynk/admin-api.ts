import "server-only";

import type {
  GymsynkAvailability,
  GymsynkCreateTenantInput,
  GymsynkCreateTenantResult,
  GymsynkResult,
  GymsynkTenant,
} from "@core/gymsynk/types";

const DEFAULT_DEV_URL = "http://localhost:3000";
const DEFAULT_PROD_URL = "https://www.gymsynk.net";
const HEALTH_TIMEOUT_MS = 4000;
const MUTATION_TIMEOUT_MS = 15000;

function gymsynkBaseUrl(): string {
  const explicit = process.env.GYMSYNK_ADMIN_API_URL?.trim();
  const raw = (
    explicit || (process.env.NODE_ENV === "production" ? DEFAULT_PROD_URL : DEFAULT_DEV_URL)
  ).replace(/\/$/, "");
  try {
    const url = new URL(raw);
    // Apex 308s to www and fetch drops Authorization on that host change.
    if (url.hostname === "gymsynk.net") url.hostname = "www.gymsynk.net";
    return url.origin;
  } catch {
    return raw;
  }
}

function gymsynkApiKey(): string | null {
  const key = process.env.GYMSYNK_ADMIN_API_KEY?.trim().replace(/^["']|["']$/g, "");
  return key || null;
}

export function gymsynkClientStatus() {
  const key = gymsynkApiKey();
  return {
    url: gymsynkBaseUrl(),
    keySet: Boolean(key),
    keyLength: key?.length ?? 0,
  };
}

function errorMessage(body: string, status: number): string {
  if (!body) return `GymSynk returned ${status}`;
  const looksLikeHtml = /^\s*</.test(body) || body.includes("<!DOCTYPE");
  if (looksLikeHtml) {
    return `GymSynk returned HTML instead of JSON (HTTP ${status}). Check GYMSYNK_ADMIN_API_URL and that /api/smartsynk is deployed.`;
  }
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    /* use raw text */
  }
  const trimmed = body.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 240) : `GymSynk returned ${status}`;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeTenant(raw: unknown): GymsynkTenant | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const slug = asString(row.slug);
  if (!id || !slug) return null;
  const ownerRaw = row.owner;
  const owner =
    ownerRaw && typeof ownerRaw === "object"
      ? {
          name: asString((ownerRaw as Record<string, unknown>).name),
          email: asString((ownerRaw as Record<string, unknown>).email),
        }
      : null;
  return {
    id,
    name: asString(row.name, slug),
    slug,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    owner: owner?.email ? owner : null,
    loginUrl: asString(row.loginUrl),
    joinUrl: asString(row.joinUrl),
    embedUrl: asString(row.embedUrl),
  };
}

async function gymsynkFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<GymsynkResult<unknown>> {
  const key = gymsynkApiKey();
  if (!key) {
    return {
      ok: false,
      error: "GymSynk is not configured. Set GYMSYNK_ADMIN_API_KEY on the server.",
      availability: "unconfigured",
    };
  }

  const { timeoutMs = HEALTH_TIMEOUT_MS, headers, body, ...rest } = init;
  const url = `${gymsynkBaseUrl()}${path}`;

  try {
    const res = await fetch(url, {
      ...rest,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${key}`,
        "X-SmartSynk-Key": key,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return { ok: false, error: errorMessage(text, res.status), availability: "unavailable" };
    }
    if (!text) return { ok: true, data: null };
    try {
      return { ok: true, data: JSON.parse(text) as unknown };
    } catch {
      return { ok: false, error: "GymSynk returned invalid JSON.", availability: "unavailable" };
    }
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "GymSynk did not respond in time."
        : error instanceof Error
          ? error.message
          : "GymSynk is unreachable.";
    return { ok: false, error: message, availability: "unavailable" };
  }
}

export function gymsynkAvailabilityLabel(availability: GymsynkAvailability): string {
  if (availability === "unconfigured") return "Not configured";
  if (availability === "unavailable") return "Unavailable";
  return "Operational";
}

export async function fetchGymsynkHealth(): Promise<GymsynkResult<{ ok: true }>> {
  const result = await gymsynkFetch("/api/smartsynk/health");
  if (!result.ok) return result;
  return { ok: true, data: { ok: true } };
}

export async function fetchGymsynkTenants(): Promise<GymsynkResult<GymsynkTenant[]>> {
  const result = await gymsynkFetch("/api/smartsynk/tenants", { timeoutMs: MUTATION_TIMEOUT_MS });
  if (!result.ok) return result;
  const raw = result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {};
  const list = Array.isArray(raw.tenants) ? raw.tenants : [];
  return { ok: true, data: list.map(normalizeTenant).filter((row): row is GymsynkTenant => row !== null) };
}

export async function createGymsynkTenant(
  input: GymsynkCreateTenantInput
): Promise<GymsynkResult<GymsynkCreateTenantResult>> {
  const result = await gymsynkFetch("/api/smartsynk/tenants", {
    method: "POST",
    timeoutMs: MUTATION_TIMEOUT_MS,
    body: JSON.stringify({
      gymName: input.gymName,
      ownerName: input.ownerName,
      email: input.email,
      ...(input.password ? { password: input.password } : {}),
      ...(input.slug ? { slug: input.slug } : {}),
    }),
  });
  if (!result.ok) return result;

  const raw = result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {};
  const tenant = normalizeTenant(raw.tenant);
  if (!tenant) {
    return { ok: false, error: "GymSynk did not return a gym.", availability: "unavailable" };
  }
  return {
    ok: true,
    data: {
      tenant,
      temporaryPassword:
        typeof raw.temporaryPassword === "string" && raw.temporaryPassword
          ? raw.temporaryPassword
          : undefined,
    },
  };
}
