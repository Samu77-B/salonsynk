import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { fetchSalonOnboardingState, salonRequiresPayment } from "@/lib/onboarding";
import { SMART_SITE } from "@core/config/smart-site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";

function hostFromRequest(request: Request): string {
  return new URL(request.url).host.toLowerCase();
}

function isSmartHost(host: string): boolean {
  return host.includes("smartsynk.net") || (process.env.NODE_ENV === "development" && host.startsWith("localhost"));
}

function isBarberHost(host: string): boolean {
  return host.includes("barbersynk.com");
}

function isNailHost(host: string): boolean {
  return host.includes("nailsynk.com");
}

function passwordSetupPath(origin: string, next: string): string {
  return `${origin}/update-password?next=${encodeURIComponent(next)}`;
}

function needsPasswordSetup(type: string | null): boolean {
  return type === "invite" || type === "recovery" || type === "signup";
}

async function resolvePostAuthRedirect(
  origin: string,
  host: string,
  next: string,
  authType: string | null
): Promise<string> {
  const isSuperAdmin = await getIsSuperAdmin();

  if (isSmartHost(host) && isSuperAdmin) {
    return `${origin}/smart/overview`;
  }

  if (isSuperAdmin && !isSmartHost(host)) {
    return `${origin}/admin`;
  }

  if (isBarberHost(host)) {
    const barberNext = next.startsWith("/") ? next : "/barber/dashboard";
    if (needsPasswordSetup(authType)) {
      return passwordSetupPath(BARBER_SITE.url.replace(/\/$/, ""), barberNext);
    }
    return `${BARBER_SITE.url}${barberNext}`;
  }

  if (isNailHost(host)) {
    const nailNext = next.startsWith("/") ? next : "/nail/queue";
    if (needsPasswordSetup(authType)) {
      return passwordSetupPath(NAIL_SITE.url.replace(/\/$/, ""), nailNext);
    }
    return `${NAIL_SITE.url}${nailNext}`;
  }

  let redirectTo = next.startsWith("/") ? next : "/dashboard";
  const context = await getCurrentUserSalon();
  let onboardingPaymentRequired = false;
  if (context?.salon.id) {
    const state = await fetchSalonOnboardingState(context.salon.id);
    if (state && salonRequiresPayment(state)) {
      redirectTo = "/billing";
      onboardingPaymentRequired = true;
    }
  }

  if (needsPasswordSetup(authType) || onboardingPaymentRequired) {
    return passwordSetupPath(origin, redirectTo);
  }

  return `${origin}${redirectTo}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const authType = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";
  const host = hostFromRequest(request);
  const supabase = await createClient();

  if (tokenHash && authType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: authType as EmailOtpType,
    });
    if (!error) {
      const redirectUrl = await resolvePostAuthRedirect(origin, host, next, authType);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const effectiveType =
        authType ?? (user?.invited_at ? "invite" : null);
      const redirectUrl = await resolvePostAuthRedirect(
        origin,
        host,
        next,
        effectiveType
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  const loginPath = isSmartHost(host) ? `${SMART_SITE.url}/login` : `${origin}/login`;
  return NextResponse.redirect(`${loginPath}?error=auth`);
}
