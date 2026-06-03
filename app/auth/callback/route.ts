import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { fetchSalonOnboardingState, salonRequiresPayment } from "@/lib/onboarding";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const isSuperAdmin = await getIsSuperAdmin();
      if (isSuperAdmin) {
        return NextResponse.redirect(`${origin}/admin`);
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

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
