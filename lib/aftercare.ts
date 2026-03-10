import { createClient } from "@supabase/supabase-js";
import { canSendSms, canSendWhatsApp, sendSms, sendWhatsApp } from "./sms";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type Row = {
  id: string;
  end_time: string;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  clients: { email?: string; phone?: string; name?: string } | null;
  salons: { name?: string; settings?: { aftercare_message?: string } } | null;
};

const DEFAULT_AFTERCARE =
  "Thanks for visiting! We hope you love your new look. Avoid heat styling for 24h if you had colour. Use sulphate-free products. Contact us if you have any questions.";

/**
 * Appointments that ended at least hoursAfterEnd ago, are completed, have send_aftercare enabled, and we haven't sent aftercare.
 */
export async function getAppointmentsEligibleForAftercare(hoursAfterEnd: number) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursAfterEnd);
  const { data } = await supabase
    .from("appointments")
    .select("id, end_time, guest_email, guest_name, guest_phone, clients(email, phone, name), salons(name, settings)")
    .eq("status", "completed")
    .eq("send_aftercare", true)
    .is("aftercare_sent_at", null)
    .lt("end_time", cutoff.toISOString());
  return (data ?? []) as unknown as Row[];
}

export async function sendAftercare(hoursAfterEnd = 2) {
  const appointments = await getAppointmentsEligibleForAftercare(hoursAfterEnd);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const a of appointments) {
    const email = a.guest_email ?? a.clients?.email ?? null;
    const phone = a.guest_phone ?? a.clients?.phone ?? null;
    const salonName = a.salons?.name ?? "the salon";
    const customMsg = (a.salons?.settings as { aftercare_message?: string } | undefined)?.aftercare_message;
    const message = customMsg?.trim() || `${salonName}: ${DEFAULT_AFTERCARE}`;

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
      const { error } = await sendAftercareEmail(email, message, salonName);
      if (!error) sent = true;
      else lastError = error;
    }

    if (!sent && email) {
      const { error } = await sendAftercareEmail(email, message, salonName);
      if (!error) sent = true;
      else lastError = error;
    }

    if (sent) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from("appointments")
        .update({ aftercare_sent_at: new Date().toISOString() })
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

