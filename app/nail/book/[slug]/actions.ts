"use server";

import { executeNailGuestBooking } from "@modules/nail/lib/appointments/create-guest-appointment";

export async function createNailGuestBooking(
  salonId: string,
  data: {
    serviceId?: string;
    technicianId?: string;
    startTime: string;
    endTime: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
  }
) {
  return executeNailGuestBooking({
    salonId,
    ...data,
  });
}
