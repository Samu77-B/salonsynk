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

function resolveCampaignWindowWeeks(
  salonSettings: { we_miss_you_weeks_min?: number; we_miss_you_weeks_max?: number } | undefined,
  overrideWeeksMin?: number,
  overrideWeeksMax?: number
) {
  const minWeeks = Math.max(0, Math.round(overrideWeeksMin ?? (Number(salonSettings?.we_miss_you_weeks_min) || 6)));
  const maxWeeks = Math.max(minWeeks, Math.round(overrideWeeksMax ?? (Number(salonSettings?.we_miss_you_weeks_max) || 10)));
  return { minWeeks, maxWeeks };
}

/**
 * Get clients whose last completed appointment ended between weeksMin and weeksMax ago,
 * and we haven't already sent a We Miss You since that visit.
 */
export async function getLapsedClientsForWeMissYou(overrideWeeksMin?: number, overrideWeeksMax?: number) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();

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

  const candidateClientIds = [...lastVisitByClient.keys()];
  if (candidateClientIds.length === 0) return [];

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, phone, we_miss_you_sent_at, salon_id, salons(slug, name, settings)")
    .in("id", candidateClientIds);

  const results: (ClientRow & { last_appointment_end: string })[] = [];
  for (const c of clients ?? []) {
    const lastEnd = lastVisitByClient.get(c.id);
    if (!lastEnd) continue;
    const settings = (c.salons as { settings?: { we_miss_you_weeks_min?: number; we_miss_you_weeks_max?: number } } | null)?.settings;
    const { minWeeks, maxWeeks } = resolveCampaignWindowWeeks(settings, overrideWeeksMin, overrideWeeksMax);
    const minDate = new Date(now);
    minDate.setDate(minDate.getDate() - maxWeeks * 7);
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() - minWeeks * 7);
    const end = new Date(lastEnd);
    if (end < minDate || end > maxDate) continue;
    const sentAt = (c as { we_miss_you_sent_at?: string | null }).we_miss_you_sent_at;
    if (sentAt && new Date(sentAt) >= new Date(lastEnd)) continue;
    results.push({ ...c, last_appointment_end: lastEnd } as ClientRow & { last_appointment_end: string });
  }
  return results;
}

export async function sendWeMissYouCampaign(overrideWeeksMin?: number, overrideWeeksMax?: number) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const clients = await getLapsedClientsForWeMissYou(overrideWeeksMin, overrideWeeksMax);
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
