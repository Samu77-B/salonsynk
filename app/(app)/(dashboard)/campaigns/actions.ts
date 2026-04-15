"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { canViewReports } from "@/lib/dashboard-roles";
import { sendMarketingEmail } from "@/lib/email";
import { signUnsubscribeToken } from "@/lib/marketing-unsubscribe";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { revalidatePath } from "next/cache";
import { normalizeCampaignSegment } from "@/lib/campaign-audience";

const CAMPAIGN_ASSETS_BUCKET = "campaign-assets";
const MAX_CAMPAIGN_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_CAMPAIGN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const BATCH_SIZE = 25;

type CampaignRecipientRow = { id: string; email: string; name: string | null };

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

  if (!subject) return { error: "Subject is required" };
  if (!bodyHtml) return { error: "Message body is required" };
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

  const { data: campaignRow, error: insertErr } = await supabase
    .from("email_campaigns")
    .insert({
      salon_id: context.salon.id,
      subject,
      body_html: bodyHtml,
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
  const list = rawList.filter((r) => r.email && String(r.email).includes("@"));
  if (list.length === 0) {
    await supabase
      .from("email_campaigns")
      .update({ status: "failed", error_message: "No opted-in clients with email addresses." })
      .eq("id", campaignId);
    return { error: "No opted-in clients with email addresses." };
  }

  const baseUrl = getPublicSiteUrl();
  let firstError: string | undefined;

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const slice = list.slice(i, i + BATCH_SIZE);
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
      recipient_count: list.length,
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", campaignId);

  revalidatePath("/campaigns");
  return { sent: list.length };
}
