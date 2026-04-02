import { redirect } from "next/navigation";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const context = await getCurrentUserSalon();
  if (context) redirect("/dashboard");

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
