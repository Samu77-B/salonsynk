import { createAdminClient } from "@/lib/supabase/admin";
import { sendClientBookingConfirmation } from "@/lib/booking-notifications";
import { hasOverlap, rangeToMinutes } from "@/lib/diary-rules";
import {
  fetchSalonMembersAdaptiveSelect,
  memberShowsOnDiary,
  isMissingShowOnDiaryColumnError,
} from "@/lib/show-on-diary";
import { triggerBookingConfirmation } from "@/lib/appointment-automation";

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
};

export type GuestBookingResult =
  | { error: string; confirmationEmailError?: string }
  | { error: null; appointmentId: string; confirmationEmailError?: string };

/** Shared guest booking executor used by public form and public AI concierge tools. */
export async function executeGuestBooking(data: GuestBookingInput): Promise<GuestBookingResult> {
  const supabase = createAdminClient();
  const { data: salon } = await supabase.from("salons").select("id, name").eq("id", data.salonId).single();
  if (!salon) return { error: "Salon not found" };

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
  const end = new Date(data.endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
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

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      salon_id: data.salonId,
      stylist_id: stylistId,
      service_id: data.serviceId || null,
      start_time: data.startTime,
      end_time: data.endTime,
      guest_name: data.guestName,
      guest_email: data.guestEmail,
      guest_phone: data.guestPhone || null,
      status: "scheduled",
      silent_service: data.silentService ?? false,
      send_reminder_sms: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  const appointmentId = appointment?.id as string;

  let serviceName: string | null = null;
  if (data.serviceId) {
    const { data: svc } = await supabase
      .from("services")
      .select("name")
      .eq("id", data.serviceId)
      .eq("salon_id", data.salonId)
      .maybeSingle();
    serviceName = svc?.name ?? null;
  }

  const { emailError } = await sendClientBookingConfirmation({
    email: data.guestEmail,
    phone: data.guestPhone,
    salonName: salon.name,
    start,
    serviceName,
  });
  void triggerBookingConfirmation(appointmentId);

  return { error: null, appointmentId, confirmationEmailError: emailError };
}
