export type QueueSmsTemplate = "next" | "ready" | "running_late";

export function queueSmsBody(
  template: QueueSmsTemplate,
  opts: { clientName: string; shopName: string; customMessage?: string }
): string {
  const name = opts.clientName.trim() || "there";
  const shop = opts.shopName.trim() || "the barber shop";

  switch (template) {
    case "next":
      return `Hi ${name}, you're next at ${shop}. Please head over — we'll call you when your chair is ready.`;
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
