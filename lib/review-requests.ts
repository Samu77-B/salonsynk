import { createClient } from "@supabase/supabase-js";
import { sendReviewRequest } from "./email";
import { canSendSms, canSendWhatsApp, sendSms, sendWhatsApp } from "./sms";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://salonsynk.com");

type Row = {
  id: string;
  end_time: string;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  clients: { email?: string; phone?: string; name?: string } | null;
  salons: { name?: string; slug?: string } | null;
};

/**
 * Appointments that ended at least hoursAfterEnd ago, are completed, and we haven't sent a review request.
 */
export async function getAppointmentsEligibleForReviewRequest(hoursAfterEnd: number) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursAfterEnd);
  const { data } = await supabase
    .from("appointments")
    .select("id, end_time, guest_email, guest_name, guest_phone, clients(email, phone, name), salons(name, slug)")
    .eq("status", "completed")
    .is("review_request_sent_at", null)
    .lt("end_time", cutoff.toISOString());
  return (data ?? []) as unknown as Row[];
}

export async function sendReviewRequests(hoursAfterEnd = 2) {
  const appointments = await getAppointmentsEligibleForReviewRequest(hoursAfterEnd);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const a of appointments) {
    const email = a.guest_email ?? a.clients?.email ?? null;
    const phone = a.guest_phone ?? a.clients?.phone ?? null;
    const salonName = a.salons?.name ?? "the salon";
    const clientName = a.guest_name ?? a.clients?.name ?? undefined;
    const slug = a.salons?.slug;
    const reviewUrl = slug ? `${siteUrl.replace(/\/$/, "")}/review?salon=${encodeURIComponent(slug)}` : undefined;
    const shortMessage = `Thanks for visiting ${salonName}. We’d love your feedback – leave a review: ${reviewUrl ?? "contact us"}`;

    let sent = false;
    let lastError: string | undefined;

    if (phone && (canSendWhatsApp() || canSendSms())) {
      if (canSendWhatsApp()) {
        const { error } = await sendWhatsApp(phone, shortMessage);
        if (!error) sent = true;
        else lastError = error;
      }
      if (!sent && canSendSms()) {
        const { error } = await sendSms(phone, shortMessage);
        if (!error) sent = true;
        else lastError = error;
      }
    }
    if (!sent && email) {
      const { error } = await sendReviewRequest(email, {
        clientName,
        salonName,
        reviewUrl,
      });
      if (!error) sent = true;
      else lastError = error;
    }

    if (sent) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from("appointments")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", a.id);
    }
    results.push({
      id: a.id,
      ok: sent,
      error: sent ? undefined : lastError ?? "No email or phone / channels not configured",
    });
  }
  return results;
}
