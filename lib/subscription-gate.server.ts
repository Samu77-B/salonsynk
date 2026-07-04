import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { fetchSalonOnboardingState, salonRequiresPayment } from "@/lib/onboarding";
import { canBypassSalonSubscriptionGate } from "@/lib/salon-access.server";

/** Redirect unpaid salons to billing when subscription is required. */
export async function enforceSalonSubscriptionIfRequired() {
  if (await canBypassSalonSubscriptionGate()) return;

  const context = await getCurrentUserSalon();
  if (!context?.salon.id) return;

  const state = await fetchSalonOnboardingState(context.salon.id);
  if (state && salonRequiresPayment(state)) {
    redirect("/billing");
  }
}
