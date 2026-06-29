import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const host = hostFromRequest(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const isSuperAdmin = await getIsSuperAdmin();

      if (isSmartHost(host) && isSuperAdmin) {
        return NextResponse.redirect(`${origin}/smart/overview`);
      }

      if (isSuperAdmin && !isSmartHost(host)) {
        return NextResponse.redirect(`${origin}/admin`);
      }

      if (isBarberHost(host)) {
        const barberNext = next.startsWith("/") ? next : "/barber/dashboard";
        return NextResponse.redirect(`${BARBER_SITE.url}${barberNext}`);
      }

      if (isNailHost(host)) {
        const nailNext = next.startsWith("/") ? next : "/nail/queue";
        return NextResponse.redirect(`${NAIL_SITE.url}${nailNext}`);
      }

      let redirectTo = next.startsWith("/") ? next : "/dashboard";
      const context = await getCurrentUserSalon();
      if (context?.salon.id) {
        const state = await fetchSalonOnboardingState(context.salon.id);
        if (state && salonRequiresPayment(state)) {
          redirectTo = "/billing";
        }
      }

      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  const loginPath = isSmartHost(host) ? `${SMART_SITE.url}/login` : `${origin}/login`;
  return NextResponse.redirect(`${loginPath}?error=auth`);
}
