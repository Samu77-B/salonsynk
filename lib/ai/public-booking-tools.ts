import { tool, jsonSchema } from "ai";
import { executeGuestBooking } from "@/lib/appointments/create-guest-appointment";
import {
  formatPriceMinor,
  resolveService,
  resolveStylist,
  serviceDurationForStylist,
} from "./booking-resolvers";
import { findAvailableSlots, parseDateIso } from "./slot-finder";
import type { PublicSalonContext } from "./load-public-salon-catalog";
import type { TimePreference } from "./booking-types";

function errorPayload(message: string, suggestions: string[] = []) {
  return { success: false as const, error: message, suggestions };
}

function successPayload<T extends Record<string, unknown>>(data: T) {
  return { success: true as const, ...data };
}

/** Guest-safe booking tools — no client list, reschedule, or internal notes. */
export function createPublicBookingTools(catalog: PublicSalonContext) {
  const { salonId, salonName, services, stylists, stylistOverrides, slug } = catalog;

  return {
    list_services: tool({
      description: "List services available for online booking.",
      inputSchema: jsonSchema<{ query?: string }>({
        type: "object",
        properties: { query: { type: "string" } },
        additionalProperties: false,
      }),
      execute: async ({ query }) => {
        const q = query?.trim().toLowerCase();
        const rows = q ? services.filter((s) => s.name.toLowerCase().includes(q)) : services;
        return successPayload({
          services: rows.map((s) => ({
            name: s.name,
            durationMinutes: s.durationMinutes,
            price: formatPriceMinor(s.priceMinor),
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
      }>({
        type: "object",
        properties: {
          stylistName: { type: "string" },
          serviceName: { type: "string" },
          dateIso: { type: "string" },
          timePreference: { type: "string", enum: ["morning", "afternoon", "evening", "any"] },
        },
        required: ["stylistName", "serviceName", "dateIso"],
        additionalProperties: false,
      }),
      execute: async ({ stylistName, serviceName, dateIso, timePreference }) => {
        const stylistResult = resolveStylist(stylists, stylistName);
        if (!stylistResult.ok) return errorPayload(stylistResult.error, stylistResult.suggestions);
        const serviceResult = resolveService(services, serviceName);
        if (!serviceResult.ok) return errorPayload(serviceResult.error, serviceResult.suggestions);
        const date = parseDateIso(dateIso);
        if (!date) return errorPayload("Please provide a valid date.", []);

        const durationMinutes = serviceDurationForStylist(
          serviceResult.item,
          stylistResult.item.id,
          stylistOverrides
        );
        const slots = await findAvailableSlots({
          salonId,
          stylistId: stylistResult.item.id,
          durationMinutes,
          fromDate: date,
          daysToScan: 5,
          timePreference: timePreference ?? "any",
          maxResults: 5,
        });
        if (slots.length === 0) {
          return errorPayload("No openings on that day. Try another date or stylist.", stylists.map((s) => s.name));
        }
        return successPayload({
          stylist: stylistResult.item.name,
          service: serviceResult.item.name,
          price: formatPriceMinor(serviceResult.item.priceMinor),
          slots,
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
  const today = new Date().toISOString().slice(0, 10);
  const serviceLines = catalog.services
    .slice(0, 30)
    .map((s) => `- ${s.name} (${s.durationMinutes} min, ${formatPriceMinor(s.priceMinor)})`)
    .join("\n");

  return `You are the AI Concierge for ${catalog.salonName} — a friendly public booking assistant for clients (not staff).

Today is ${today}. Use UK English.

You help clients:
- Learn about services and prices
- Check availability
- Book appointments (collect full name and email before booking)

Rules:
- Never mention internal staff tools, reports, or client databases
- Use check_availability before book_guest_appointment
- If asked about salon policy: ${catalog.policyNotes}
- Be concise and welcoming

Services:
${serviceLines || "(contact salon)"}

Stylists:
${catalog.stylists.map((s) => `- ${s.name}`).join("\n") || "(any available)"}`;
}

export function buildPublicQaPrompt(catalog: PublicSalonContext): string {
  const serviceLines = catalog.services
    .map((s) => `- ${s.name}: ${s.durationMinutes} min, ${formatPriceMinor(s.priceMinor)}`)
    .join("\n");

  return `You are the SalonSynk QA Assistant for ${catalog.salonName}. Answer client questions about services, pricing, policies, and how to book.

Policy context: ${catalog.policyNotes}

Services:
${serviceLines}

Booking: clients can book via this page's booking form or AI Concierge tab.

Rules:
- UK English, friendly and factual
- Do not invent services or prices not listed above
- For account-specific questions, ask them to contact the salon directly
- You cannot access appointment records or staff schedules in QA mode — suggest the AI Concierge for booking`;
}
