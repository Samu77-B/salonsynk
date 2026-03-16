import { createClient } from "@supabase/supabase-js";
import { sendWeMissYouEmail } from "./email";
import { canSendSms, canSendWhatsApp, sendSms, sendWhatsApp } from "./sms";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://salonsynk.com");

type ClientRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  we_miss_you_sent_at: string | null;
  salon_id: string;
  salons: { slug?: string; name?: string; settings?: { we_miss_you_weeks_min?: number; we_miss_you_weeks_max?: number; we_miss_you_discount_code?: string } } | null;
};

/**
 * Get clients whose last completed appointment ended between weeksMin and weeksMax ago,
 * and we haven't already sent a We Miss You since that visit.
 */
export async function getLapsedClientsForWeMissYou(weeksMin = 6, weeksMax = 10) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();
  const minDate = new Date(now);
  minDate.setDate(minDate.getDate() - weeksMax * 7);
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() - weeksMin * 7);

  // Subquery: last completed appointment end_time per client
  const { data: lastVisits } = await supabase
    .from("appointments")
    .select("client_id, end_time")
    .eq("status", "completed")
    .not("client_id", "is", null)
    .order("end_time", { ascending: false });

  const lastVisitByClient = new Map<string, string>();
  for (const row of lastVisits ?? []) {
    if (row.client_id && !lastVisitByClient.has(row.client_id)) {
      lastVisitByClient.set(row.client_id, row.end_time);
    }
  }

  const clientIdsInWindow: string[] = [];
  for (const [clientId, endTime] of lastVisitByClient) {
    const end = new Date(endTime);
    if (end >= minDate && end <= maxDate) clientIdsInWindow.push(clientId);
  }

  if (clientIdsInWindow.length === 0) return [];

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, phone, we_miss_you_sent_at, salon_id, salons(slug, name, settings)")
    .in("id", clientIdsInWindow);

  const results: (ClientRow & { last_appointment_end: string })[] = [];
  for (const c of clients ?? []) {
    const lastEnd = lastVisitByClient.get(c.id);
    if (!lastEnd) continue;
    const sentAt = (c as { we_miss_you_sent_at?: string | null }).we_miss_you_sent_at;
    if (sentAt && new Date(sentAt) >= new Date(lastEnd)) continue;
    results.push({ ...c, last_appointment_end: lastEnd } as ClientRow & { last_appointment_end: string });
  }
  return results;
}

export async function sendWeMissYouCampaign(weeksMin = 6, weeksMax = 10) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const clients = await getLapsedClientsForWeMissYou(weeksMin, weeksMax);
  const results: { clientId: string; ok: boolean; error?: string }[] = [];

  for (const client of clients) {
    const email = client.email?.trim() || null;
    const phone = client.phone?.trim() || null;
    const salon = client.salons as { slug?: string; name?: string; settings?: { we_miss_you_discount_code?: string } } | null;
    const slug = salon?.slug;
    const salonName = salon?.name ?? "us";
    const discountCode = salon?.settings?.we_miss_you_discount_code;
    const bookUrl = slug ? `${siteUrl.replace(/\/$/, "")}/book/${slug}` : undefined;
    const message = discountCode
      ? `We miss you at ${salonName}! Book your next visit: ${bookUrl ?? "contact us"} Use code ${discountCode} for a discount.`
      : `We miss you at ${salonName}! Book your next visit: ${bookUrl ?? "contact us"}`;

    let sent = false;
    let lastError: string | undefined;

    if (phone && (canSendWhatsApp() || canSendSms())) {
      if (canSendWhatsApp()) {
        const { error } = await sendWhatsApp(phone, message);
        if (!error) sent = true;
        else lastError = error;
      }
      if (!sent && canSendSms()) {
        const { error } = await sendSms(phone, message);
        if (!error) sent = true;
        else lastError = error;
      }
    }
    if (!sent && email) {
      const { error } = await sendWeMissYouEmail(email, {
        clientName: client.name ?? undefined,
        salonName,
        bookUrl,
        discountCode,
      });
      if (!error) sent = true;
      else lastError = error;
    }

    if (sent) {
      await supabase
        .from("clients")
        .update({ we_miss_you_sent_at: new Date().toISOString() })
        .eq("id", client.id);
    }

    results.push({
      clientId: client.id,
      ok: sent,
      error: sent ? undefined : lastError ?? "No email or phone / channels not configured",
    });
  }

  return results;
}
