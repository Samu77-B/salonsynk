"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendClientBookingConfirmation } from "@/lib/booking-notifications";
import { hasOverlap, rangeToMinutes } from "@/lib/diary-rules";
import { memberShowsOnDiary } from "@/lib/show-on-diary";

export async function createGuestBooking(
  salonId: string,
  data: {
    serviceId?: string;
    stylistId?: string;
    startTime: string;
    endTime: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    silentService?: boolean;
  }
) {
  const supabase = createAdminClient();
  const { data: salon } = await supabase.from("salons").select("id, name").eq("id", salonId).single();
  if (!salon) return { error: "Salon not found" };

  if (!data.stylistId) {
    const { data: candidates } = await supabase
      .from("salon_members")
      .select("id, show_on_diary")
      .eq("salon_id", salonId)
      .eq("is_active", true);
    const first = (candidates ?? []).find((m: { show_on_diary?: boolean | null }) => memberShowsOnDiary(m));
    if (!first) return { error: "No stylists available" };
    data.stylistId = first.id;
  } else {
    const { data: sm } = await supabase
      .from("salon_members")
      .select("id, show_on_diary")
      .eq("id", data.stylistId)
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .maybeSingle();
    if (!sm || !memberShowsOnDiary(sm as { show_on_diary?: boolean | null }))
      return { error: "Invalid stylist" };
  }

  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data: existing } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .eq("salon_id", salonId)
    .eq("stylist_id", data.stylistId)
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
      salon_id: salonId,
      stylist_id: data.stylistId,
      service_id: data.serviceId || null,
      start_time: data.startTime,
      end_time: data.endTime,
      guest_name: data.guestName,
      guest_email: data.guestEmail,
      guest_phone: data.guestPhone || null,
      status: "scheduled",
      silent_service: data.silentService ?? false,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  let serviceName: string | null = null;
  if (data.serviceId) {
    const { data: svc } = await supabase
      .from("services")
      .select("name")
      .eq("id", data.serviceId)
      .eq("salon_id", salonId)
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

  return { error: null, confirmationEmailError: emailError };
}
