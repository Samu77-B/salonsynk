import { sendBookingConfirmation } from "./email";
import { canSendSms, canSendWhatsApp, sendSms, sendWhatsApp } from "./sms";
import { formatSalonDateLabel, formatSalonTimeLabel } from "@/lib/ai/salon-time";

/**
 * Notify the client that their booking is confirmed.
 * Email is sent when present. SMS/WhatsApp is sent when there is no email,
 * or when `alsoSms` is true (salon requires text confirmations).
 * Failures are non-fatal (logged only) so booking creation still succeeds.
 */
export async function sendClientBookingConfirmation(params: {
  email: string | null | undefined;
  phone: string | null | undefined;
  salonName: string;
  start: Date;
  serviceName?: string | null;
  alsoSms?: boolean;
}): Promise<{ emailError?: string; smsSent?: boolean }> {
  const email = params.email?.trim() || null;
  const phone = params.phone?.trim() || null;
  if (!email && !phone) return {};

  const date = formatSalonDateLabel(params.start);
  const time = formatSalonTimeLabel(params.start);
  const smsBody = `Your appointment at ${params.salonName} is confirmed for ${date} at ${time}.`;

  let emailError: string | undefined;
  let smsSent = false;

  if (email) {
    const { error } = await sendBookingConfirmation(email, {
      date,
      time,
      salonName: params.salonName,
      serviceName: params.serviceName || undefined,
    });
    if (error) {
      console.warn("[booking-notifications] confirmation email:", error);
      emailError = error;
    }
  }

  const shouldText = Boolean(phone && (params.alsoSms || !email));
  if (shouldText && phone) {
    if (canSendWhatsApp()) {
      const { error } = await sendWhatsApp(phone, smsBody);
      if (!error) smsSent = true;
      else console.warn("[booking-notifications] confirmation WhatsApp:", error);
    }
    if (!smsSent && canSendSms()) {
      const { error } = await sendSms(phone, smsBody);
      if (!error) smsSent = true;
      else console.warn("[booking-notifications] confirmation SMS:", error);
    }
  }

  return { emailError, smsSent };
}
