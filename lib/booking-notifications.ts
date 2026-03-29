import { sendBookingConfirmation } from "./email";
import { canSendSms, canSendWhatsApp, sendSms, sendWhatsApp } from "./sms";

/**
 * Notify the client that their booking is confirmed.
 * Prefers email when present; otherwise SMS/WhatsApp if Twilio is configured.
 * Failures are non-fatal (logged only) so booking creation still succeeds.
 */
export async function sendClientBookingConfirmation(params: {
  email: string | null | undefined;
  phone: string | null | undefined;
  salonName: string;
  start: Date;
  serviceName?: string | null;
}): Promise<void> {
  const email = params.email?.trim() || null;
  const phone = params.phone?.trim() || null;
  if (!email && !phone) return;

  const date = params.start.toLocaleDateString("en-GB");
  const time = params.start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const smsBody = `Your appointment at ${params.salonName} is confirmed for ${date} at ${time}.`;

  if (email) {
    const { error } = await sendBookingConfirmation(email, {
      date,
      time,
      salonName: params.salonName,
      serviceName: params.serviceName || undefined,
    });
    if (error) console.warn("[booking-notifications] confirmation email:", error);
    return;
  }

  if (phone) {
    if (canSendWhatsApp()) {
      const { error } = await sendWhatsApp(phone, smsBody);
      if (!error) return;
      console.warn("[booking-notifications] confirmation WhatsApp:", error);
    }
    if (canSendSms()) {
      const { error } = await sendSms(phone, smsBody);
      if (error) console.warn("[booking-notifications] confirmation SMS:", error);
    }
  }
}
