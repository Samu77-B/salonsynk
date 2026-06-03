import "server-only";

import { redirect } from "next/navigation";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { fetchSalonOnboardingState, salonRequiresPayment } from "@/lib/onboarding";

/** Redirect unpaid salons to billing when subscription is required. */
export async function enforceSalonSubscriptionIfRequired() {
  const isSuperAdmin = await getIsSuperAdmin();
  if (isSuperAdmin) return;

  const context = await getCurrentUserSalon();
  if (!context?.salon.id) return;

  const state = await fetchSalonOnboardingState(context.salon.id);
  if (state && salonRequiresPayment(state)) {
    redirect("/billing");
  }
}
