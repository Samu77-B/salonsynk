import type { AiBookingClient, AiBookingService, AiBookingStylist, ResolveResult } from "./booking-types";

export type ServiceMatchResult =
  | {
      ok: true;
      service: AiBookingService;
      needsConfirmation: boolean;
      alternatives: string[];
    }
  | {
      ok: false;
      error: string;
      suggestions: string[];
      isCategory?: boolean;
      /** Multiple services matched by keyword — ask a clarifying question. */
      askToClarify?: boolean;
    };

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "i",
  "need",
  "want",
  "like",
  "would",
  "get",
  "my",
  "a",
  "an",
  "the",
  "for",
  "on",
  "at",
  "this",
  "next",
  "just",
  "please",
  "book",
  "booking",
  "appointment",
  "ordinary",
  "some",
  "any",
]);

const DAY_TIME_PHRASES =
  /\b(on |this |next )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b|\b(at |around |about )?\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi;

const TERM_EXPANSIONS: Record<string, string[]> = {
  haircut: ["hair", "cut", "haircut", "trim", "grooming"],
  trimmed: ["hair", "trim"],
  trim: ["trim", "hair", "fringe"],
  colour: ["colour", "color", "tint", "dye"],
  color: ["colour", "color", "tint"],
  highlight: ["highlight", "highlights", "balayage"],
  blowdry: ["blow", "dry", "style", "blowdry"],
  mens: ["men", "male", "barber", "grooming"],
  ladies: ["ladies", "women", "female", "woman"],
};

function stripDateTimePhrases(query: string): string {
  return query
    .replace(DAY_TIME_PHRASES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSearchKeywords(query: string): string[] {
  const normalized = stripDateTimePhrases(normalizeQuery(query));
  const tokens = normalized.split(" ").filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  const keywords = new Set<string>(tokens);

  for (const token of tokens) {
    for (const [term, expansions] of Object.entries(TERM_EXPANSIONS)) {
      if (token.includes(term) || term.includes(token)) {
        expansions.forEach((e) => keywords.add(e));
      }
    }
  }

  if (normalized.includes("hair cut") || normalized.includes("haircut")) {
    ["hair", "cut", "haircut", "trim", "grooming", "barber"].forEach((k) => keywords.add(k));
  }

  return [...keywords].filter((k) => k.length >= 3);
}

function servicesMatchingKeywords(services: AiBookingService[], keywords: string[]): AiBookingService[] {
  if (keywords.length === 0) return [];
  return services.filter((service) => {
    const blob = normalizeQuery(serviceSearchBlob(service));
    return keywords.some((kw) => blob.includes(kw));
  });
}

function clarifyingQuestionForServices(services: AiBookingService[]): string {
  const hasMens = services.some((s) => /\b(men|male|barber|gent|grooming)\b/i.test(s.name));
  const hasLadies = services.some((s) => /\b(ladies|women|female|woman|lady)\b/i.test(s.name));
  if (hasMens && hasLadies) {
    return "Would you like a men's haircut or a ladies' service? Pick from the list below.";
  }
  return "Which of these would you like?";
}

function keywordMatchResult(services: AiBookingService[], query: string): ServiceMatchResult | null {
  const keywords = extractSearchKeywords(query);
  const hits = servicesMatchingKeywords(services, keywords);
  if (hits.length === 0) return null;

  const names = [...new Set(hits.map((s) => s.name))];
  if (names.length === 1) {
    const service = hits.find((s) => s.name === names[0])!;
    return {
      ok: true,
      service,
      needsConfirmation: true,
      alternatives: [],
    };
  }

  return {
    ok: false,
    error: `I found ${names.length} services that might match. ${clarifyingQuestionForServices(hits)}`,
    suggestions: names.slice(0, 8),
    askToClarify: true,
  };
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

  const serviceIntent = stripDateTimePhrases(trimmed) || trimmed;

  const categoryHits = new Map<string, AiBookingService[]>();
  for (const service of services) {
    if (!service.categoryName) continue;
    if (!queryMatchesCategoryLabel(serviceIntent, service.categoryName)) continue;
    const list = categoryHits.get(service.categoryName) ?? [];
    list.push(service);
    categoryHits.set(service.categoryName, list);
  }
  if (categoryHits.size > 0) {
    const grouped = [...categoryHits.values()].flat();
    const names = [...new Set(grouped.map((s) => s.name))];
    return {
      ok: false,
      error: `"${serviceIntent}" matches a service category, not a bookable service. Pick the exact service name:`,
      suggestions: names,
      isCategory: true,
    };
  }

  if (queryImpliesRootTint(serviceIntent)) {
    const rootTint = findRootTintService(services);
    if (rootTint) {
      return { ok: true, service: rootTint, needsConfirmation: true, alternatives: [] };
    }
  }

  const scored = services
    .map((service) => ({
      service,
      score: Math.max(scoreServiceMatch(service, serviceIntent), scoreServiceMatch(service, trimmed)),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    const keywordMatch = keywordMatchResult(services, serviceIntent);
    if (keywordMatch) return keywordMatch;
    return {
      ok: false,
      error: `I couldn't find a service matching "${serviceIntent}".`,
      suggestions: services.slice(0, 6).map((s) => s.name),
    };
  }

  const best = scored[0];
  const nameScore = scoreNameMatch(best.service.name, serviceIntent);
  const second = scored[1];
  const needsConfirmation =
    Boolean(second && (best.score - second.score < 10 || nameScore < 70)) && best.score < 95;

  if (needsConfirmation && second) {
    const closeMatches = scored.filter((row) => best.score - row.score < 12).map((row) => row.service);
    const keywordClarify = keywordMatchResult(services, serviceIntent);
    if (keywordClarify && !keywordClarify.ok && keywordClarify.askToClarify) {
      return keywordClarify;
    }
    if (closeMatches.length > 1) {
      return {
        ok: false,
        error: `Several services could match "${serviceIntent}". ${clarifyingQuestionForServices(closeMatches)}`,
        suggestions: closeMatches.map((s) => s.name).slice(0, 8),
        askToClarify: true,
      };
    }
  }

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
  const intent = stripDateTimePhrases(q) || q;
  const scored = services
    .map((service) => ({
      service,
      score: Math.max(scoreServiceMatch(service, intent), scoreServiceMatch(service, q)),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.service);
  if (scored.length > 0) return scored;
  return servicesMatchingKeywords(services, extractSearchKeywords(intent));
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
