import { canSendSms, sendSms } from "@core/utils/sms";
import { queueSmsBody, type QueueSmsTemplate } from "./queue-sms-messages";

export { queueSmsBody, phoneHref, queueJoinedSmsBody, bookingConfirmationSmsBody, estimatedWaitMinutes, AVG_SERVICE_MINUTES, type QueueSmsTemplate } from "./queue-sms-messages";

export async function sendBarberQueueSms(
  phone: string,
  body: string
): Promise<{ error?: string; sent: boolean }> {
  if (!phone.trim()) return { error: "No phone number", sent: false };
  if (!canSendSms()) return { error: "SMS not configured (Twilio)", sent: false };
  const result = await sendSms(phone, body);
  if (result.error) return { error: result.error, sent: false };
  return { sent: true };
}
