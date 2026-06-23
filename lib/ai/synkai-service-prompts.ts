import type { AiBookingService } from "./booking-types";
import { formatDurationMinutes } from "@/lib/format-duration";
import { formatPriceMinor } from "./booking-resolvers";

export const SYNKAI_NATURAL_LANGUAGE_SERVICES = `When someone describes a treatment in everyday language (e.g. "roots coloured", "root colour", "highlights"), map it to the closest **bookable service name** from the catalogue — never to a category heading.

Categories (e.g. "Colour Tints", "Colour - Highlights") group services but are NOT bookable themselves. Always confirm using an exact service name such as "Root Tint" or "Full Head", never "Colour Tint" or "Colour Tints".

Workflow for bookings:
1. Call match_service (or list_services) with the client's words to get the exact serviceName.
2. If match_service returns needsConfirmation, ask once: "Do you mean Root Tint?" using the exact name it returns.
3. Pass that exact serviceName to check_availability and book_guest_appointment.
4. If the client does not name a stylist, omit stylistName on check_availability to search all stylists.
5. Resolve "tomorrow" to the next calendar date from today in the prompt.`;

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
