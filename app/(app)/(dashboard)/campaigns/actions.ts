"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { canViewReports } from "@/lib/dashboard-roles";
import { sendMarketingEmail } from "@/lib/email";
import { canSendSms, sendSms } from "@/lib/sms";
import { signUnsubscribeToken } from "@/lib/marketing-unsubscribe";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { revalidatePath } from "next/cache";
import { normalizeCampaignSegment } from "@/lib/campaign-audience";

const CAMPAIGN_ASSETS_BUCKET = "campaign-assets";
const MAX_CAMPAIGN_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_CAMPAIGN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const BATCH_SIZE = 25;

type CampaignRecipientRow = { id: string; email: string; name: string | null; phone?: string | null };

function htmlToSms(html: string, subject: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\u200b/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const body = text || subject;
  const prefix = subject && !body.startsWith(subject) ? `${subject}\n\n` : "";
  return `${prefix}${body}`.slice(0, 1500);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function assertCanManageCampaigns(salonId: string): Promise<{ ok: true } | { error: string }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  const isSuperAdmin = await getIsSuperAdmin();
  if (!canViewReports(isSuperAdmin, context.member.role ?? "")) return { error: "Forbidden" };
  return { ok: true };
}

/** Upload image for campaign HTML; returns public URL for &lt;img src&gt; */
export async function uploadCampaignImageAction(
  salonId: string,
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const auth = await assertCanManageCampaigns(salonId);
  if ("error" in auth) return { error: auth.error };

  const raw = formData.get("image");
  if (!raw || typeof raw !== "object" || !("size" in raw)) return { error: "No file provided" };
  const file = raw as File;
  if (file.size === 0) return { error: "No file provided" };
  if (file.size > MAX_CAMPAIGN_IMAGE_BYTES) return { error: "Image must be under 3 MB" };
  const type = (file.type || "").toLowerCase();
  if (!ALLOWED_CAMPAIGN_IMAGE_TYPES.includes(type)) {
    return { error: "Allowed types: JPEG, PNG, WebP, GIF" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Storage not configured" };
  }

  const ext = file.name?.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${salonId}/campaigns/${randomUUID()}.${safeExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { error: uploadError } = await admin.storage
    .from(CAMPAIGN_ASSETS_BUCKET)
    .upload(path, buffer, { upsert: false, contentType: type });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = admin.storage.from(CAMPAIGN_ASSETS_BUCKET).getPublicUrl(path);
  return { url: urlData.publicUrl };
}

function parseRpcCount(data: unknown): number {
  if (data == null) return 0;
  if (typeof data === "bigint") return Number(data);
  if (typeof data === "number") return Number.isFinite(data) ? data : 0;
  if (typeof data === "string") {
    const n = Number(data);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function countMarketingRecipientsAction(params?: {
  segment?: string;
  serviceId?: string | null;
}): Promise<{ count: number; error?: string }> {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { count: 0, error: "Unauthorized" };
  const isSuperAdmin = await getIsSuperAdmin();
  if (!canViewReports(isSuperAdmin, context.member.role ?? "")) {
    return { count: 0, error: "Forbidden" };
  }

  const segment = normalizeCampaignSegment(params?.segment);
  const serviceId = params?.serviceId?.trim() || null;
  if (segment === "service_booked" && !serviceId) {
    return { count: 0, error: "Choose a service to count this audience." };
  }
  if (segment === "service_booked" && serviceId && !UUID_RE.test(serviceId)) {
    return { count: 0, error: "Invalid service." };
  }

  const { data, error } = await supabase.rpc("count_campaign_recipients", {
    p_salon_id: context.salon.id,
    p_segment: segment,
    p_service_id: segment === "service_booked" && serviceId ? serviceId : null,
  });

  if (error) return { count: 0, error: error.message };
  return { count: parseRpcCount(data) };
}

export async function sendMarketingCampaignAction(formData: FormData): Promise<{ error?: string; sent?: number }> {
  const subject = String(formData.get("subject") ?? "").trim();
  const preheader = String(formData.get("preheader") ?? "").trim();
  const bodyHtml = String(formData.get("bodyHtml") ?? "").trim();
  const audienceSegment = normalizeCampaignSegment(String(formData.get("audienceSegment") ?? "all"));
  const audienceServiceIdRaw = String(formData.get("audienceServiceId") ?? "").trim();
  const audience_service_id: string | null =
    audienceSegment === "service_booked" && audienceServiceIdRaw ? audienceServiceIdRaw : null;
  const sendEmail = String(formData.get("sendEmail") ?? "1") !== "0";
  const sendSmsChannel = String(formData.get("sendSms") ?? "0") === "1";
  const smsBodyRaw = String(formData.get("smsBody") ?? "").trim();

  if (!sendEmail && !sendSmsChannel) return { error: "Choose email, text message, or both." };
  if (sendEmail && !subject) return { error: "Subject is required" };
  if (sendEmail && !bodyHtml) return { error: "Message body is required" };
  if (sendSmsChannel && !smsBodyRaw && !bodyHtml) return { error: "Text message is required" };
  if (sendSmsChannel && !canSendSms()) {
    return { error: "Text messaging is not configured (Twilio). Email can still be sent." };
  }
  if (audienceSegment === "service_booked" && !audience_service_id) {
    return { error: "Choose a service for this audience." };
  }
  if (audience_service_id && !UUID_RE.test(audience_service_id)) {
    return { error: "Invalid service." };
  }

  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };
  const isSuperAdmin = await getIsSuperAdmin();
  if (!canViewReports(isSuperAdmin, context.member.role ?? "")) {
    return { error: "Forbidden" };
  }

  if (audience_service_id) {
    const { data: svc, error: svcErr } = await supabase
      .from("services")
      .select("id")
      .eq("salon_id", context.salon.id)
      .eq("id", audience_service_id)
      .maybeSingle();
    if (svcErr || !svc) return { error: "Invalid service for this salon." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const campaignSubject = subject || smsBodyRaw.slice(0, 80) || "SMS campaign";
  const campaignHtml =
    bodyHtml ||
    `<p>${smsBodyRaw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>")}</p>`;

  const { data: campaignRow, error: insertErr } = await supabase
    .from("email_campaigns")
    .insert({
      salon_id: context.salon.id,
      subject: campaignSubject,
      body_html: campaignHtml,
      status: "sending",
      created_by: user?.id ?? null,
      audience_segment: audienceSegment,
      audience_service_id,
    })
    .select("id")
    .single();

  if (insertErr || !campaignRow?.id) {
    return { error: insertErr?.message ?? "Could not create campaign" };
  }

  const campaignId = campaignRow.id as string;

  const { data: recipients, error: recErr } = await supabase.rpc("list_campaign_recipients", {
    p_salon_id: context.salon.id,
    p_segment: audienceSegment,
    p_service_id: audience_service_id,
  });

  if (recErr) {
    await supabase
      .from("email_campaigns")
      .update({ status: "failed", error_message: recErr.message })
      .eq("id", campaignId);
    return { error: recErr.message };
  }

  const rawList = (recipients ?? []) as CampaignRecipientRow[];
  const emailList = sendEmail
    ? rawList.filter((r) => r.email && String(r.email).includes("@"))
    : [];

  const ids = rawList.map((r) => r.id).filter(Boolean);
  let phoneById = new Map<string, string>();
  if (sendSmsChannel && ids.length > 0) {
    const { data: phoneRows } = await supabase
      .from("clients")
      .select("id, phone")
      .eq("salon_id", context.salon.id)
      .in("id", ids);
    for (const row of phoneRows ?? []) {
      const phone = String((row as { phone?: string | null }).phone ?? "").trim();
      if (phone.replace(/\D/g, "").length >= 10) {
        phoneById.set((row as { id: string }).id, phone);
      }
    }
  }
  const smsList = sendSmsChannel ? rawList.filter((r) => phoneById.has(r.id)) : [];

  if (emailList.length === 0 && smsList.length === 0) {
    await supabase
      .from("email_campaigns")
      .update({
        status: "failed",
        error_message: "No opted-in clients with an email or mobile number for the chosen channel.",
      })
      .eq("id", campaignId);
    return { error: "No opted-in clients with an email or mobile number for the chosen channel." };
  }

  const baseUrl = getPublicSiteUrl();
  let firstError: string | undefined;
  const smsBody = (smsBodyRaw || htmlToSms(bodyHtml, subject)).slice(0, 1500);

  if (sendEmail) {
    for (let i = 0; i < emailList.length; i += BATCH_SIZE) {
      const slice = emailList.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        slice.map(async (c: CampaignRecipientRow) => {
          const token = signUnsubscribeToken(c.id, context.salon.id);
          const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
          return sendMarketingEmail({
            to: String(c.email),
            subject,
            html: bodyHtml,
            unsubscribeUrl,
            preheader: preheader || undefined,
          });
        }),
      );
      const bad = results.find((r) => r.error);
      if (bad?.error) {
        firstError = bad.error;
        break;
      }
    }
  }

  if (!firstError && sendSmsChannel) {
    for (let i = 0; i < smsList.length; i += BATCH_SIZE) {
      const slice = smsList.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        slice.map(async (c) => sendSms(phoneById.get(c.id) as string, smsBody)),
      );
      const bad = results.find((r) => r.error);
      if (bad?.error) {
        firstError = bad.error;
        break;
      }
    }
  }

  if (firstError) {
    await supabase
      .from("email_campaigns")
      .update({ status: "failed", error_message: firstError })
      .eq("id", campaignId);
    return { error: firstError };
  }

  await supabase
    .from("email_campaigns")
    .update({
      status: "sent",
      recipient_count: Math.max(emailList.length, smsList.length),
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", campaignId);

  revalidatePath("/campaigns");
  const sentIds = new Set([
    ...emailList.map((r) => r.id),
    ...smsList.map((r) => r.id),
  ]);
  return { sent: sentIds.size };
}
