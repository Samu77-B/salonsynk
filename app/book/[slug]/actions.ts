"use server";

import { headers } from "next/headers";
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
    returningColourClient?: boolean;
    patchTestChoice?: "will_test" | "decline";
    waiver?: { agreed: boolean; signerName: string; signatureData?: string | null };
    joinClub?: boolean;
  }
) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  return executeGuestBooking({
    salonId,
    ...data,
    requestMeta: { ip, userAgent: h.get("user-agent") },
  });
}
