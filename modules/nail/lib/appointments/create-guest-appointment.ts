import { createAdminClient } from "@core/supabase/admin";
import { sendClientBookingConfirmation } from "@/lib/booking-notifications";
import { hasOverlap, rangeToMinutes } from "@/lib/diary-rules";
import { memberShowsOnDiary } from "@/lib/show-on-diary";

export type NailGuestBookingInput = {
  salonId: string;
  serviceId?: string;
  technicianId?: string;
  startTime: string;
  endTime: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
};

export type NailGuestBookingResult =
  | { error: string; confirmationEmailError?: string }
  | { error: null; appointmentId: string; confirmationEmailError?: string };

/** Public guest booking for nail salons (online booking form). */
export async function executeNailGuestBooking(
  data: NailGuestBookingInput
): Promise<NailGuestBookingResult> {
  const supabase = createAdminClient();
  const { data: salon } = await supabase
    .from("nail_salons")
    .select("id, name")
    .eq("id", data.salonId)
    .single();
  if (!salon) return { error: "Salon not found" };

  let technicianId = data.technicianId;
  if (!technicianId) {
    const { data: candidates } = await supabase
      .from("nail_members")
      .select("id, show_on_diary")
      .eq("salon_id", data.salonId)
      .eq("is_active", true)
      .order("role", { ascending: false });
    const first = (candidates ?? []).find((m) =>
      memberShowsOnDiary(m as { show_on_diary?: boolean | null })
    );
    if (!first) return { error: "No technicians available" };
    technicianId = first.id;
  } else {
    const { data: member } = await supabase
      .from("nail_members")
      .select("id, show_on_diary")
      .eq("id", technicianId)
      .eq("salon_id", data.salonId)
      .eq("is_active", true)
      .maybeSingle();
    if (!member || !memberShowsOnDiary(member as { show_on_diary?: boolean | null })) {
      return { error: "Invalid technician" };
    }
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
    .from("nail_appointments")
    .select("start_time, end_time")
    .eq("salon_id", data.salonId)
    .eq("technician_id", technicianId)
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
    .from("nail_appointments")
    .insert({
      salon_id: data.salonId,
      technician_id: technicianId,
      service_id: data.serviceId || null,
      start_time: data.startTime,
      end_time: data.endTime,
      guest_name: data.guestName,
      guest_email: data.guestEmail,
      guest_phone: data.guestPhone || null,
      status: "scheduled",
      source: "booking",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  const appointmentId = appointment?.id as string;

  if (data.serviceId) {
    await supabase.from("nail_appointment_services").insert({
      appointment_id: appointmentId,
      service_id: data.serviceId,
      sort_order: 0,
    });
  }

  let serviceName: string | null = null;
  if (data.serviceId) {
    const { data: svc } = await supabase
      .from("nail_services")
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

  return { error: null, appointmentId, confirmationEmailError: emailError };
}
