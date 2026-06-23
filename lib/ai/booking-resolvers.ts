import type { AiBookingClient, AiBookingService, AiBookingStylist, ResolveResult } from "./booking-types";

export type ServiceMatchResult =
  | {
      ok: true;
      service: AiBookingService;
      needsConfirmation: boolean;
      alternatives: string[];
    }
  | { ok: false; error: string; suggestions: string[]; isCategory?: boolean };

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryMatchesCategoryLabel(query: string, categoryName: string): boolean {
  const q = normalizeQuery(query);
  const c = normalizeQuery(categoryName);
  if (!q || !c) return false;
  if (q === c) return true;
  if (`${q}s` === c || q === `${c}s` || (q.endsWith("s") && q.slice(0, -1) === c) || (c.endsWith("s") && c.slice(0, -1) === q)) {
    return true;
  }
  return q.length >= 4 && (c.startsWith(q) || q.startsWith(c));
}

const ROOT_TINT_HINTS = [
  "root colour",
  "root color",
  "roots coloured",
  "roots colored",
  "regrowth",
  "root touch up",
  "touch up roots",
  "roots done",
];

function queryImpliesRootTint(query: string): boolean {
  const q = normalizeQuery(query);
  if (ROOT_TINT_HINTS.some((hint) => q.includes(normalizeQuery(hint)))) return true;
  return q.includes("root") && (q.includes("colour") || q.includes("color"));
}

function findRootTintService(services: AiBookingService[]): AiBookingService | null {
  const exact = services.find((s) => normalizeQuery(s.name) === "root tint");
  if (exact) return exact;
  return services.find((s) => normalizeQuery(s.name).includes("root") && normalizeQuery(s.name).includes("tint")) ?? null;
}

export function matchServiceForBooking(services: AiBookingService[], query: string): ServiceMatchResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Please describe which service you would like.",
      suggestions: services.slice(0, 6).map((s) => s.name),
    };
  }

  const categoryHits = new Map<string, AiBookingService[]>();
  for (const service of services) {
    if (!service.categoryName) continue;
    if (!queryMatchesCategoryLabel(trimmed, service.categoryName)) continue;
    const list = categoryHits.get(service.categoryName) ?? [];
    list.push(service);
    categoryHits.set(service.categoryName, list);
  }
  if (categoryHits.size > 0) {
    const grouped = [...categoryHits.values()].flat();
    const names = [...new Set(grouped.map((s) => s.name))];
    return {
      ok: false,
      error: `"${trimmed}" matches a service category, not a bookable service. Pick the exact service name:`,
      suggestions: names,
      isCategory: true,
    };
  }

  if (queryImpliesRootTint(trimmed)) {
    const rootTint = findRootTintService(services);
    if (rootTint) {
      return { ok: true, service: rootTint, needsConfirmation: true, alternatives: [] };
    }
  }

  const scored = services
    .map((service) => ({ service, score: scoreServiceMatch(service, trimmed) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      ok: false,
      error: `I couldn't find a service matching "${trimmed}".`,
      suggestions: services.slice(0, 6).map((s) => s.name),
    };
  }

  const best = scored[0];
  const nameScore = scoreNameMatch(best.service.name, trimmed);
  const second = scored[1];
  const needsConfirmation =
    Boolean(second && (best.score - second.score < 10 || nameScore < 70)) && best.score < 95;

  if (needsConfirmation) {
    return {
      ok: true,
      service: best.service,
      needsConfirmation: true,
      alternatives: scored.slice(1, 4).map((row) => row.service.name),
    };
  }

  return { ok: true, service: best.service, needsConfirmation: false, alternatives: [] };
}

function scoreNameMatch(candidate: string, query: string): number {
  const c = normalizeQuery(candidate);
  const q = normalizeQuery(query);
  if (!c || !q) return 0;
  if (c === q) return 100;
  if (c.startsWith(q) || q.startsWith(c)) return 80;
  if (c.includes(q) || q.includes(c)) return 60;
  const qTokens = q.split(" ").filter(Boolean);
  const matched = qTokens.filter((t) => tokenMatchesText(c, t)).length;
  if (matched === 0) return 0;
  return 30 + (matched / qTokens.length) * 30;
}

/** Loose word match — e.g. "roots" matches "root" in "root tint". */
function tokenMatchesText(text: string, token: string): boolean {
  if (!token || token.length < 2) return false;
  if (text.includes(token)) return true;
  return text.split(" ").some((word) => {
    if (word.length < 3 || token.length < 3) return false;
    return word.startsWith(token) || token.startsWith(word);
  });
}

function serviceSearchBlob(service: AiBookingService): string {
  return [service.name, service.categoryName, service.description].filter(Boolean).join(" ");
}

export function scoreServiceMatch(service: AiBookingService, query: string): number {
  const nameScore = scoreNameMatch(service.name, query);
  const fullScore = scoreNameMatch(serviceSearchBlob(service), query);
  const categoryScore = service.categoryName ? scoreNameMatch(service.categoryName, query) * 0.85 : 0;
  const descScore = service.description ? scoreNameMatch(service.description, query) * 0.75 : 0;
  return Math.max(nameScore, fullScore, categoryScore, descScore);
}

export function filterServices(services: AiBookingService[], query?: string): AiBookingService[] {
  const q = query?.trim();
  if (!q) return services;
  return services
    .map((service) => ({ service, score: scoreServiceMatch(service, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.service);
}

export function resolveService(
  services: AiBookingService[],
  serviceName: string
): ResolveResult<AiBookingService> {
  const match = matchServiceForBooking(services, serviceName);
  if (match.ok) {
    if (match.needsConfirmation && match.alternatives.length > 0) {
      return {
        ok: false,
        error: `Several services could match "${serviceName}". Which did you mean?`,
        suggestions: [match.service.name, ...match.alternatives],
      };
    }
    return { ok: true, item: match.service };
  }
  return { ok: false, error: match.error, suggestions: match.suggestions };
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
