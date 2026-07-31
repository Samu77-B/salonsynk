import { canSendSms, sendSms } from "@core/utils/sms";

export {
  queueSmsBody,
  phoneHref,
  queueJoinedSmsBody,
  estimatedWaitMinutes,
  AVG_SERVICE_MINUTES,
  type QueueSmsTemplate,
} from "@modules/barber/lib/queue-sms-messages";

export async function sendSalonQueueSms(
  phone: string,
  body: string
): Promise<{ error?: string; sent: boolean }> {
  if (!phone.trim()) return { error: "No phone number", sent: false };
  if (!canSendSms()) return { error: "SMS not configured (Twilio)", sent: false };
  const result = await sendSms(phone, body);
  if (result.error) return { error: result.error, sent: false };
  return { sent: true };
}
