import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

export async function sendAppointmentReminder(
  to: string,
  details: { clientName?: string; date: string; time: string; salonName: string }
) {
  if (!resend) return { error: "Resend not configured" };
  const { error } = await resend.emails.send({
    from: "salonbooking@urnextevent.com>",
    to: [to],
    subject: "Appointment reminder: " + details.salonName,
    html: `<p>Reminder: appointment on ${details.date} at ${details.time}.</p>`,
  });
  return { error };
}

export async function sendReceipt(to: string, amount: string, items: string) {
  if (!resend) return { error: "Resend not configured" };
  const { error } = await resend.emails.send({
    from: "SalonSynk <onboarding@resend.dev>",
    to: [to],
    subject: "Your receipt",
    html: `<p>Thank you. Amount: ${amount}. Items: ${items}</p>`,
  });
  return { error };
}

export async function sendBookingConfirmation(
  to: string,
  details: { date: string; time: string; salonName: string; serviceName?: string },
  manageLink?: string
) {
  if (!resend) return { error: "Resend not configured" };
  let html = `<p>Your appointment is confirmed for ${details.date} at ${details.time}.</p>`;
  if (manageLink) html += `<p><a href="${manageLink}">Manage booking</a></p>`;
  const { error } = await resend.emails.send({
    from: "SalonSynk <onboarding@resend.dev>",
    to: [to],
    subject: "Booking confirmed: " + details.salonName,
    html,
  });
  return { error };
}
