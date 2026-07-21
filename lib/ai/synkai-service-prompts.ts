import type { AiBookingService } from "./booking-types";
import { formatDurationMinutes } from "@/lib/format-duration";
import { formatPriceMinor } from "./booking-resolvers";

export const SYNKAI_NATURAL_LANGUAGE_SERVICES = `When someone describes a treatment in everyday language (e.g. "I need my hair trimmed", "roots coloured", "a haircut on Saturday"), map it to the closest **bookable service name** from the catalogue — never to a category heading.

Prefer speed: pass their casual wording straight to check_availability (and later book_*). Those tools already fuzzy-match service names — do **not** call match_service first unless check_availability fails with askToClarify / multiple suggestions.

Categories (e.g. "Colour Tints", "Colour - Highlights") group services but are NOT bookable themselves. Always confirm using an exact service name such as "Root Tint" or "Men's Haircut", never "Colour Tint" or "Colour Tints".

Workflow for bookings:
1. Call check_availability with their words as serviceName (and a YYYY-MM-DD date). Skip list_services / match_service when the catalogue above already has what you need.
2. If a tool returns askToClarify or several suggestions, ask once using those exact service names, then retry check_availability with one exact name.
3. After a confirmed slot, call book_guest_appointment / book_appointment with that exact serviceName and startTimeIso.
4. If the client does not name a stylist (e.g. walk-in, "anyone", "doesn't matter who"), omit stylistName on check_availability and book_appointment — the tools auto-assign the next free stylist, or a random stylist if all are free.
5. Resolve "tomorrow", "Saturday", etc. to the next matching YYYY-MM-DD date from today in the prompt.
6. Minimise tool calls — ideally one availability check, then one book when they confirm.`

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
