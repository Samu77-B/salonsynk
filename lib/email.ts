import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const fromAddress =
  process.env.RESEND_FROM_ADDRESS || "SalonSynk <noreply@salonsynk.com>";

function normalizeResendError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const anyErr = error as { message?: string; name?: string };
    return anyErr.message || anyErr.name || "Email error";
  }
  return String(error);
}

export async function sendAppointmentReminder(
  to: string,
  details: { clientName?: string; date: string; time: string; salonName: string }
): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: "Appointment reminder: " + details.salonName,
    html: `<p>Reminder: appointment on ${details.date} at ${details.time}.</p>`,
  });
  return { error: normalizeResendError(error) };
}

export async function sendReceipt(
  to: string,
  amount: string,
  items: string
): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: "Your receipt",
    html: `<p>Thank you. Amount: ${amount}. Items: ${items}</p>`,
  });
  return { error: normalizeResendError(error) };
}

export async function sendBookingConfirmation(
  to: string,
  details: { date: string; time: string; salonName: string; serviceName?: string },
  manageLink?: string
): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  let html = `<p>Your appointment is confirmed for ${details.date} at ${details.time}.</p>`;
  if (manageLink) html += `<p><a href="${manageLink}">Manage booking</a></p>`;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: "Booking confirmed: " + details.salonName,
    html,
  });
  return { error: normalizeResendError(error) };
}

export async function sendOwnerInviteLink(
  to: string,
  inviteLink: string,
  salonName: string
): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const html = `
    <p>You've been invited to manage <strong>${salonName}</strong> on SalonSynk.</p>
    <p><a href="${inviteLink}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:0;font-weight:600;">Accept the invite</a></p>
    <p>This link lets you set your password and log in. If you didn't expect this, you can ignore this email.</p>
  `;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: `You're invited to manage ${salonName} on SalonSynk`,
    html,
  });
  return { error: normalizeResendError(error) };
}

export async function sendSupportMessage(
  fromEmail: string,
  salonName: string,
  subject: string,
  message: string
): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const to = "hello@salonsynk.com";
  const html = `
    <p><strong>From:</strong> ${fromEmail || "(not provided)"}</p>
    <p><strong>Salon:</strong> ${salonName}</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <hr />
    <p>${message.replace(/\n/g, "<br />")}</p>
  `;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    replyTo: fromEmail || undefined,
    subject: `[SalonSynk Support] ${subject}`,
    html,
  });
  return { error: normalizeResendError(error) };
}

export async function sendAccountRequest(params: {
  fullName: string;
  email: string;
  salonName: string;
  phone?: string;
  message?: string;
}): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const to = "hello@salonsynk.com";
  const phoneLine = params.phone?.trim()
    ? `<p><strong>Phone:</strong> ${params.phone.trim()}</p>`
    : "";
  const msgBlock = params.message?.trim()
    ? `<hr /><p><strong>Message:</strong></p><p>${params.message.trim().replace(/\n/g, "<br />")}</p>`
    : "";
  const html = `
    <p><strong>New account request</strong> (SalonSynk)</p>
    <p><strong>Name:</strong> ${params.fullName.trim()}</p>
    <p><strong>Email:</strong> ${params.email.trim()}</p>
    <p><strong>Salon / business:</strong> ${params.salonName.trim()}</p>
    ${phoneLine}
    ${msgBlock}
  `;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    replyTo: params.email.trim(),
    subject: `[SalonSynk] Account request: ${params.salonName.trim().slice(0, 80)}`,
    html,
  });
  return { error: normalizeResendError(error) };
}

export async function sendAftercareEmail(
  to: string,
  message: string,
  salonName: string
): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const html = `<p>${message.replace(/\n/g, "<br />")}</p>`;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: `Aftercare from ${salonName}`,
    html,
  });
  return { error: normalizeResendError(error) };
}

export async function sendReviewRequest(
  to: string,
  details: { clientName?: string; salonName: string; reviewUrl?: string }
): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const name = details.clientName ? ` ${details.clientName}` : "";
  let html = `<p>Hi${name},</p><p>Thank you for visiting ${details.salonName}. We’d love to hear how your appointment went.</p>`;
  if (details.reviewUrl) {
    html += `<p><a href="${details.reviewUrl}">Leave a review</a></p>`;
  } else {
    html += `<p>Please take a moment to leave us a review – it really helps.</p>`;
  }
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: `How was your visit to ${details.salonName}?`,
    html,
  });
  return { error: normalizeResendError(error) };
}

export async function sendMarketingEmail(params: {
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl: string;
}): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const footer = `<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" /><p style="font-size:12px;color:#666">You received this because you opted in at your salon. <a href="${params.unsubscribeUrl}">Unsubscribe from marketing</a></p>`;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [params.to],
    subject: params.subject,
    html: params.html + footer,
  });
  return { error: normalizeResendError(error) };
}

export async function sendWeMissYouEmail(
  to: string,
  details: { clientName?: string; salonName: string; bookUrl?: string; discountCode?: string }
): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const name = details.clientName ? ` ${details.clientName}` : "";
  let html = `<p>Hi${name},</p><p>We miss you at ${details.salonName}! It's been a while since we've seen you.</p>`;
  if (details.bookUrl) {
    html += `<p><a href="${details.bookUrl}">Book your next visit</a></p>`;
  }
  if (details.discountCode) {
    html += `<p>Use code <strong>${details.discountCode}</strong> for a discount.</p>`;
  }
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: `We miss you at ${details.salonName}`,
    html,
  });
  return { error: normalizeResendError(error) };
}
