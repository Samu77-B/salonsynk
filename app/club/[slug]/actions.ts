"use server";

import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBookingPolicy } from "@/lib/booking-policy";
import { findClientByContact } from "@/lib/clients/upsert-guest";
import { consumePortalCode, issuePortalCode } from "@/lib/club/codes";
import { clubCookieName, clubCookieOptions, encodeClubSession, newClubSession } from "@/lib/club/session";
import { sendClubAccessCode } from "@/lib/email";
import { canSendSms, sendSms } from "@/lib/sms";
import { checkPublicRateLimit } from "@/lib/ai/public-rate-limit";

function contactKind(value: string): "email" | "phone" | null {
  const v = value.trim();
  if (v.includes("@")) return "email";
  if (v.replace(/\D/g, "").length >= 10) return "phone";
  return null;
}

export async function requestClubCode(slug: string, contact: string): Promise<{ error?: string; sentTo?: string }> {
  const trimmed = contact.trim();
  const kind = contactKind(trimmed);
  if (!kind) return { error: "Enter the email or mobile number on your client record." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = checkPublicRateLimit(`club-code:${slug}:${ip}:${trimmed.toLowerCase()}`, {
    maxRequests: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) return { error: "Please wait a few minutes before requesting another code." };

  const supabase = createAdminClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, slug, settings")
    .eq("slug", slug)
    .maybeSingle();
  if (!salon) return { error: "Salon not found" };

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const policy = parseBookingPolicy(salon.slug as string, settings, salon.name as string);
  if (!policy.clubPortalEnabled) return { error: "This salon’s client club is not available yet." };

  const client = await findClientByContact(
    supabase,
    salon.id as string,
    kind === "email" ? trimmed : null,
    kind === "phone" ? trimmed : null
  );
  if (!client) {
    return {
      error: `We couldn’t find a ${policy.clubName} record with that ${kind}. Book online first, or ask the salon to add you.`,
    };
  }

  const issued = await issuePortalCode(supabase, {
    salonId: salon.id as string,
    clientId: client.id,
    contact: trimmed,
  });
  if ("error" in issued) return { error: issued.error };

  if (kind === "email" && client.email) {
    const { error } = await sendClubAccessCode(client.email, {
      salonName: salon.name as string,
      clubName: policy.clubName,
      code: issued.code,
    });
    if (error) return { error: "We couldn’t send the email. Try a mobile number, or ask the salon." };
    return { sentTo: "email" };
  }

  const phone = client.phone || trimmed;
  if (canSendSms()) {
    const { error } = await sendSms(
      phone,
      `Your ${policy.clubName} code is ${issued.code}. It expires in 10 minutes.`
    );
    if (error) return { error: "We couldn’t send the text. Try the email on your record." };
    return { sentTo: "phone" };
  }

  return { error: "Text messages are not configured. Try the email on your record, or ask the salon." };
}

export async function verifyClubCode(
  slug: string,
  contact: string,
  code: string
): Promise<{ error?: string }> {
  const trimmed = contact.trim();
  const supabase = createAdminClient();
  const { data: salon } = await supabase.from("salons").select("id, slug").eq("slug", slug).maybeSingle();
  if (!salon) return { error: "Salon not found" };

  const consumed = await consumePortalCode(supabase, {
    salonId: salon.id as string,
    contact: trimmed,
    code,
  });
  if ("error" in consumed) return { error: consumed.error };

  const jar = await cookies();
  jar.set(
    clubCookieName(),
    encodeClubSession(newClubSession(salon.id as string, consumed.clientId, salon.slug as string)),
    clubCookieOptions()
  );
  return {};
}

export async function signOutClub(): Promise<void> {
  const jar = await cookies();
  jar.delete(clubCookieName());
}
