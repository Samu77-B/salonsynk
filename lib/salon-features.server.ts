import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import {
  getEnabledFeatures,
  salonHasFeature,
  type PlatformFeatureId,
  type SalonPlanState,
} from "@/config/plans";
import { redirect } from "next/navigation";
import { parseSalonPlanState, type SalonPlanRow } from "@/lib/salon-features";

/** Load plan tier + overrides for a salon (works for admin salon switching). */
export async function fetchSalonPlanState(salonId: string): Promise<SalonPlanState> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("salons")
      .select("plan_tier, feature_overrides")
      .eq("id", salonId)
      .single();
    if (data) return parseSalonPlanState(data as SalonPlanRow);
  } catch {
    // fall through to default
  }
  return { plan_tier: "professional", feature_overrides: {} };
}

export async function getEnabledFeaturesForSalon(
  salonId: string
): Promise<PlatformFeatureId[]> {
  const state = await fetchSalonPlanState(salonId);
  return getEnabledFeatures(state);
}

/** Redirect to diary when the current salon's plan does not include a feature. Super admins bypass for setup. */
export async function requireSalonFeature(featureId: PlatformFeatureId) {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");
  const plan = await fetchSalonPlanState(context.salon.id);
  const isSuperAdmin = await getIsSuperAdmin();
  if (isSuperAdmin) return { context, plan };
  if (!salonHasFeature(plan, featureId)) redirect("/dashboard");
  return { context, plan };
}
