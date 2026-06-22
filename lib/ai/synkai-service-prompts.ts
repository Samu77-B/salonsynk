import type { AiBookingService } from "./booking-types";
import { formatDurationMinutes } from "@/lib/format-duration";
import { formatPriceMinor } from "./booking-resolvers";

export const SYNKAI_NATURAL_LANGUAGE_SERVICES = `When someone describes a treatment in everyday language (e.g. "roots coloured", "need my highlights done", "regrowth tint"), map it to the closest service from the catalogue below. Use category names to narrow choices (e.g. Colour Tints, Colour - Highlights). If you are fairly sure but not certain, ask once: "Do you mean [exact service name]?" before checking availability or booking. Use list_services with keywords from what they said to find matches.`;

export function uniqueServiceCategories(services: AiBookingService[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of services) {
    const name = s.categoryName?.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export function formatServiceCatalogLine(s: AiBookingService, descriptionMax = 150): string {
  const bits = [`${s.name} (${formatDurationMinutes(s.durationMinutes)}, ${formatPriceMinor(s.priceMinor)})`];
  if (s.categoryName) bits.push(`[${s.categoryName}]`);
  if (s.description) bits.push(`— ${s.description.slice(0, descriptionMax)}`);
  return `- ${bits.join(" ")}`;
}
