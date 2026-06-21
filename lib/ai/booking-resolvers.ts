import type { AiBookingClient, AiBookingService, AiBookingStylist, ResolveResult } from "./booking-types";

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreNameMatch(candidate: string, query: string): number {
  const c = normalizeQuery(candidate);
  const q = normalizeQuery(query);
  if (!c || !q) return 0;
  if (c === q) return 100;
  if (c.startsWith(q) || q.startsWith(c)) return 80;
  if (c.includes(q) || q.includes(c)) return 60;
  const qTokens = q.split(" ").filter(Boolean);
  const matched = qTokens.filter((t) => c.includes(t)).length;
  if (matched === 0) return 0;
  return 30 + (matched / qTokens.length) * 30;
}

function resolveByName<T extends { id: string; label: string }>(
  items: T[],
  query: string,
  entityLabel: string
): ResolveResult<T> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: `Please specify which ${entityLabel} you mean.`,
      suggestions: items.slice(0, 5).map((i) => i.label),
    };
  }

  const scored = items
    .map((item) => ({ item, score: scoreNameMatch(item.label, trimmed) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      ok: false,
      error: `I couldn't find a ${entityLabel} matching "${trimmed}".`,
      suggestions: items.slice(0, 6).map((i) => i.label),
    };
  }

  const best = scored[0];
  const second = scored[1];
  if (second && best.score - second.score < 8 && best.score < 90) {
    return {
      ok: false,
      error: `Several ${entityLabel}s match "${trimmed}". Which did you mean?`,
      suggestions: scored.slice(0, 5).map((r) => r.item.label),
    };
  }

  return { ok: true, item: best.item };
}

export function resolveService(
  services: AiBookingService[],
  serviceName: string
): ResolveResult<AiBookingService> {
  return resolveByName(
    services.map((s) => ({ ...s, label: s.name })),
    serviceName,
    "service"
  );
}

export function resolveStylist(
  stylists: AiBookingStylist[],
  stylistName: string
): ResolveResult<AiBookingStylist> {
  return resolveByName(
    stylists.map((s) => ({ ...s, label: s.name })),
    stylistName,
    "stylist"
  );
}

export function resolveClient(
  clients: AiBookingClient[],
  clientName: string
): ResolveResult<AiBookingClient> {
  return resolveByName(
    clients
      .filter((c) => c.name?.trim())
      .map((c) => ({ ...c, label: c.name!.trim() })),
    clientName,
    "client"
  );
}

export function serviceDurationForStylist(
  service: AiBookingService,
  stylistId: string,
  stylistOverrides: Record<string, Record<string, number>>
): number {
  const override = stylistOverrides[stylistId]?.[service.id];
  return override ?? service.durationMinutes;
}

export function formatPriceMinor(priceMinor: number | null): string {
  if (priceMinor == null || !Number.isFinite(priceMinor)) return "Price on request";
  return `£${(priceMinor / 100).toFixed(2)}`;
}
