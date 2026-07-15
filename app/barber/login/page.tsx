import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { BarberLoginForm } from "./barber-login-form";
import { SmartSynkLoginBanner } from "@/components/smart/smart-synk-login-banner";
/* eslint-disable @next/next/no-img-element */

export const metadata: Metadata = {
  title: "Sign in — BarberSynk",
  description: "Sign in to your BarberSynk account.",
};

export default async function BarberLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/barber/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6" style={{ backgroundColor: "#F5F1E8" }}>
      <Reveal className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/barber" className="inline-block mb-6">
            <img
              src="/imgs/barber/barbersynk-icon.png"
              alt="BarberSynk"
              className="mx-auto h-12 w-auto md:hidden"
            />
            <img
              src="/imgs/barber/barbersynk-logo.png"
              alt="BarberSynk"
              className="mx-auto hidden h-12 w-auto max-w-[min(100%,18rem)] md:block sm:h-14"
            />
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: "#36454F" }}>Sign in</h1>
          <p className="text-sm mt-1" style={{ color: "#5a6a74" }}>Welcome back to BarberSynk</p>
        </div>
        <SmartSynkLoginBanner from="barber" />
        <BarberLoginForm />
        <p className="text-center text-sm" style={{ color: "#5a6a74" }}>
          Need an account?{" "}
          <Link href="/barber/signup" className="font-medium hover:underline" style={{ color: "#A0522D" }}>
            Request access
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
