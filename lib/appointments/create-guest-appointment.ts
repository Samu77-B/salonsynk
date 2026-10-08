import { createAdminClient } from "@/lib/supabase/admin";
import { hasOverlap, rangeToMinutes } from "@/lib/diary-rules";
import {
  fetchSalonMembersAdaptiveSelect,
  memberShowsOnDiary,
  isMissingShowOnDiaryColumnError,
} from "@/lib/show-on-diary";
import { triggerBookingConfirmation } from "@/lib/appointment-automation";
import {
  bookingPolicyActive,
  classifyHairService,
  classifyServicesForBooking,
  findConsultationService,
  parseBookingPolicy,
  colourMinBookableDate,
  type BookingPolicy,
} from "@/lib/booking-policy";
import { upsertGuestClient } from "@/lib/clients/upsert-guest";
import { isReturningColourClient } from "@/lib/clients/returning-colour";
import { saveColourPatchTestWaiver, validateColourWaiver } from "@/lib/waivers/colour-patch-test";
import { normalizePhoneDigits } from "@/lib/clients/upsert-guest";

export type GuestWaiverPayload = {
  agreed: boolean;
  signerName: string;
  signatureData?: string | null;
};

export type GuestBookingInput = {
  salonId: string;
  serviceId?: string;
  stylistId?: string;
  startTime: string;
  endTime: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  silentService?: boolean;
  returningColourClient?: boolean;
  patchTestChoice?: "will_test" | "decline";
  waiver?: GuestWaiverPayload;
  joinClub?: boolean;
  requestMeta?: { ip?: string | null; userAgent?: string | null };
};

export type GuestBookingResult =
  | { error: string; confirmationEmailError?: string }
  | {
      error: null;
      appointmentId: string;
      confirmationEmailError?: string;
      smsSent?: boolean;
      remappedToConsultation?: boolean;
      bookedServiceName?: string | null;
    };

function phoneLooksValid(phone: string | null | undefined): boolean {
  return normalizePhoneDigits(phone).length >= 10;
}

async function loadServiceRow(
  supabase: ReturnType<typeof createAdminClient>,
  salonId: string,
  serviceId: string
) {
  const withCat = await supabase
    .from("services")
    .select("id, name, duration_minutes, category_id")
    .eq("id", serviceId)
    .eq("salon_id", salonId)
    .maybeSingle();
  if (!withCat.error) return withCat.data as {
    id: string;
    name: string;
    duration_minutes: number;
    category_id?: string | null;
  } | null;
  const basic = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("id", serviceId)
    .eq("salon_id", salonId)
    .maybeSingle();
  return basic.data as { id: string; name: string; duration_minutes: number; category_id?: string | null } | null;
}

async function applyColourBookingRules(params: {
  supabase: ReturnType<typeof createAdminClient>;
  salonId: string;
  policy: BookingPolicy;
  serviceId?: string;
  guestEmail: string;
  guestPhone?: string;
}): Promise<
  | { error: string }
  | {
      serviceId: string | undefined;
      remappedToConsultation: boolean;
      classified: { isColour: boolean; isConsultation: boolean };
      serviceName: string | null;
      durationMinutes: number | null;
    }
> {
  const { supabase, salonId, policy, guestEmail, guestPhone } = params;
  let serviceId = params.serviceId;
  let remappedToConsultation = false;
  let classified = { isColour: false, isConsultation: false };
  let serviceName: string | null = null;
  let durationMinutes: number | null = null;

  if (!serviceId) {
    return { serviceId, remappedToConsultation, classified, serviceName, durationMinutes };
  }

  const service = await loadServiceRow(supabase, salonId, serviceId);
  if (!service) return { error: "Invalid service" };
  serviceName = service.name;
  durationMinutes = service.duration_minutes;

  let categoryName: string | null = null;
  if (service.category_id) {
    const { data: cat } = await supabase
      .from("service_categories")
      .select("name")
      .eq("id", service.category_id)
      .maybeSingle();
    categoryName = (cat?.name as string | undefined) ?? null;
  }
  classified = classifyHairService(service.name, categoryName);

  if (classified.isColour && !classified.isConsultation && policy.newClientColourConsultation) {
    const knownReturning = await isReturningColourClient(supabase, salonId, guestEmail, guestPhone);
    if (!knownReturning) {
      const { data: allServices } = await supabase
        .from("services")
        .select("id, name, duration_minutes, category_id")
        .eq("salon_id", salonId);
      const { data: cats } = await supabase.from("service_categories").select("id, name").eq("salon_id", salonId);
      const classifiedList = classifyServicesForBooking(
        (allServices ?? []) as { id: string; name: string; duration_minutes: number; category_id?: string | null }[],
        (cats ?? []) as { id: string; name: string }[]
      );
      const consult = findConsultationService(classifiedList, policy.consultationServiceId);
      if (!consult) {
        return {
          error:
            "New colour clients need a consultation before Full Head, Balayage, or similar. Please choose a consultation or contact the salon.",
        };
      }
      serviceId = consult.id;
      serviceName = consult.name;
      durationMinutes = consult.duration_minutes;
      classified = { isColour: false, isConsultation: true };
      remappedToConsultation = true;
    }
  }

  return { serviceId, remappedToConsultation, classified, serviceName, durationMinutes };
}

/** Shared guest booking executor used by public form and public AI concierge tools. */
export async function executeGuestBooking(data: GuestBookingInput): Promise<GuestBookingResult> {
  const supabase = createAdminClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, slug, settings")
    .eq("id", data.salonId)
    .single();
  if (!salon) return { error: "Salon not found" };

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const policy = parseBookingPolicy(salon.slug as string, settings, salon.name as string);
  const guestPhone = data.guestPhone?.trim() || "";

  if (policy.phoneRequired && !phoneLooksValid(guestPhone)) {
    return { error: "Please enter a valid mobile number so we can text your confirmation and reminder." };
  }

  const colourResult = await applyColourBookingRules({
    supabase,
    salonId: data.salonId,
    policy,
    serviceId: data.serviceId,
    guestEmail: data.guestEmail,
    guestPhone,
  });
  if ("error" in colourResult) return { error: colourResult.error };

  const finalServiceId = colourResult.serviceId;
  const isColourApplication = colourResult.classified.isColour && !colourResult.classified.isConsultation;

  if (isColourApplication && policy.patchTestWaiver) {
    if (data.patchTestChoice !== "will_test" && data.patchTestChoice !== "decline") {
      return { error: "Please confirm whether you will complete a patch test, or decline and sign the waiver." };
    }
    if (data.patchTestChoice === "decline") {
      const waiverError = validateColourWaiver({
        agreed: data.waiver?.agreed,
        signerName: data.waiver?.signerName,
        signatureData: data.waiver?.signatureData,
      });
      if (waiverError) return { error: waiverError };
    }
  }

  let stylistId = data.stylistId;
  if (!stylistId) {
    const { data: candidates } = await fetchSalonMembersAdaptiveSelect(supabase, data.salonId, [
      "id, show_on_diary",
      "id",
    ]);
    const first = (candidates as { id: string; show_on_diary?: boolean | null }[]).find((m) =>
      memberShowsOnDiary(m)
    );
    if (!first) return { error: "No stylists available" };
    stylistId = first.id;
  } else {
    let smRow = await supabase
      .from("salon_members")
      .select("id, show_on_diary")
      .eq("id", stylistId)
      .eq("salon_id", data.salonId)
      .eq("is_active", true)
      .maybeSingle();
    if (smRow.error && isMissingShowOnDiaryColumnError(smRow.error)) {
      smRow = await supabase
        .from("salon_members")
        .select("id")
        .eq("id", stylistId)
        .eq("salon_id", data.salonId)
        .eq("is_active", true)
        .maybeSingle();
    }
    const sm = smRow.data;
    if (!sm || !memberShowsOnDiary(sm as { show_on_diary?: boolean | null }))
      return { error: "Invalid stylist" };
  }

  const start = new Date(data.startTime);
  if (!Number.isFinite(start.getTime())) {
    return { error: "Invalid date or time." };
  }
  if (isColourApplication && policy.colourMinAdvanceDays > 0) {
    const minDate = colourMinBookableDate(policy);
    if (minDate && start < minDate) {
      return {
        error: `Colour appointments must be booked at least ${policy.colourMinAdvanceDays} days in advance.`,
      };
    }
  }

  let end = new Date(data.endTime);
  if (colourResult.remappedToConsultation && colourResult.durationMinutes) {
    end = new Date(start.getTime() + colourResult.durationMinutes * 60 * 1000);
  }
  if (!Number.isFinite(end.getTime())) {
    return { error: "Invalid date or time." };
  }

  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data: existing } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .eq("salon_id", data.salonId)
    .eq("stylist_id", stylistId)
    .in("status", ["scheduled", "completed"])
    .gte("start_time", dayStart.toISOString())
    .lt("start_time", dayEnd.toISOString());

  const existingRanges = (existing ?? []).map((a) =>
    rangeToMinutes(new Date(a.start_time), new Date(a.end_time))
  );
  const { startMinutes, endMinutes } = rangeToMinutes(start, end);
  if (hasOverlap(existingRanges, startMinutes, endMinutes)) {
    return { error: "This time slot is no longer available. Please choose another time." };
  }

  let clientId: string | null = null;
  if (bookingPolicyActive(policy) || data.joinClub) {
    const upserted = await upsertGuestClient(supabase, {
      salonId: data.salonId,
      name: data.guestName,
      email: data.guestEmail,
      phone: guestPhone || null,
    });
    if (upserted.error) return { error: upserted.error };
    clientId = upserted.clientId;
  }

  let waiverId: string | null = null;
  if (clientId && isColourApplication && policy.patchTestWaiver && data.patchTestChoice === "decline") {
    const saved = await saveColourPatchTestWaiver(supabase, {
      salonId: data.salonId,
      clientId,
      signerName: data.waiver!.signerName,
      signerEmail: data.guestEmail,
      signerPhone: guestPhone || null,
      signatureData: data.waiver?.signatureData,
      waiverText: policy.waiverText,
      ipAddress: data.requestMeta?.ip,
      userAgent: data.requestMeta?.userAgent,
    });
    if ("error" in saved) return { error: saved.error };
    waiverId = saved.waiverId;
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      salon_id: data.salonId,
      stylist_id: stylistId,
      service_id: finalServiceId || null,
      client_id: clientId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      guest_name: data.guestName,
      guest_email: data.guestEmail,
      guest_phone: guestPhone || null,
      status: "scheduled",
      silent_service: data.silentService ?? false,
      send_reminder_sms: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  const appointmentId = appointment?.id as string;

  if (waiverId) {
    await supabase.from("client_waivers").update({ appointment_id: appointmentId }).eq("id", waiverId);
  }

  if (clientId && policy.patchTestWaiver && isColourApplication) {
    const note =
      data.patchTestChoice === "decline"
        ? "Online booking: declined patch test and e-signed colour waiver."
        : "Online booking: agreed to complete a patch test before colour.";
    await supabase.from("client_notes").insert({
      salon_id: data.salonId,
      client_id: clientId,
      note,
      note_type: "skin_test",
    });
  }

  if (clientId && (policy.clubPortalEnabled || data.joinClub)) {
    const { data: inc } = await supabase
      .from("client_incentives")
      .select("id")
      .eq("salon_id", data.salonId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!inc) {
      await supabase.from("client_incentives").insert({
        salon_id: data.salonId,
        client_id: clientId,
        points: 0,
        service_points: 0,
        product_points: 0,
        total_visits: 0,
        tier: "bronze",
      });
    }
  }

  await triggerBookingConfirmation(appointmentId);

  return {
    error: null,
    appointmentId,
    confirmationEmailError: undefined,
    smsSent: policy.smsConfirmation,
    remappedToConsultation: colourResult.remappedToConsultation,
    bookedServiceName: colourResult.serviceName,
  };
}
