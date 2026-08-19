import { Resend } from "resend";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";
import { SITE } from "@core/config/site";
import { LEADS_INBOX } from "@core/config/support";
import { resolveProductFromHost } from "@/lib/platform-host";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const fromAddress =
  process.env.RESEND_FROM_ADDRESS || "SalonSynk <hello@salonsynk.com>";

function platformFromAddress(platform: "salon" | "barber" | "nail"): string {
  if (platform === "barber") {
    return process.env.RESEND_FROM_BARBER || `BarberSynk <${BARBER_SITE.email}>`;
  }
  if (platform === "nail") {
    return process.env.RESEND_FROM_NAIL || `NailSynk <${NAIL_SITE.email}>`;
  }
  return fromAddress;
}

function normalizeResendError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const anyErr = error as { message?: string; name?: string };
    return anyErr.message || anyErr.name || "Email error";
  }
  return String(error);
}

async function sendViaResend(
  payload: Parameters<NonNullable<typeof resend>["emails"]["send"]>[0]
): Promise<{ error?: string }> {
  if (!resend) return { error: "Resend not configured (RESEND_API_KEY missing)" };
  const { data, error } = await resend.emails.send(payload);
  const normalized = normalizeResendError(error);
  if (normalized) return { error: normalized };
  if (!data?.id) return { error: "Email provider did not accept the message." };
  return {};
}

export type LeadPlatform = "salon" | "barber" | "nail";

const LEAD_PLATFORM_LABEL: Record<LeadPlatform, string> = {
  salon: "SalonSynk",
  barber: "BarberSynk",
  nail: "NailSynk",
};

function platformBrand(platform: LeadPlatform): {
  label: string;
  email: string;
  url: string;
  tagline: string;
  logoUrl: string;
  from: string;
} {
  if (platform === "barber") {
    return {
      label: BARBER_SITE.name,
      email: BARBER_SITE.email,
      url: BARBER_SITE.url,
      tagline: BARBER_SITE.tagline,
      logoUrl: `${BARBER_SITE.url}/imgs/barber/barbersynk-logo-v5.png`,
      from: process.env.RESEND_FROM_BARBER || `BarberSynk <${BARBER_SITE.email}>`,
    };
  }
  if (platform === "nail") {
    return {
      label: NAIL_SITE.name,
      email: NAIL_SITE.email,
      url: NAIL_SITE.url,
      tagline: NAIL_SITE.tagline,
      logoUrl: `${NAIL_SITE.url}/imgs/nail/nailsynk_logo_blk.png`,
      from: process.env.RESEND_FROM_NAIL || `NailSynk <${NAIL_SITE.email}>`,
    };
  }
  return {
    label: SITE.name,
    email: SITE.email,
    url: SITE.url,
    tagline: SITE.tagline,
    logoUrl: `${SITE.url}/imgs/salon/salonsynk-footer-logo-v2.png`,
    from: process.env.RESEND_FROM_HELLO || `SalonSynk <${SITE.email}>`,
  };
}

function platformEmailSignature(platform: LeadPlatform): string {
  const brand = platformBrand(platform);
  return `
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0 16px" />
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <tr>
        <td style="padding:0 0 12px">
          <a href="${brand.url}" style="text-decoration:none">
            <img src="${brand.logoUrl}" alt="${escapeHtmlPlainText(brand.label)}" width="200" style="display:block;border:0;outline:none;max-width:200px;height:auto" />
          </a>
        </td>
      </tr>
      <tr>
        <td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#555555">
          ${escapeHtmlPlainText(brand.tagline)}<br />
          <a href="mailto:${brand.email}" style="color:#555555">${brand.email}</a>
        </td>
      </tr>
    </table>
  `;
}

type LeadMailPayload = {
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
};

/** Staff notification: hello@salonsynk.com, then a separate copy to hello@smartsynk.net. */
async function sendLeadStaffEmails(payload: LeadMailPayload): Promise<{ error?: string }> {
  const primary = await sendViaResend({ ...payload, to: [SITE.email] });
  if (primary.error) return primary;
  if (LEADS_INBOX.trim().toLowerCase() !== SITE.email.trim().toLowerCase()) {
    const copy = await sendViaResend({ ...payload, to: [LEADS_INBOX] });
    if (copy.error) {
      console.error("[leads] SmartSynk copy failed:", copy.error);
    }
  }
  return {};
}

async function sendContactAutoReply(params: {
  to: string;
  name?: string;
  platform: LeadPlatform;
  kind: "account" | "support" | "setup";
  businessName?: string;
}): Promise<void> {
  const email = params.to.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  const brand = platformBrand(params.platform);
  const first = (params.name ?? "").trim().split(/\s+/)[0];
  const greeting = first ? `Hi ${escapeHtmlPlainText(first)},` : "Hi,";
  const business = params.businessName?.trim()
    ? ` for <strong>${escapeHtmlPlainText(params.businessName.trim())}</strong>`
    : "";
  const what =
    params.kind === "account"
      ? `We've received your ${brand.label} account request${business}.`
      : params.kind === "setup"
        ? `We've received your setup help request${business}.`
        : "We've received your message.";
  const html = `
    <p>${greeting}</p>
    <p>Thanks for getting in touch with <strong>${brand.label}</strong>.</p>
    <p>${what} We'll be in contact within 24 hours.</p>
    <p>If you need to add anything, just reply to this email.</p>
    ${platformEmailSignature(params.platform)}
  `;
  const mail = {
    to: [email] as string[],
    replyTo: brand.email,
    subject: `We've received your ${brand.label} request`,
    html,
  };
  const branded = await sendViaResend({ ...mail, from: brand.from });
  if (branded.error) {
    await sendViaResend({ ...mail, from: `${brand.label} <${SITE.email}>` });
  }
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

export function resolveLeadPlatform(input: {
  platform?: string;
  planTier?: string;
  message?: string;
  host?: string;
  referer?: string;
}): LeadPlatform {
  const p = (input.platform ?? "").trim().toLowerCase();
  if (p === "barber" || p === "nail" || p === "salon") return p;

  const host = (input.host ?? "").split(",")[0]?.trim() ?? "";
  if (host) {
    const fromHost = resolveProductFromHost(host);
    if (fromHost === "barber" || fromHost === "nail") return fromHost;
  }

  const referer = input.referer ?? "";
  if (referer) {
    try {
      const fromRef = resolveProductFromHost(new URL(referer).hostname);
      if (fromRef === "barber" || fromRef === "nail") return fromRef;
    } catch {
      /* ignore invalid referer */
    }
    if (referer.includes("/barber")) return "barber";
    if (referer.includes("/nail")) return "nail";
  }

  const tier = (input.planTier ?? "").trim().toLowerCase();
  if (tier === "barber") return "barber";
  if (tier === "nail") return "nail";
  const msg = input.message ?? "";
  if (msg.includes("[BarberSynk]")) return "barber";
  if (msg.includes("[NailSynk]")) return "nail";
  return "salon";
}

export async function sendSupportMessage(
  fromEmail: string,
  salonName: string,
  subject: string,
  message: string,
  platform: LeadPlatform = "salon"
): Promise<{ error?: string }> {
  const label = LEAD_PLATFORM_LABEL[platform];
  const html = `
    <p><strong>From:</strong> ${fromEmail || "(not provided)"}</p>
    <p><strong>Salon:</strong> ${salonName}</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <hr />
    <p>${message.replace(/\n/g, "<br />")}</p>
  `;
  const result = await sendLeadStaffEmails({
    from: fromAddress,
    replyTo: fromEmail || undefined,
    subject: `[${label} Support] ${subject}`,
    html,
  });
  if (result.error) return result;
  if (fromEmail) {
    await sendContactAutoReply({
      to: fromEmail,
      platform,
      kind: "support",
      businessName: salonName,
    });
  }
  return {};
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
  platform?: LeadPlatform;
}): Promise<{ error?: string }> {
  const platform = resolveLeadPlatform(params);
  const label = LEAD_PLATFORM_LABEL[platform];
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
    <p><strong>New account request</strong> (${label})</p>
    <p><strong>Name:</strong> ${params.fullName.trim()}</p>
    <p><strong>Email:</strong> ${params.email.trim()}</p>
    <p><strong>Salon / business:</strong> ${params.salonName.trim()}</p>
    ${planLine}
    ${gatewayLine}
    ${phoneLine}
    ${msgBlock}
  `;
  const result = await sendLeadStaffEmails({
    from: fromAddress,
    replyTo: params.email.trim(),
    subject: `[${label}] Account request: ${params.salonName.trim().slice(0, 80)}`,
    html,
  });
  if (result.error) return result;
  await sendContactAutoReply({
    to: params.email,
    name: params.fullName,
    platform,
    kind: "account",
    businessName: params.salonName,
  });
  return {};
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
    <p>You chose the <strong>${escapeHtmlPlainText(params.planLabel)}</strong> plan (${escapeHtmlPlainText(params.planPrice)} after your free month). Here&apos;s how to get started:</p>
    <ol>
      <li><strong>Set your password</strong> and log in — your dashboard is open for the first <strong>30 days free</strong></li>
      <li><strong>Add payment details</strong> (optional now) — we&apos;ll only charge after your free month ends</li>
    </ol>
    ${onboardingEmailButton(params.loginLink, "Set password & log in")}
    ${onboardingEmailButton(params.paymentLink, "Add payment details — first month free")}
    <p style="color:#666;font-size:14px;">Your dashboard opens as soon as you set your password. No payment is required today.</p>
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

/** Welcome email when master admin onboards a BarberSynk shop. */
export async function sendBarberWelcomeEmail(params: {
  to: string;
  ownerName: string;
  businessName: string;
  planPrice: string;
  loginLink: string;
  paymentLink: string;
}): Promise<{ error?: string }> {
  const html = `
    <p>Hi ${escapeHtmlPlainText(params.ownerName)},</p>
    <p>Welcome to <strong>BarberSynk</strong> — your account for <strong>${escapeHtmlPlainText(params.businessName)}</strong> is ready.</p>
    <p>Your plan is <strong>${escapeHtmlPlainText(params.planPrice)}</strong> after your free month. Here&apos;s how to get started:</p>
    <ol>
      <li><strong>Set your password</strong> and log in — your dashboard is open for the first <strong>30 days free</strong></li>
      <li><strong>Add payment details</strong> (optional now) — we&apos;ll only charge after your free month ends</li>
    </ol>
    ${onboardingEmailButton(params.loginLink, "Set password & log in")}
    ${onboardingEmailButton(params.paymentLink, "Add payment details — first month free")}
    <p style="color:#666;font-size:14px;">Your dashboard opens as soon as you set your password. No payment is required today.</p>
    <p style="color:#666;font-size:14px;">Questions? Contact <a href="mailto:hello@barbersynk.com">hello@barbersynk.com</a>.</p>
  `;
  return sendViaResend({
    from: platformFromAddress("barber"),
    to: [params.to],
    replyTo: BARBER_SITE.email,
    subject: `Welcome to BarberSynk — ${params.businessName}`,
    html,
  });
}

/** Welcome email when master admin onboards a NailSynk salon. */
export async function sendNailWelcomeEmail(params: {
  to: string;
  ownerName: string;
  businessName: string;
  planPrice: string;
  loginLink: string;
  paymentLink: string;
}): Promise<{ error?: string }> {
  const html = `
    <p>Hi ${escapeHtmlPlainText(params.ownerName)},</p>
    <p>Welcome to <strong>NailSynk</strong> — your account for <strong>${escapeHtmlPlainText(params.businessName)}</strong> is ready.</p>
    <p>Your plan is <strong>${escapeHtmlPlainText(params.planPrice)}</strong> after your free month. Here&apos;s how to get started:</p>
    <ol>
      <li><strong>Set your password</strong> and log in — your dashboard is open for the first <strong>30 days free</strong></li>
      <li><strong>Add payment details</strong> (optional now) — we&apos;ll only charge after your free month ends</li>
    </ol>
    ${onboardingEmailButton(params.loginLink, "Set password & log in")}
    ${onboardingEmailButton(params.paymentLink, "Add payment details — first month free")}
    <p style="color:#666;font-size:14px;">Your dashboard opens as soon as you set your password. No payment is required today.</p>
    <p style="color:#666;font-size:14px;">Questions? Contact <a href="mailto:hello@nailsynk.com">hello@nailsynk.com</a>.</p>
  `;
  return sendViaResend({
    from: platformFromAddress("nail"),
    to: [params.to],
    replyTo: NAIL_SITE.email,
    subject: `Welcome to NailSynk — ${params.businessName}`,
    html,
  });
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
  const result = await sendLeadStaffEmails({
    from: fromAddress,
    replyTo: params.ownerEmail,
    subject: `[SalonSynk] Setup help request: ${params.salonName.slice(0, 80)}`,
    html,
  });
  if (result.error) return result;
  await sendContactAutoReply({
    to: params.ownerEmail,
    name: params.ownerName,
    platform: "salon",
    kind: "setup",
    businessName: params.salonName,
  });
  return {};
}
