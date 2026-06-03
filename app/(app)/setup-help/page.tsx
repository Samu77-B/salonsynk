import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { fetchSalonOnboardingState, salonSubscriptionIsActive } from "@/lib/onboarding";
import { SetupHelpForm } from "./setup-help-form";

export default async function SetupHelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const state = await fetchSalonOnboardingState(context.salon.id);
  if (state && !salonSubscriptionIsActive(state.subscription_status)) {
    redirect("/billing");
  }

  const isOwner = (context.member.role ?? "").toLowerCase() === "owner";
  if (!isOwner) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-lg py-8">
      <h1 className="text-2xl font-bold mb-2">Salon setup help</h1>
      <p className="text-muted text-sm mb-6">
        Our team can configure your staff, services, products, and price lists. We&apos;ll confirm the
        exact price before starting — typically from £60 when you have everything ready, or from £120 if
        we need to help gather your menus.
      </p>
      <SetupHelpForm salonName={context.salon.name} />
    </div>
  );
}
