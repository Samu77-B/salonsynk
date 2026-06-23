import { tool, jsonSchema } from "ai";
import { executeGuestBooking } from "@/lib/appointments/create-guest-appointment";
import {
  formatPriceMinor,
  resolveService,
  resolveStylist,
  serviceDurationForStylist,
  filterServices,
  matchServiceForBooking,
} from "./booking-resolvers";
import { findAvailableSlots, isSlotAvailable } from "./slot-finder";
import { parseSalonDateIso, parseSalonLocalTime, salonLocalToUtc, todaySalonDateIso } from "./salon-time";
import type { PublicSalonContext } from "./load-public-salon-catalog";
import type { SlotCandidate, TimePreference } from "./booking-types";
import { SYNKAI_AGENT_NAME } from "@/lib/ai/synkai-brand";
import {
  SYNKAI_NATURAL_LANGUAGE_SERVICES,
  formatServiceCatalogLine,
  uniqueServiceCategories,
} from "@/lib/ai/synkai-service-prompts";

function errorPayload(message: string, suggestions: string[] = []) {
  return { success: false as const, error: message, suggestions };
}

function successPayload<T extends Record<string, unknown>>(data: T) {
  return { success: true as const, ...data };
}

/** Guest-safe booking tools — no client list, reschedule, or internal notes. */
export function createPublicBookingTools(catalog: PublicSalonContext) {
  const { salonId, salonName, services, stylists, stylistOverrides, slug, products } = catalog;

  return {
    match_service: tool({
      description:
        "Resolve casual wording to an exact bookable service name. Call this before check_availability when the client describes a treatment in plain English.",
      inputSchema: jsonSchema<{ description: string }>({
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "What the client asked for, e.g. root colour, highlights, fringe trim",
          },
        },
        required: ["description"],
        additionalProperties: false,
      }),
      execute: async ({ description }) => {
        const match = matchServiceForBooking(services, description);
        if (!match.ok) {
          return errorPayload(match.error, match.suggestions);
        }
        return successPayload({
          serviceName: match.service.name,
          durationMinutes: match.service.durationMinutes,
          price: formatPriceMinor(match.service.priceMinor),
          category: match.service.categoryName ?? undefined,
          needsConfirmation: match.needsConfirmation,
          alternatives: match.alternatives,
        });
      },
    }),

    list_services: tool({
      description:
        "List services available for online booking. Search by service name, category, or description keywords.",
      inputSchema: jsonSchema<{ query?: string }>({
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional filter — e.g. root, highlights, tint, colour",
          },
        },
        additionalProperties: false,
      }),
      execute: async ({ query }) => {
        const rows = filterServices(services, query);
        return successPayload({
          services: rows.map((s) => ({
            name: s.name,
            durationMinutes: s.durationMinutes,
            price: formatPriceMinor(s.priceMinor),
            category: s.categoryName ?? undefined,
            description: s.description ? s.description.slice(0, 220) : undefined,
          })),
        });
      },
    }),

    list_products: tool({
      description: "List retail products sold by the salon (shampoo, styling products, etc.).",
      inputSchema: jsonSchema<{ query?: string }>({
        type: "object",
        properties: { query: { type: "string" } },
        additionalProperties: false,
      }),
      execute: async ({ query }) => {
        const q = query?.trim().toLowerCase();
        const rows = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
        return successPayload({
          products: rows.map((p) => ({
            name: p.name,
            price: formatPriceMinor(p.priceMinor),
            description: p.description ? p.description.slice(0, 160) : undefined,
          })),
        });
      },
    }),

    list_stylists: tool({
      description: "List stylists available for booking.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {}, additionalProperties: false }),
      execute: async () => successPayload({ stylists: stylists.map((s) => s.name) }),
    }),

    check_availability: tool({
      description:
        "Check open appointment times for a service on a given date. stylistName is optional — omit it to search all stylists.",
      inputSchema: jsonSchema<{
        serviceName: string;
        dateIso: string;
        stylistName?: string;
        timePreference?: TimePreference;
        requestedTime?: string;
      }>({
        type: "object",
        properties: {
          stylistName: { type: "string", description: "Optional stylist name" },
          serviceName: { type: "string", description: "Exact service name from match_service or list_services" },
          dateIso: { type: "string", description: "Date YYYY-MM-DD (resolve tomorrow from today before calling)" },
          timePreference: { type: "string", enum: ["morning", "afternoon", "evening", "any"] },
          requestedTime: { type: "string", description: "Specific time HH:mm when client asks for a slot" },
        },
        required: ["serviceName", "dateIso"],
        additionalProperties: false,
      }),
      execute: async ({ stylistName, serviceName, dateIso, timePreference, requestedTime }) => {
        const serviceResult = resolveService(services, serviceName);
        if (!serviceResult.ok) return errorPayload(serviceResult.error, serviceResult.suggestions);
        const dateIsoNorm = parseSalonDateIso(dateIso);
        if (!dateIsoNorm) return errorPayload("Please provide a valid date.", []);

        const stylistCandidates = stylistName?.trim()
          ? [resolveStylist(stylists, stylistName)]
          : stylists.map((s) => ({ ok: true as const, item: s }));

        const slotRows: Array<SlotCandidate & { stylist: string }> = [];
        let requestedSlot: (SlotCandidate & { stylist: string }) | undefined;

        for (const stylistResult of stylistCandidates) {
          if (!stylistResult.ok) {
            if (stylistName?.trim()) return errorPayload(stylistResult.error, stylistResult.suggestions);
            continue;
          }

          const durationMinutes = serviceDurationForStylist(
            serviceResult.item,
            stylistResult.item.id,
            stylistOverrides
          );

          if (requestedTime?.trim()) {
            const parsedTime = parseSalonLocalTime(requestedTime.trim());
            if (parsedTime) {
              const start = salonLocalToUtc(dateIsoNorm, parsedTime.hour, parsedTime.minute);
              const ok = await isSlotAvailable({
                salonId,
                stylistId: stylistResult.item.id,
                startTime: start,
                durationMinutes,
              });
              if (ok) {
                requestedSlot = {
                  startIso: start.toISOString(),
                  endIso: new Date(start.getTime() + durationMinutes * 60_000).toISOString(),
                  dayLabel: start.toLocaleDateString("en-GB", {
                    timeZone: "Europe/London",
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }),
                  timeLabel: requestedTime.trim(),
                  stylist: stylistResult.item.name,
                };
                break;
              }
            }
          }

          const slots = await findAvailableSlots({
            salonId,
            stylistId: stylistResult.item.id,
            durationMinutes,
            fromDate: dateIsoNorm,
            daysToScan: stylistName?.trim() ? 5 : 3,
            timePreference: timePreference ?? "any",
            maxResults: stylistName?.trim() ? 8 : 4,
            prioritizeLocalTime: requestedTime?.trim(),
          });
          slotRows.push(...slots.map((slot) => ({ ...slot, stylist: stylistResult.item.name })));
        }

        if (requestedTime?.trim() && !requestedSlot) {
          const alt = slotRows.slice(0, 6).map((s) => `${s.stylist}: ${s.dayLabel} at ${s.timeLabel}`);
          return errorPayload(`Not available at ${requestedTime} on ${dateIsoNorm}.`, alt);
        }

        if (requestedSlot) {
          return successPayload({
            stylist: requestedSlot.stylist,
            service: serviceResult.item.name,
            price: formatPriceMinor(serviceResult.item.priceMinor),
            requestedSlot,
            requestedSlotAvailable: true,
          });
        }

        if (slotRows.length === 0) {
          return errorPayload("No openings on that day. Try another date or stylist.", stylists.map((s) => s.name));
        }

        return successPayload({
          service: serviceResult.item.name,
          price: formatPriceMinor(serviceResult.item.priceMinor),
          slots: slotRows.slice(0, 8),
        });
      },
    }),

    book_guest_appointment: tool({
      description: "Book a guest appointment after confirming name, email, stylist, service, and start time.",
      inputSchema: jsonSchema<{
        stylistName: string;
        serviceName: string;
        startTimeIso: string;
        guestName: string;
        guestEmail: string;
        guestPhone?: string;
      }>({
        type: "object",
        properties: {
          stylistName: { type: "string" },
          serviceName: { type: "string" },
          startTimeIso: { type: "string" },
          guestName: { type: "string" },
          guestEmail: { type: "string" },
          guestPhone: { type: "string" },
        },
        required: ["stylistName", "serviceName", "startTimeIso", "guestName", "guestEmail"],
        additionalProperties: false,
      }),
      execute: async ({ stylistName, serviceName, startTimeIso, guestName, guestEmail, guestPhone }) => {
        const stylistResult = resolveStylist(stylists, stylistName);
        if (!stylistResult.ok) return errorPayload(stylistResult.error, stylistResult.suggestions);
        const serviceResult = resolveService(services, serviceName);
        if (!serviceResult.ok) return errorPayload(serviceResult.error, serviceResult.suggestions);

        const start = new Date(startTimeIso);
        if (!Number.isFinite(start.getTime())) return errorPayload("Invalid start time.", []);

        const durationMinutes = serviceDurationForStylist(
          serviceResult.item,
          stylistResult.item.id,
          stylistOverrides
        );
        const end = new Date(start.getTime() + durationMinutes * 60_000);

        const result = await executeGuestBooking({
          salonId,
          stylistId: stylistResult.item.id,
          serviceId: serviceResult.item.id,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestPhone: guestPhone?.trim(),
        });

        if (result.error) return errorPayload(result.error, []);

        return successPayload({
          bookingChanged: true,
          appointmentId: "appointmentId" in result ? result.appointmentId : undefined,
          message: `Your ${serviceResult.item.name} with ${stylistResult.item.name} is confirmed. A confirmation email will be sent to ${guestEmail}.`,
          bookingUrl: `/book/${slug}`,
        });
      },
    }),
  };
}

export function buildPublicConciergePrompt(catalog: PublicSalonContext): string {
  const today = todaySalonDateIso();
  const categories = uniqueServiceCategories(catalog.services);
  const serviceLines = catalog.services.slice(0, 30).map((s) => formatServiceCatalogLine(s)).join("\n");

  const productLines = catalog.products
    .slice(0, 15)
    .map((p) => `- ${p.name} (${formatPriceMinor(p.priceMinor)})`)
    .join("\n");

  return `You are ${SYNKAI_AGENT_NAME} for ${catalog.salonName} — a friendly public assistant for clients booking online.

Today is ${today}. Use UK English.

You help clients with:
- Hair services (cuts, colour, highlights, balayage, styling, etc.) — use service names and descriptions below
- Booking appointments (check availability, then book with name + email)
- General salon questions: opening hours, policies, what a service includes

Opening hours: ${catalog.openingHoursNote}

Rules:
- Never mention internal staff tools or client databases
- ${SYNKAI_NATURAL_LANGUAGE_SERVICES}
- Use match_service / list_services / check_availability / book_guest_appointment for bookings
- When the client confirms with "yes", "that's right", etc., reuse the exact serviceName you already identified — never pass the word "yes" as the service name
- For style or colour advice, describe what the salon offers based on service list — do not invent services
- If asked about opening times, use the opening hours note above; if unsure, suggest calling the salon
- If asked about salon policy: ${catalog.policyNotes}
- Be concise and welcoming

Services (use descriptions to explain cuts, colour, highlights, etc.):
${serviceLines || "(contact salon)"}

Service categories:
${categories.map((c) => `- ${c}`).join("\n") || "(none)"}

Retail products:
${productLines || "(ask salon)"}

Stylists:
${catalog.stylists.map((s) => `- ${s.name}`).join("\n") || "(any available)"}`;
}

export function buildPublicQaPrompt(catalog: PublicSalonContext): string {
  const categories = uniqueServiceCategories(catalog.services);
  const serviceLines = catalog.services.map((s) => formatServiceCatalogLine(s, 180)).join("\n");

  return `You are ${SYNKAI_AGENT_NAME} for ${catalog.salonName}. Answer client questions about services, styling, colour, pricing, policies, opening hours, and how to book.

Opening hours: ${catalog.openingHoursNote}

Policy context: ${catalog.policyNotes}

Services (use these to answer questions about cuts, colour techniques, duration, and price):
${serviceLines}

Service categories:
${categories.map((c) => `- ${c}`).join("\n") || "(none)"}

Retail products:
${catalog.products.map((p) => `- ${p.name}: ${formatPriceMinor(p.priceMinor)}`).join("\n") || "(none listed)"}

Booking: clients can book via this page's booking form or the ${SYNKAI_AGENT_NAME} tab.

Rules:
- UK English, friendly and factual
- ${SYNKAI_NATURAL_LANGUAGE_SERVICES}
- For hair style or colour questions, explain using the service list and descriptions — suggest booking a consultation if unsure
- For opening times, use the opening hours note; do not invent hours
- Do not invent services or prices not listed above
- For account-specific questions, ask them to contact the salon directly
- You cannot access live appointment schedules in QA mode — suggest ${SYNKAI_AGENT_NAME} booking for availability`;
}
