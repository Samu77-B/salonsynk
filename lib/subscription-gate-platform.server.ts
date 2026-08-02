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
  try {
    const isSuperAdmin = await getIsSuperAdmin();
    if (isSuperAdmin) return;

    const context = await getCurrentUserShop();
    if (!context?.shop.id) return;

    const state = await fetchBarberBillingState(context.shop.id);
    if (state && tenantRequiresPayment(state)) {
      redirect("/barber/billing");
    }
  } catch (err) {
    // redirect() throws a special NEXT_REDIRECT error — rethrow it
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    console.error("enforceBarberSubscriptionIfRequired failed:", err);
  }
}

export async function enforceNailSubscriptionIfRequired() {
  try {
    const isSuperAdmin = await getIsSuperAdmin();
    if (isSuperAdmin) return;

    const context = await getCurrentUserNailSalon();
    if (!context?.salon.id) return;

    const state = await fetchNailBillingState(context.salon.id);
    if (state && tenantRequiresPayment(state)) {
      redirect("/nail/billing");
    }
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    console.error("enforceNailSubscriptionIfRequired failed:", err);
  }
}
