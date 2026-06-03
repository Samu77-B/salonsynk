import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const fromAddress =
  process.env.RESEND_FROM_ADDRESS || "SalonSynk <hello@salonsynk.com>";

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
  planTier?: string;
  planLabel?: string;
  planPrice?: string;
  paymentGateway?: string;
  paymentGatewayLabel?: string;
}): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const to = "hello@salonsynk.com";
  const phoneLine = params.phone?.trim()
    ? `<p><strong>Phone:</strong> ${params.phone.trim()}</p>`
    : "";
  const msgBlock = params.message?.trim()
    ? `<hr /><p><strong>Message:</strong></p><p>${params.message.trim().replace(/\n/g, "<br />")}</p>`
    : "";
  const planLine =
    params.planLabel && params.planPrice
      ? `<p><strong>Requested plan:</strong> ${params.planLabel} (${params.planPrice})${params.planTier ? ` — <code>${params.planTier}</code>` : ""}</p>`
      : "";
  const gatewayLine = params.paymentGatewayLabel
    ? `<p><strong>Card payments:</strong> ${params.paymentGatewayLabel}${params.paymentGateway ? ` — <code>${params.paymentGateway}</code>` : ""}</p>`
    : "";
  const html = `
    <p><strong>New account request</strong> (SalonSynk)</p>
    <p><strong>Name:</strong> ${params.fullName.trim()}</p>
    <p><strong>Email:</strong> ${params.email.trim()}</p>
    <p><strong>Salon / business:</strong> ${params.salonName.trim()}</p>
    ${planLine}
    ${gatewayLine}
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

function escapeHtmlPlainText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Invisible inbox preview line (Mailchimp-style preheader), plain text only. */
function marketingPreheaderHtml(preheader: string): string {
  const t = preheader.trim();
  if (!t) return "";
  const safe = escapeHtmlPlainText(t);
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${safe}</div>`;
}

export async function sendMarketingEmail(params: {
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl: string;
  /** Optional inbox preview line after the subject (plain text). */
  preheader?: string | null;
}): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const footer = `<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" /><p style="font-size:12px;color:#666">You received this because you opted in at your salon. <a href="${params.unsubscribeUrl}">Unsubscribe from marketing</a></p>`;
  const pre = marketingPreheaderHtml(params.preheader ?? "");
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [params.to],
    subject: params.subject,
    html: pre + params.html + footer,
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

function onboardingEmailButton(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">${label}</a></p>`;
}

/** Welcome email when master admin completes onboarding setup — login + pay links. */
export async function sendSalonWelcomeEmail(params: {
  to: string;
  ownerName: string;
  salonName: string;
  planLabel: string;
  planPrice: string;
  loginLink: string;
  paymentLink: string;
}): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const html = `
    <p>Hi ${escapeHtmlPlainText(params.ownerName)},</p>
    <p>Welcome to <strong>SalonSynk</strong> — your account for <strong>${escapeHtmlPlainText(params.salonName)}</strong> is ready.</p>
    <p>You chose the <strong>${escapeHtmlPlainText(params.planLabel)}</strong> plan (${escapeHtmlPlainText(params.planPrice)}). Complete these two steps to get started:</p>
    <ol>
      <li><strong>Set your password</strong> and create your login</li>
      <li><strong>Pay for your first month</strong> — your subscription renews monthly after that</li>
    </ol>
    ${onboardingEmailButton(params.loginLink, "Set password & log in")}
    ${onboardingEmailButton(params.paymentLink, `Pay ${params.planPrice} — first month`)}
    <p style="color:#666;font-size:14px;">You can pay before or after setting your password. Dashboard access opens once payment is complete.</p>
    <p style="color:#666;font-size:14px;">Questions? Reply to this email or contact <a href="mailto:hello@salonsynk.com">hello@salonsynk.com</a>.</p>
  `;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [params.to],
    replyTo: "hello@salonsynk.com",
    subject: `Welcome to SalonSynk — ${params.salonName}`,
    html,
  });
  return { error: normalizeResendError(error) };
}

/** Sent after first successful subscription payment. */
export async function sendSalonSetupGuideEmail(params: {
  to: string;
  ownerName: string;
  salonName: string;
  dashboardLink: string;
  setupHelpLink: string;
}): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const html = `
    <p>Hi ${escapeHtmlPlainText(params.ownerName)},</p>
    <p><strong>Congratulations!</strong> Your payment for <strong>${escapeHtmlPlainText(params.salonName)}</strong> is confirmed. Your SalonSynk dashboard is now open.</p>
    ${onboardingEmailButton(params.dashboardLink, "Open your dashboard")}
    <h2 style="font-size:18px;margin-top:28px;">Getting started — step by step</h2>
    <ol>
      <li><strong>Branding</strong> — upload your logo and set your brand colour in Settings</li>
      <li><strong>Services</strong> — add your service menu and prices</li>
      <li><strong>Team</strong> — invite stylists or create front-desk logins</li>
      <li><strong>Stripe Connect</strong> — connect payouts for in-salon payments (Professional & Complete plans)</li>
      <li><strong>Go live</strong> — share your booking link with clients</li>
    </ol>
    <h2 style="font-size:18px;margin-top:28px;">Want us to set it up for you?</h2>
    <p>Our team can configure staff, services, products, and price lists for you.</p>
    <ul>
      <li><strong>From £60</strong> when you have price lists and details ready</li>
      <li><strong>From £120</strong> if we need to help gather or format your menus</li>
    </ul>
    ${onboardingEmailButton(params.setupHelpLink, "Request setup help")}
    <p style="color:#666;font-size:14px;">We’ll confirm the exact price before any work begins.</p>
  `;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [params.to],
    replyTo: "hello@salonsynk.com",
    subject: `You're in! Set up ${params.salonName} on SalonSynk`,
    html,
  });
  return { error: normalizeResendError(error) };
}

/** Owner requests concierge setup after subscribing. */
export async function sendSetupConciergeRequest(params: {
  ownerName: string;
  ownerEmail: string;
  salonName: string;
  hasPriceLists: boolean;
  helpAreas: string[];
  notes?: string;
}): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured" };
  const to = "hello@salonsynk.com";
  const areas = params.helpAreas.length ? params.helpAreas.join(", ") : "General setup";
  const priceHint = params.hasPriceLists
    ? "Client indicated they have price lists ready — quote from £60"
    : "Client may need help preparing menus — quote from £120";
  const notesBlock = params.notes?.trim()
    ? `<p><strong>Notes:</strong></p><p>${params.notes.trim().replace(/\n/g, "<br />")}</p>`
    : "";
  const html = `
    <p><strong>Salon setup concierge request</strong></p>
    <p><strong>Salon:</strong> ${escapeHtmlPlainText(params.salonName)}</p>
    <p><strong>Owner:</strong> ${escapeHtmlPlainText(params.ownerName)} (${escapeHtmlPlainText(params.ownerEmail)})</p>
    <p><strong>Help needed with:</strong> ${escapeHtmlPlainText(areas)}</p>
    <p><strong>Price lists prepared:</strong> ${params.hasPriceLists ? "Yes" : "No / not sure"}</p>
    <p><strong>Pricing guide:</strong> ${priceHint}</p>
    ${notesBlock}
  `;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    replyTo: params.ownerEmail,
    subject: `[SalonSynk] Setup help request: ${params.salonName.slice(0, 80)}`,
    html,
  });
  return { error: normalizeResendError(error) };
}
