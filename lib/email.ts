import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

/** From address. Use a verified domain (e.g. noreply@salonsynk.com) to send to any recipient. onboarding@resend.dev only allows your own email. */
const fromAddress =
  process.env.RESEND_FROM_ADDRESS || "SalonSynk <onboarding@resend.dev>";

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
    <p><a href="${inviteLink}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">Accept the invite</a></p>
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
