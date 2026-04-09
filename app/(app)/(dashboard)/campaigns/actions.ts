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

const CAMPAIGN_ASSETS_BUCKET = "campaign-assets";
const MAX_CAMPAIGN_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_CAMPAIGN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const BATCH_SIZE = 25;

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

export async function countMarketingRecipientsAction(): Promise<{ count: number; error?: string }> {
  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { count: 0, error: "Unauthorized" };
  const isSuperAdmin = await getIsSuperAdmin();
  if (!canViewReports(isSuperAdmin, context.member.role ?? "")) {
    return { count: 0, error: "Forbidden" };
  }

  const { count, error } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("salon_id", context.salon.id)
    .eq("marketing_opt_in", true)
    .not("email", "is", null);

  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0 };
}

export async function sendMarketingCampaignAction(formData: FormData): Promise<{ error?: string; sent?: number }> {
  const subject = String(formData.get("subject") ?? "").trim();
  const bodyHtml = String(formData.get("bodyHtml") ?? "").trim();

  if (!subject) return { error: "Subject is required" };
  if (!bodyHtml) return { error: "Message body is required" };

  const supabase = await createClient();
  const context = await getCurrentUserSalon();
  if (!context) return { error: "Unauthorized" };
  const isSuperAdmin = await getIsSuperAdmin();
  if (!canViewReports(isSuperAdmin, context.member.role ?? "")) {
    return { error: "Forbidden" };
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
    })
    .select("id")
    .single();

  if (insertErr || !campaignRow?.id) {
    return { error: insertErr?.message ?? "Could not create campaign" };
  }

  const campaignId = campaignRow.id as string;

  const { data: recipients, error: recErr } = await supabase
    .from("clients")
    .select("id, email, name")
    .eq("salon_id", context.salon.id)
    .eq("marketing_opt_in", true)
    .not("email", "is", null);

  if (recErr) {
    await supabase
      .from("email_campaigns")
      .update({ status: "failed", error_message: recErr.message })
      .eq("id", campaignId);
    return { error: recErr.message };
  }

  const list = (recipients ?? []).filter((r) => r.email && String(r.email).includes("@"));
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
      slice.map(async (c) => {
        const token = signUnsubscribeToken(c.id, context.salon.id);
        const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
        return sendMarketingEmail({
          to: String(c.email),
          subject,
          html: bodyHtml,
          unsubscribeUrl,
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
