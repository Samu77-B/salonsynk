"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingConfirmation } from "@/lib/email";

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
  }
) {
  const supabase = createAdminClient();
  const { data: salon } = await supabase.from("salons").select("id, name").eq("id", salonId).single();
  if (!salon) return { error: "Salon not found" };

  if (!data.stylistId) {
    const { data: first } = await supabase
      .from("salon_members")
      .select("id")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .limit(1)
      .single();
    if (!first) return { error: "No stylists available" };
    data.stylistId = first.id;
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
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const start = new Date(data.startTime);
  await sendBookingConfirmation(data.guestEmail, {
    date: start.toLocaleDateString("en-GB"),
    time: start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    salonName: salon.name,
  });

  return { error: null };
}
