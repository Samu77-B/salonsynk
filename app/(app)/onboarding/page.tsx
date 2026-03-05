import { redirect } from "next/navigation";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const context = await getCurrentUserSalon();
  if (context) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Set up your salon</h1>
          <p className="text-muted text-sm mt-1">Get started in a few steps</p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  );
}
