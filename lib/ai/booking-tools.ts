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
  filterServices,
  matchServiceForBooking,
} from "./booking-resolvers";
import { findAvailableSlots, isSlotAvailable, parseDateIso } from "./slot-finder";
import { parseSalonDateIso, parseSalonLocalTime, salonLocalToUtc, todaySalonDateIso } from "./salon-time";
import type { SalonBookingCatalog, SlotCandidate, SynkAiAccess, TimePreference } from "./booking-types";
import { formatDurationMinutes } from "@/lib/format-duration";
import { SYNKAI_AGENT_NAME } from "@/lib/ai/synkai-brand";
import {
  SYNKAI_NATURAL_LANGUAGE_SERVICES,
  formatServiceCatalogLine,
  uniqueServiceCategories,
} from "@/lib/ai/synkai-service-prompts";
import {
  synkaiCancelAppointment,
  synkaiDeleteAppointment,
  synkaiSendAftercare,
  synkaiSendAppointmentReminder,
  synkaiSendBookingConfirmation,
  synkaiSendRunningLate,
} from "@/lib/ai/synkai-appointment-actions";
import { getPageHelpContext } from "@/lib/help/page-context";

function errorPayload(message: string, suggestions: string[] = []) {
  return { success: false as const, error: message, suggestions };
}

function successPayload<T extends Record<string, unknown>>(data: T) {
  return { success: true as const, ...data };
}

export function createBookingTools(catalog: SalonBookingCatalog, access?: SynkAiAccess) {
  const { salonId, salonName, services, stylists, clients, stylistOverrides, products, teamMembers } =
    catalog;
  const isManager = access?.isManager ?? false;

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
        const rows = filterServices(services, query);
        if (rows.length === 0) {
          return errorPayload(
            query?.trim() ? `No services match "${query}".` : "No services are configured for this salon.",
            services.slice(0, 6).map((s) => s.name)
          );
        }
        return successPayload({
          services: rows.map((s) => ({
            name: s.name,
            durationMinutes: s.durationMinutes,
            price: formatPriceMinor(s.priceMinor),
            category: s.categoryName ?? undefined,
            description: s.description ? s.description.slice(0, 200) : undefined,
          })),
        });
      },
    }),

    match_service: tool({
      description:
        "Resolve casual wording to an exact bookable service name before checking availability or booking.",
      inputSchema: jsonSchema<{ description: string }>({
        type: "object",
        properties: {
          description: { type: "string", description: "Plain English service request from the user" },
        },
        required: ["description"],
        additionalProperties: false,
      }),
      execute: async ({ description }) => {
        const match = matchServiceForBooking(services, description);
        if (!match.ok) return errorPayload(match.error, match.suggestions);
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

    list_products: tool({
      description: "List retail products the salon sells (for checkout suggestions or client questions).",
      inputSchema: jsonSchema<{ query?: string }>({
        type: "object",
        properties: {
          query: { type: "string", description: "Optional filter by product name" },
        },
        additionalProperties: false,
      }),
      execute: async ({ query }) => {
        const q = query?.trim().toLowerCase();
        const rows = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
        if (rows.length === 0) {
          return errorPayload(
            q ? `No products match "${query}".` : "No active retail products are configured.",
            products.slice(0, 6).map((p) => p.name)
          );
        }
        return successPayload({
          products: rows.map((p) => ({
            name: p.name,
            price: formatPriceMinor(p.priceMinor),
            category: p.category ?? undefined,
            description: p.description ? p.description.slice(0, 160) : undefined,
          })),
        });
      },
    }),

    list_clients: tool({
      description:
        "Search clients on file by name. Use before booking or when the user asks about a client.",
      inputSchema: jsonSchema<{ query?: string }>({
        type: "object",
        properties: {
          query: { type: "string", description: "Optional name filter" },
        },
        additionalProperties: false,
      }),
      execute: async ({ query }) => {
        const q = query?.trim().toLowerCase();
        const rows = q
          ? clients.filter((c) => (c.name ?? "").toLowerCase().includes(q))
          : clients.slice(0, 30);
        if (rows.length === 0) {
          return errorPayload(q ? `No clients match "${query}".` : "No clients on file yet.", []);
        }
        return successPayload({
          clients: rows.map((c) => ({
            name: c.name ?? "Unnamed",
            hasEmail: Boolean(c.email?.trim()),
            hasPhone: Boolean(c.phone?.trim()),
          })),
        });
      },
    }),

    ...(isManager
      ? {
          list_team_members: tool({
            description: "List all active salon team members and their roles (owners/managers only).",
            inputSchema: jsonSchema<Record<string, never>>({
              type: "object",
              properties: {},
              additionalProperties: false,
            }),
            execute: async () => {
              if (teamMembers.length === 0) {
                return errorPayload("No team members found.", []);
              }
              return successPayload({
                team: teamMembers.map((m) => ({
                  name: m.name,
                  role: m.role,
                  onDiary: m.showsOnDiary,
                })),
              });
            },
          }),
        }
      : {}),

    cancel_appointment: tool({
      description: "Cancel a scheduled appointment (sets status to canceled). Use find_appointments first.",
      inputSchema: jsonSchema<{ appointmentId: string }>({
        type: "object",
        properties: { appointmentId: { type: "string" } },
        required: ["appointmentId"],
        additionalProperties: false,
      }),
      execute: async ({ appointmentId }) => {
        const result = await synkaiCancelAppointment(appointmentId, salonId);
        if (!result.ok) return errorPayload(result.error ?? "Could not cancel.", []);
        return successPayload({
          bookingChanged: true,
          appointmentId,
          message: "Appointment canceled.",
        });
      },
    }),

    delete_appointment: tool({
      description: "Permanently delete an appointment from the diary. Confirm with the user first.",
      inputSchema: jsonSchema<{ appointmentId: string }>({
        type: "object",
        properties: { appointmentId: { type: "string" } },
        required: ["appointmentId"],
        additionalProperties: false,
      }),
      execute: async ({ appointmentId }) => {
        const supabase = await createClient();
        const { data } = await supabase
          .from("appointments")
          .select("id")
          .eq("id", appointmentId)
          .eq("salon_id", salonId)
          .maybeSingle();
        if (!data) return errorPayload("Appointment not found.", []);
        const result = await synkaiDeleteAppointment(appointmentId);
        if (!result.ok) return errorPayload(result.error ?? "Could not delete.", []);
        return successPayload({
          bookingChanged: true,
          appointmentId,
          message: "Appointment deleted from the diary.",
        });
      },
    }),

    send_booking_confirmation: tool({
      description:
        "Send booking confirmation to the client by email (preferred) or SMS/WhatsApp using contact details on file.",
      inputSchema: jsonSchema<{ appointmentId: string }>({
        type: "object",
        properties: { appointmentId: { type: "string" } },
        required: ["appointmentId"],
        additionalProperties: false,
      }),
      execute: async ({ appointmentId }) => {
        const result = await synkaiSendBookingConfirmation(appointmentId, salonId);
        if (!result.ok) return errorPayload(result.error ?? "Could not send confirmation.", []);
        return successPayload({
          appointmentId,
          channel: result.channel,
          message: `Booking confirmation sent via ${result.channel}.`,
        });
      },
    }),

    send_appointment_reminder: tool({
      description:
        "Send an appointment reminder now by SMS/WhatsApp or email, depending on what contact info is saved.",
      inputSchema: jsonSchema<{ appointmentId: string }>({
        type: "object",
        properties: { appointmentId: { type: "string" } },
        required: ["appointmentId"],
        additionalProperties: false,
      }),
      execute: async ({ appointmentId }) => {
        const result = await synkaiSendAppointmentReminder(appointmentId, salonId);
        if (!result.ok) return errorPayload(result.error ?? "Could not send reminder.", []);
        return successPayload({
          appointmentId,
          channel: result.channel,
          message: `Reminder sent via ${result.channel}.`,
        });
      },
    }),

    send_aftercare_message: tool({
      description:
        "Send aftercare advice to the client after their visit (SMS/WhatsApp or email fallback).",
      inputSchema: jsonSchema<{ appointmentId: string }>({
        type: "object",
        properties: { appointmentId: { type: "string" } },
        required: ["appointmentId"],
        additionalProperties: false,
      }),
      execute: async ({ appointmentId }) => {
        const result = await synkaiSendAftercare(appointmentId, salonId);
        if (!result.ok) return errorPayload(result.error ?? "Could not send aftercare.", []);
        return successPayload({
          appointmentId,
          message: "Aftercare message sent.",
        });
      },
    }),

    send_running_late_message: tool({
      description: "Text the client that the salon is running late for their appointment (SMS).",
      inputSchema: jsonSchema<{ appointmentId: string }>({
        type: "object",
        properties: { appointmentId: { type: "string" } },
        required: ["appointmentId"],
        additionalProperties: false,
      }),
      execute: async ({ appointmentId }) => {
        const result = await synkaiSendRunningLate(appointmentId, salonId, salonName);
        if (!result.ok) return errorPayload(result.error ?? "Could not send SMS.", []);
        return successPayload({
          appointmentId,
          message: "Running-late text sent.",
        });
      },
    }),
  };
}

export function buildBookingSystemPrompt(catalog: SalonBookingCatalog, access?: SynkAiAccess): string {
  const todayIso = todaySalonDateIso();
  const weekday = new Date().toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
  });

  const serviceLines = catalog.services.slice(0, 40).map((s) => formatServiceCatalogLine(s, 120)).join("\n");
  const categories = uniqueServiceCategories(catalog.services);

  const productLines = catalog.products
    .slice(0, 20)
    .map((p) => `- ${p.name} (${formatPriceMinor(p.priceMinor)})`)
    .join("\n");

  const stylistLines = catalog.stylists.map((s) => `- ${s.name}`).join("\n");

  const isManager = access?.isManager ?? false;
  const roleLine = isManager
    ? `The user is a salon owner or manager (${access?.memberRole ?? "manager"}). You may help with team overview, SalonSynk features, and full salon operations.`
    : `The user is salon staff (${access?.memberRole ?? "staff"}). Focus on diary work: bookings, clients, services, products, and client messages — not billing setup or admin configuration.`;

  let helpBlock = "";
  if (isManager && access?.pathname) {
    const page = getPageHelpContext(access.pathname);
    helpBlock = `\nSalonSynk help context (${page.pageLabel}):\n${page.knowledge.slice(0, 1200)}\n`;
  }

  return `You are ${SYNKAI_AGENT_NAME} for ${catalog.salonName} — the in-salon assistant on SalonSynk.

${roleLine}

Today is ${weekday}, ${todayIso}. Use UK English and 24-hour times.

You can:
- List/search services, products, and clients; check availability; book, reschedule, cancel, or delete appointments
- Send booking confirmations, reminders, aftercare, and running-late texts (email/SMS/WhatsApp depending on client contact details saved)
${isManager ? "- List all team members and roles\n- Answer how-to questions about SalonSynk using the help context below" : ""}

Rules:
1. Always use tools for live data — never invent services, prices, times, or contact details.
2. ${SYNKAI_NATURAL_LANGUAGE_SERVICES}
3. Call match_service when the user describes a treatment loosely; never book using a category name.
4. Call check_availability before booking when a day/time is given; pass requestedTime as HH:mm for specific times.
5. Use find_appointments to get appointmentId before cancel/delete/messaging actions.
6. Confirm before delete_appointment.
7. For messaging, explain which channel was used (email vs SMS) or why it failed (missing phone/email or Twilio/Resend not configured).
8. After booking changes, mention the Classic Mode diary will update.

Opening hours: ${catalog.openingHoursNote}
${catalog.aftercareMessage ? `Default aftercare copy: ${catalog.aftercareMessage.slice(0, 300)}` : ""}

Services:
${serviceLines || "(none configured)"}

Service categories:
${categories.map((c) => `- ${c}`).join("\n") || "(none)"}

Retail products:
${productLines || "(none configured)"}

Stylists on diary:
${stylistLines || "(none configured)"}
${helpBlock}
When the user says "Tuesday morning", resolve to the next matching date from ${todayIso} and pass timePreference to check_availability.`;
}
