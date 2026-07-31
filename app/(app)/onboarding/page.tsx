import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { resolveUserPlatform } from "@core/auth/resolve-user-platform";
import { resolveAuthNextPath, resolveProductFromHost } from "@/lib/platform-host";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const host = (await headers()).get("host") ?? "";
  const product = resolveProductFromHost(host);
  const context = await getCurrentUserSalon();

  if (context) {
    redirect(resolveAuthNextPath(product, "/dashboard"));
  }

  if (product === "barber") redirect("/barber/access");
  if (product === "nail") redirect("/nail/onboarding");

  // A barber/nail owner can land here from a stale link; send them to their own product.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const resolution = await resolveUserPlatform(user.id);
    const otherPlatform = resolution.memberships.find(
      (m) => m.platform === "barber" || m.platform === "nail"
    );
    if (otherPlatform) redirect(otherPlatform.dashboardUrl);
  }

  return (
    <main className="flex min-h-[70vh] w-full min-w-0 flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full min-w-0 max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Set up your salon</h1>
          <p className="text-muted text-sm mt-1">Get started in a few steps</p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  );
}
