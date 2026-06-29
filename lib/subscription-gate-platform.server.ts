import "server-only";

import { redirect } from "next/navigation";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { tenantRequiresPayment } from "@core/billing/platform-billing";
import {
  fetchBarberBillingState,
  fetchNailBillingState,
} from "@core/billing/platform-onboarding";

export async function enforceBarberSubscriptionIfRequired() {
  const isSuperAdmin = await getIsSuperAdmin();
  if (isSuperAdmin) return;

  const context = await getCurrentUserShop();
  if (!context?.shop.id) return;

  const state = await fetchBarberBillingState(context.shop.id);
  if (state && tenantRequiresPayment(state)) {
    redirect("/barber/billing");
  }
}

export async function enforceNailSubscriptionIfRequired() {
  const isSuperAdmin = await getIsSuperAdmin();
  if (isSuperAdmin) return;

  const context = await getCurrentUserNailSalon();
  if (!context?.salon.id) return;

  const state = await fetchNailBillingState(context.salon.id);
  if (state && tenantRequiresPayment(state)) {
    redirect("/nail/billing");
  }
}
