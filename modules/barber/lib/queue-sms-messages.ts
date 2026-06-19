export const AVG_SERVICE_MINUTES = 20;

export type QueueSmsTemplate = "next" | "almost_next" | "ready" | "running_late";

export function estimatedWaitMinutes(position: number): number {
  return Math.max(0, (position - 1) * AVG_SERVICE_MINUTES);
}

/** SMS sent immediately when a customer joins the queue. */
export function queueJoinedSmsBody(opts: {
  clientName: string;
  shopName: string;
  position: number;
}): string {
  const name = opts.clientName.trim() || "there";
  const shop = opts.shopName.trim() || "the barber shop";
  const position = opts.position;

  if (position <= 1) {
    return `Hi ${name}, you're #1 in the queue at ${shop}. You'll be up next — please stay nearby.`;
  }

  if (position === 2) {
    return `Hi ${name}, you're #2 in the queue at ${shop}. Around 20 minutes until it's your turn.`;
  }

  const wait = estimatedWaitMinutes(position);
  return `Hi ${name}, you're #${position} in the queue at ${shop}. Around ${wait} minutes until it's your turn.`;
}

export function queueSmsBody(
  template: QueueSmsTemplate,
  opts: { clientName: string; shopName: string; customMessage?: string }
): string {
  const name = opts.clientName.trim() || "there";
  const shop = opts.shopName.trim() || "the barber shop";

  switch (template) {
    case "next":
      return `Hi ${name}, you'll be up next at ${shop}. Please head over — we'll call you when your chair is ready.`;
    case "almost_next":
      return `Hi ${name}, you're now 2nd in the queue at ${shop}. Around 20 minutes until it's your turn — please stay nearby.`;
    case "ready":
      return `Hi ${name}, your barber is ready for you at ${shop}. Please take a seat now.`;
    case "running_late":
      return opts.customMessage?.trim()
        ? opts.customMessage.trim()
        : `Hi ${name}, we're running a little behind at ${shop}. Thanks for your patience — we'll be with you shortly.`;
    default:
      return `Hi ${name}, message from ${shop}.`;
  }
}

export function phoneHref(phone: string, smsBody?: string): { tel: string; sms: string } {
  const cleaned = phone.replace(/\s/g, "");
  const tel = cleaned.startsWith("+") ? cleaned : cleaned.replace(/^0/, "+44");
  const sms = smsBody
    ? `sms:${tel}?body=${encodeURIComponent(smsBody)}`
    : `sms:${tel}`;
  return { tel: `tel:${tel}`, sms };
}
