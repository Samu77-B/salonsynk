import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { fetchSalonOnboardingState, salonRequiresPayment } from "@/lib/onboarding";
import { SMART_SITE } from "@core/config/smart-site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";
import {
  isAllowedAdminReturnPath,
  superAdminShouldHonorAuthNext,
} from "@core/auth/admin-switch-next";
import { consumePendingAdminReturn } from "@core/auth/admin-handoff-state";
import {
  resolveAuthNextPath,
  resolveProductFromHost,
  type ProductHost,
} from "@/lib/platform-host";
import { getSmartAccess } from "@core/auth/smart-access";

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

function productFromHost(host: string): ProductHost {
  if (isBarberHost(host)) return "barber";
  if (isNailHost(host)) return "nail";
  if (isSmartHost(host)) return "smart";
  return resolveProductFromHost(host);
}

async function resolvePostAuthRedirect(
  origin: string,
  host: string,
  next: string,
  authType: string | null,
  userId: string | null
): Promise<string> {
  const isSuperAdmin = await getIsSuperAdmin();
  const product = productFromHost(host);

  if (isSuperAdmin && userId) {
    const pending = await consumePendingAdminReturn(userId);
    if (pending && isAllowedAdminReturnPath(pending)) {
      return `${origin}${pending}`;
    }
  }

  if (isSmartHost(host) && isSuperAdmin) {
    return `${origin}/smart/overview`;
  }

  if (isSmartHost(host) && userId) {
    const access = await getSmartAccess(userId);
    if (access.canAccess) {
      return `${origin}/smart/overview`;
    }
  }

  if (isBarberHost(host)) {
    const barberNext = resolveAuthNextPath("barber", next);
    if (needsPasswordSetup(authType)) {
      return passwordSetupPath(BARBER_SITE.url.replace(/\/$/, ""), barberNext);
    }
    if (isSuperAdmin) {
      if (superAdminShouldHonorAuthNext(barberNext)) {
        return `${origin}${barberNext}`;
      }
      return `${origin}/admin`;
    }
    return `${BARBER_SITE.url}${barberNext}`;
  }

  if (isNailHost(host)) {
    const nailNext = resolveAuthNextPath("nail", next);
    if (needsPasswordSetup(authType)) {
      return passwordSetupPath(NAIL_SITE.url.replace(/\/$/, ""), nailNext);
    }
    if (isSuperAdmin) {
      if (superAdminShouldHonorAuthNext(nailNext)) {
        return `${origin}${nailNext}`;
      }
      return `${origin}/admin`;
    }
    return `${NAIL_SITE.url}${nailNext}`;
  }

  let redirectTo = resolveAuthNextPath(product, next);
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

  if (isSuperAdmin && !isSmartHost(host)) {
    if (superAdminShouldHonorAuthNext(redirectTo)) {
      return `${origin}${redirectTo}`;
    }
    return `${origin}/admin`;
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
    let verifyError = (
      await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: authType as EmailOtpType,
      })
    ).error;

    // Invite links sometimes only verify as signup depending on Supabase version.
    if (verifyError && authType === "invite") {
      verifyError = (
        await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "signup",
        })
      ).error;
      if (!verifyError) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const redirectUrl = await resolvePostAuthRedirect(
          origin,
          host,
          next,
          "invite",
          user?.id ?? null
        );
        return NextResponse.redirect(redirectUrl);
      }
    }

    if (!verifyError) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const redirectUrl = await resolvePostAuthRedirect(
        origin,
        host,
        next,
        authType,
        user?.id ?? null
      );
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
        effectiveType,
        user?.id ?? null
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  const loginPath = isSmartHost(host) ? `${SMART_SITE.url}/login` : `${origin}/login`;
  return hashForwardingResponse(`${loginPath}?error=auth`);
}

/**
 * Supabase email links use the implicit flow, so the session arrives in the URL
 * fragment which never reaches the server. Hand the fragment to the client-side
 * handler on this same domain instead of bouncing to the login screen.
 */
function hashForwardingResponse(fallbackUrl: string): NextResponse {
  const html = `<!doctype html><html><head><meta name="robots" content="noindex"><title>Signing in…</title></head><body><script>
(function () {
  var hash = window.location.hash || "";
  if (hash.indexOf("access_token") > -1 || hash.indexOf("error=") > -1) {
    window.location.replace("/" + hash);
    return;
  }
  window.location.replace(${JSON.stringify(fallbackUrl)});
})();
</script><noscript><a href="${fallbackUrl}">Continue</a></noscript></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
