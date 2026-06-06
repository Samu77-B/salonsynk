/**
 * SMS and WhatsApp via Twilio.
 * Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER for SMS.
 * Optional: TWILIO_WHATSAPP_NUMBER (e.g. whatsapp:+14155238886 for sandbox) for WhatsApp.
 */

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;

/** Ensure E.164: digits only; leading 0 treated as UK (44). */
function toE164(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "44" + d.slice(1);
  return "+" + d;
}

export function canSendSms(): boolean {
  return !!(accountSid && authToken && fromNumber);
}

export function canSendWhatsApp(): boolean {
  return !!(accountSid && authToken && whatsappFrom);
}

export async function sendSms(toPhone: string, body: string): Promise<{ error?: string }> {
  if (!accountSid || !authToken || !fromNumber)
    return { error: "Twilio not configured for SMS" };
  try {
    const twilio = await import("twilio");
    const client = twilio.default(accountSid, authToken);
    await client.messages.create({
      body,
      from: fromNumber,
      to: toE164(toPhone),
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendWhatsApp(toPhone: string, body: string): Promise<{ error?: string }> {
  if (!accountSid || !authToken || !whatsappFrom)
    return { error: "Twilio not configured for WhatsApp" };
  try {
    const twilio = await import("twilio");
    const client = twilio.default(accountSid, authToken);
    await client.messages.create({
      body,
      from: whatsappFrom.startsWith("whatsapp:") ? whatsappFrom : `whatsapp:${whatsappFrom}`,
      to: `whatsapp:${toE164(toPhone)}`,
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
