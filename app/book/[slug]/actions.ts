"use server";

import { executeGuestBooking } from "@/lib/appointments/create-guest-appointment";

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
  return executeGuestBooking({
    salonId,
    ...data,
  });
}
