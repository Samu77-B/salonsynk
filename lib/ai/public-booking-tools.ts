import { tool, jsonSchema } from "ai";
import { executeGuestBooking } from "@/lib/appointments/create-guest-appointment";
import {
  formatPriceMinor,
  resolveService,
  resolveStylist,
  serviceDurationForStylist,
  filterServices,
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
      description: "Check open appointment times for a stylist and service.",
      inputSchema: jsonSchema<{
        stylistName: string;
        serviceName: string;
        dateIso: string;
        timePreference?: TimePreference;
        requestedTime?: string;
      }>({
        type: "object",
        properties: {
          stylistName: { type: "string" },
          serviceName: { type: "string" },
          dateIso: { type: "string" },
          timePreference: { type: "string", enum: ["morning", "afternoon", "evening", "any"] },
          requestedTime: { type: "string", description: "Specific time HH:mm when client asks for a slot" },
        },
        required: ["stylistName", "serviceName", "dateIso"],
        additionalProperties: false,
      }),
      execute: async ({ stylistName, serviceName, dateIso, timePreference, requestedTime }) => {
        const stylistResult = resolveStylist(stylists, stylistName);
        if (!stylistResult.ok) return errorPayload(stylistResult.error, stylistResult.suggestions);
        const serviceResult = resolveService(services, serviceName);
        if (!serviceResult.ok) return errorPayload(serviceResult.error, serviceResult.suggestions);
        const dateIsoNorm = parseSalonDateIso(dateIso);
        if (!dateIsoNorm) return errorPayload("Please provide a valid date.", []);

        const durationMinutes = serviceDurationForStylist(
          serviceResult.item,
          stylistResult.item.id,
          stylistOverrides
        );

        let requestedSlot: SlotCandidate | undefined;
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
              };
            } else {
              const alt = await findAvailableSlots({
                salonId,
                stylistId: stylistResult.item.id,
                durationMinutes,
                fromDate: dateIsoNorm,
                daysToScan: 5,
                timePreference: "any",
                maxResults: 6,
              });
              return errorPayload(
                `Not available at ${requestedTime} on ${dateIsoNorm}.`,
                alt.map((s) => `${s.dayLabel} at ${s.timeLabel}`)
              );
            }
          }
        }

        const slots = await findAvailableSlots({
          salonId,
          stylistId: stylistResult.item.id,
          durationMinutes,
          fromDate: dateIsoNorm,
          daysToScan: 5,
          timePreference: timePreference ?? "any",
          maxResults: 8,
          prioritizeLocalTime: requestedTime?.trim(),
        });
        if (slots.length === 0) {
          return errorPayload("No openings on that day. Try another date or stylist.", stylists.map((s) => s.name));
        }
        return successPayload({
          stylist: stylistResult.item.name,
          service: serviceResult.item.name,
          price: formatPriceMinor(serviceResult.item.priceMinor),
          slots,
          ...(requestedSlot ? { requestedSlot, requestedSlotAvailable: true } : {}),
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
- Use list_services / check_availability / book_guest_appointment for bookings
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
