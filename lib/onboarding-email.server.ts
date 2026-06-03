import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendSalonSetupGuideEmail,
} from "@/lib/email";
import { getAppBaseUrl } from "@/lib/onboarding";

/** Send post-payment setup guide once per salon. */
export async function sendPostPaymentSetupEmailIfNeeded(salonId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: salon } = await admin
    .from("salons")
    .select("id, name, onboarding_setup_email_sent_at")
    .eq("id", salonId)
    .single();

  if (!salon || salon.onboarding_setup_email_sent_at) return;

  const { data: ownerMember } = await admin
    .from("salon_members")
    .select("user_id, display_name")
    .eq("salon_id", salonId)
    .eq("role", "owner")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!ownerMember?.user_id) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", ownerMember.user_id)
    .single();

  const ownerEmail = (profile?.email as string | null)?.trim();
  if (!ownerEmail) return;

  const ownerName =
    (ownerMember.display_name as string | null)?.trim() ||
    (profile?.full_name as string | null)?.trim() ||
    ownerEmail.split("@")[0] ||
    "there";

  const baseUrl = getAppBaseUrl();
  const result = await sendSalonSetupGuideEmail({
    to: ownerEmail,
    ownerName,
    salonName: (salon.name as string) || "your salon",
    dashboardLink: `${baseUrl}/dashboard`,
    setupHelpLink: `${baseUrl}/setup-help`,
  });

  if (!result.error) {
    await admin
      .from("salons")
      .update({ onboarding_setup_email_sent_at: new Date().toISOString() })
      .eq("id", salonId);
  }
}
