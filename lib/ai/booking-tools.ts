import { tool, jsonSchema } from "ai";
import { createClient } from "@/lib/supabase/server";
import { executeCreateAppointment } from "@/lib/appointments/create-appointment";
import { executeAppointmentPatch } from "@/lib/appointments/patch-appointment";
import {
  formatPriceMinor,
  resolveClient,
  resolveService,
  resolveStylist,
  serviceDurationForStylist,
} from "./booking-resolvers";
import { findAvailableSlots, isSlotAvailable, parseDateIso } from "./slot-finder";
import { parseSalonDateIso, parseSalonLocalTime, salonLocalToUtc, todaySalonDateIso } from "./salon-time";
import type { SalonBookingCatalog, SlotCandidate, TimePreference } from "./booking-types";
import { formatDurationMinutes } from "@/lib/format-duration";

function errorPayload(message: string, suggestions: string[] = []) {
  return { success: false as const, error: message, suggestions };
}

function successPayload<T extends Record<string, unknown>>(data: T) {
  return { success: true as const, ...data };
}

export function createBookingTools(catalog: SalonBookingCatalog) {
  const { salonId, salonName, services, stylists, clients, stylistOverrides } = catalog;

  return {
    list_services: tool({
      description: "List salon services with duration and price. Use when the user asks what services are available.",
      inputSchema: jsonSchema<{ query?: string }>({
        type: "object",
        properties: {
          query: { type: "string", description: "Optional filter by service name" },
        },
        additionalProperties: false,
      }),
      execute: async ({ query }) => {
        const q = query?.trim().toLowerCase();
        const rows = q
          ? services.filter((s) => s.name.toLowerCase().includes(q))
          : services;
        if (rows.length === 0) {
          return errorPayload(
            q ? `No services match "${query}".` : "No services are configured for this salon.",
            services.slice(0, 6).map((s) => s.name)
          );
        }
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
      description: "List stylists who appear on the diary. Use when the user asks who is available or who works here.",
      inputSchema: jsonSchema<Record<string, never>>({
        type: "object",
        properties: {},
        additionalProperties: false,
      }),
      execute: async () => {
        if (stylists.length === 0) {
          return errorPayload("No stylists are set to show on the diary.", []);
        }
        return successPayload({
          stylists: stylists.map((s) => s.name),
        });
      },
    }),

    check_availability: tool({
      description:
        "Check available appointment slots for a stylist and service on a given date. Use before booking or when the user asks about openings.",
      inputSchema: jsonSchema<{
        stylistName: string;
        serviceName: string;
        dateIso: string;
        timePreference?: TimePreference;
        requestedTime?: string;
      }>({
        type: "object",
        properties: {
          stylistName: { type: "string", description: "Stylist display name" },
          serviceName: { type: "string", description: "Service name" },
          dateIso: { type: "string", description: "Date in YYYY-MM-DD format" },
          timePreference: {
            type: "string",
            enum: ["morning", "afternoon", "evening", "any"],
            description: "Optional time-of-day preference",
          },
          requestedTime: {
            type: "string",
            description: "Optional specific time to verify, 24h HH:mm (e.g. 15:00 for 3pm). Always pass when the user asks for a specific time.",
          },
        },
        required: ["stylistName", "serviceName", "dateIso"],
        additionalProperties: false,
      }),
      execute: async ({ stylistName, serviceName, dateIso, timePreference, requestedTime }) => {
        const stylistResult = resolveStylist(stylists, stylistName);
        if (!stylistResult.ok) {
          return errorPayload(stylistResult.error, stylistResult.suggestions);
        }

        const serviceResult = resolveService(services, serviceName);
        if (!serviceResult.ok) {
          return errorPayload(serviceResult.error, serviceResult.suggestions);
        }

        const date = parseDateIso(dateIso);
        if (!date) {
          return errorPayload("I couldn't understand that date. Please use a date like 2026-06-24.", []);
        }

        const durationMinutes = serviceDurationForStylist(
          serviceResult.item,
          stylistResult.item.id,
          stylistOverrides
        );

        const dateIsoNorm = parseSalonDateIso(dateIso) ?? dateIso;
        let requestedSlotAvailable: boolean | undefined;
        let requestedSlot: SlotCandidate | undefined;

        if (requestedTime?.trim()) {
          const parsedTime = parseSalonLocalTime(requestedTime.trim());
          if (parsedTime) {
            const start = salonLocalToUtc(dateIsoNorm, parsedTime.hour, parsedTime.minute);
            requestedSlotAvailable = await isSlotAvailable({
              salonId,
              stylistId: stylistResult.item.id,
              startTime: start,
              durationMinutes,
            });
            if (requestedSlotAvailable) {
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
            }
          }
        }

        const slots = await findAvailableSlots({
          salonId,
          stylistId: stylistResult.item.id,
          durationMinutes,
          fromDate: dateIsoNorm,
          daysToScan: 3,
          timePreference: timePreference ?? "any",
          maxResults: 12,
          prioritizeLocalTime: requestedTime?.trim(),
        });

        if (requestedSlotAvailable === false) {
          return {
            success: false as const,
            error: `${stylistResult.item.name} is not free at ${requestedTime} on ${dateIsoNorm} for a ${formatDurationMinutes(durationMinutes)} ${serviceResult.item.name}.`,
            requestedSlotAvailable: false,
            suggestions: slots.slice(0, 6).map((s) => `${s.dayLabel} at ${s.timeLabel}`),
            alternativeSlots: slots.slice(0, 6),
          };
        }

        if (slots.length === 0) {
          const altSlots = await findAvailableSlots({
            salonId,
            stylistId: stylistResult.item.id,
            durationMinutes,
            fromDate: date,
            daysToScan: 5,
            timePreference: "any",
            maxResults: 4,
          });

          if (altSlots.length > 0) {
            return {
              success: false as const,
              error: `No openings for ${stylistResult.item.name} on that date${timePreference && timePreference !== "any" ? ` in the ${timePreference}` : ""}. Here are nearby alternatives:`,
              suggestions: altSlots.map((s) => `${s.dayLabel} at ${s.timeLabel}`),
              alternativeSlots: altSlots,
            };
          }

          return errorPayload(
            `${stylistResult.item.name} has no available slots for ${serviceResult.item.name} around ${dateIso}. Try another day or stylist.`,
            stylists.filter((s) => s.id !== stylistResult.item.id).slice(0, 4).map((s) => s.name)
          );
        }

        return successPayload({
          stylist: stylistResult.item.name,
          service: serviceResult.item.name,
          durationMinutes,
          price: formatPriceMinor(serviceResult.item.priceMinor),
          slots,
          ...(requestedSlot ? { requestedSlot, requestedSlotAvailable: true } : {}),
        });
      },
    }),

    book_appointment: tool({
      description:
        "Create a new appointment after confirming stylist, service, client, and start time. Requires an ISO start time from check_availability.",
      inputSchema: jsonSchema<{
        stylistName: string;
        serviceName: string;
        startTimeIso: string;
        clientName?: string;
        guestName?: string;
        notes?: string;
      }>({
        type: "object",
        properties: {
          stylistName: { type: "string" },
          serviceName: { type: "string" },
          startTimeIso: { type: "string", description: "ISO datetime for appointment start" },
          clientName: { type: "string", description: "Existing client name" },
          guestName: { type: "string", description: "Walk-in guest name if no client record" },
          notes: { type: "string" },
        },
        required: ["stylistName", "serviceName", "startTimeIso"],
        additionalProperties: false,
      }),
      execute: async ({ stylistName, serviceName, startTimeIso, clientName, guestName, notes }) => {
        const stylistResult = resolveStylist(stylists, stylistName);
        if (!stylistResult.ok) {
          return errorPayload(stylistResult.error, stylistResult.suggestions);
        }

        const serviceResult = resolveService(services, serviceName);
        if (!serviceResult.ok) {
          return errorPayload(serviceResult.error, serviceResult.suggestions);
        }

        const start = new Date(startTimeIso);
        if (!Number.isFinite(start.getTime())) {
          return errorPayload("That start time is not valid. Please pick a slot from availability.", []);
        }

        const durationMinutes = serviceDurationForStylist(
          serviceResult.item,
          stylistResult.item.id,
          stylistOverrides
        );
        const end = new Date(start.getTime() + durationMinutes * 60_000);

        let clientId: string | null = null;
        let resolvedGuestName: string | null = guestName?.trim() || null;

        if (clientName?.trim()) {
          const clientResult = resolveClient(clients, clientName);
          if (!clientResult.ok) {
            return errorPayload(clientResult.error, clientResult.suggestions);
          }
          clientId = clientResult.item.id;
          resolvedGuestName = clientResult.item.name;
        } else if (!resolvedGuestName) {
          return errorPayload(
            "Who is this appointment for? Please provide a client name or guest name.",
            clients.slice(0, 5).map((c) => c.name ?? "").filter(Boolean)
          );
        }

        const result = await executeCreateAppointment({
          salonId,
          stylistId: stylistResult.item.id,
          clientId,
          serviceId: serviceResult.item.id,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          guestName: clientId ? null : resolvedGuestName,
          notes: notes?.trim() || null,
          sendReminderSms: true,
        });

        if (result.error) {
          return errorPayload(result.error, []);
        }

        const appointmentId = "appointmentId" in result ? result.appointmentId : undefined;
        if (!appointmentId) {
          return errorPayload("Booking was created but the appointment id could not be read.", []);
        }

        return successPayload({
          bookingChanged: true,
          appointmentId,
          salonName,
          stylist: stylistResult.item.name,
          service: serviceResult.item.name,
          client: resolvedGuestName,
          startTimeIso: start.toISOString(),
          endTimeIso: end.toISOString(),
          price: formatPriceMinor(serviceResult.item.priceMinor),
          message: `Booked ${serviceResult.item.name} with ${stylistResult.item.name} for ${resolvedGuestName}.`,
        });
      },
    }),

    find_appointments: tool({
      description: "Find upcoming scheduled appointments by client or stylist name. Use before rescheduling.",
      inputSchema: jsonSchema<{
        clientName?: string;
        stylistName?: string;
        fromDateIso?: string;
      }>({
        type: "object",
        properties: {
          clientName: { type: "string" },
          stylistName: { type: "string" },
          fromDateIso: { type: "string", description: "Optional start date YYYY-MM-DD" },
        },
        additionalProperties: false,
      }),
      execute: async ({ clientName, stylistName, fromDateIso }) => {
        const from = fromDateIso ? parseDateIso(fromDateIso) : new Date();
        if (!from) {
          return errorPayload("Invalid fromDateIso.", []);
        }
        from.setHours(0, 0, 0, 0);

        const supabase = await createClient();
        let query = supabase
          .from("appointments")
          .select(
            "id, start_time, end_time, status, guest_name, stylist_id, client_id, clients(name), salon_members(display_name), services(name)"
          )
          .eq("salon_id", salonId)
          .eq("status", "scheduled")
          .gte("start_time", from.toISOString())
          .order("start_time", { ascending: true })
          .limit(12);

        if (stylistName?.trim()) {
          const stylistResult = resolveStylist(stylists, stylistName);
          if (!stylistResult.ok) {
            return errorPayload(stylistResult.error, stylistResult.suggestions);
          }
          query = query.eq("stylist_id", stylistResult.item.id);
        }

        const { data, error } = await query;
        if (error) return errorPayload(error.message, []);

        let rows = data ?? [];
        if (clientName?.trim()) {
          const clientResult = resolveClient(clients, clientName);
          if (!clientResult.ok) {
            return errorPayload(clientResult.error, clientResult.suggestions);
          }
          rows = rows.filter((r) => r.client_id === clientResult.item.id);
        }

        if (rows.length === 0) {
          return errorPayload("No upcoming scheduled appointments matched that search.", []);
        }

        return successPayload({
          appointments: rows.map((row) => {
            const r = row as {
              id: string;
              start_time: string;
              guest_name: string | null;
              clients: { name: string | null } | { name: string | null }[] | null;
              salon_members: { display_name: string | null } | { display_name: string | null }[] | null;
              services: { name: string } | { name: string }[] | null;
            };
            const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
            const member = Array.isArray(r.salon_members) ? r.salon_members[0] : r.salon_members;
            const service = Array.isArray(r.services) ? r.services[0] : r.services;
            const start = new Date(r.start_time);
            return {
              appointmentId: r.id,
              clientName: client?.name || r.guest_name || "Guest",
              stylistName: member?.display_name || "Stylist",
              serviceName: service?.name || "Appointment",
              startTimeIso: r.start_time,
              label: `${start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
            };
          }),
        });
      },
    }),

    reschedule_appointment: tool({
      description: "Move an existing appointment to a new start time (and optionally another stylist).",
      inputSchema: jsonSchema<{
        appointmentId: string;
        newStartTimeIso: string;
        stylistName?: string;
      }>({
        type: "object",
        properties: {
          appointmentId: { type: "string" },
          newStartTimeIso: { type: "string" },
          stylistName: { type: "string", description: "Optional new stylist" },
        },
        required: ["appointmentId", "newStartTimeIso"],
        additionalProperties: false,
      }),
      execute: async ({ appointmentId, newStartTimeIso, stylistName }) => {
        const supabase = await createClient();
        const { data: existing, error: loadErr } = await supabase
          .from("appointments")
          .select("id, start_time, end_time, stylist_id, salon_id")
          .eq("id", appointmentId)
          .eq("salon_id", salonId)
          .maybeSingle();

        if (loadErr || !existing) {
          return errorPayload("I couldn't find that appointment.", []);
        }

        const oldStart = new Date(existing.start_time);
        const oldEnd = new Date(existing.end_time);
        const durationMs = oldEnd.getTime() - oldStart.getTime();
        const newStart = new Date(newStartTimeIso);
        if (!Number.isFinite(newStart.getTime()) || durationMs <= 0) {
          return errorPayload("That new time is not valid.", []);
        }
        const newEnd = new Date(newStart.getTime() + durationMs);

        const updates: {
          start_time: string;
          end_time: string;
          stylist_id?: string;
        } = {
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        };

        if (stylistName?.trim()) {
          const stylistResult = resolveStylist(stylists, stylistName);
          if (!stylistResult.ok) {
            return errorPayload(stylistResult.error, stylistResult.suggestions);
          }
          updates.stylist_id = stylistResult.item.id;
        }

        const result = await executeAppointmentPatch(appointmentId, updates);
        if (result.error) {
          return errorPayload(result.error, []);
        }

        return successPayload({
          bookingChanged: true,
          appointmentId,
          newStartTimeIso: newStart.toISOString(),
          newEndTimeIso: newEnd.toISOString(),
          message: "Appointment rescheduled successfully.",
        });
      },
    }),
  };
}

export function buildBookingSystemPrompt(catalog: SalonBookingCatalog): string {
  const todayIso = todaySalonDateIso();
  const weekday = new Date().toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
  });

  const serviceLines = catalog.services
    .slice(0, 40)
    .map((s) => `- ${s.name} (${formatDurationMinutes(s.durationMinutes)}, ${formatPriceMinor(s.priceMinor)})`)
    .join("\n");

  const stylistLines = catalog.stylists.map((s) => `- ${s.name}`).join("\n");

  return `You are SalonSynk Booking Assistant for ${catalog.salonName}.

Today is ${weekday}, ${todayIso}. Use UK English and 24-hour style times in replies.

You help salon staff book and reschedule appointments using tools. Always:
1. Resolve service and stylist names against the salon catalog below.
2. Call check_availability before book_appointment when the user gives a day/time preference. If they ask for a specific time (e.g. 3pm), always pass requestedTime as 24h HH:mm (15:00).
3. If requestedSlotAvailable is true, that exact time is free — book it. Do not say unavailable because other listed slots are earlier in the day.
4. Ask for the client or guest name before booking if missing.
5. If a tool returns success:false, explain politely and offer suggestions from the tool response.
6. Never invent services, stylists, prices, or times — only use tool results.
7. After a successful booking or reschedule, confirm details clearly and mention the Classic Mode diary will show the update.

Services:
${serviceLines || "(none configured)"}

Stylists on diary:
${stylistLines || "(none configured)"}

When the user says things like "Tuesday morning", resolve to the next matching date (${todayIso} reference) and pass timePreference to check_availability.`;
}
