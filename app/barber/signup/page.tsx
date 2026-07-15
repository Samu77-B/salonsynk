import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { BarberRequestForm } from "./barber-request-form";
/* eslint-disable @next/next/no-img-element */

export const metadata: Metadata = {
  title: "Sign up — BarberSynk",
  description: "Request a BarberSynk account. Queue management for barber shops, £25/mo.",
};

export default async function BarberSignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/barber/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6" style={{ backgroundColor: "#F5F1E8" }}>
      <Reveal className="w-full max-w-lg space-y-8">
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
          <h1 className="text-2xl font-bold" style={{ color: "#36454F" }}>
            Request an account
          </h1>
          <p className="text-sm mt-1" style={{ color: "#5a6a74" }}>
            Tell us about your shop — we&apos;ll get you set up and email you when you can sign in.
          </p>
        </div>
        <BarberRequestForm />
        <p className="text-center text-sm" style={{ color: "#5a6a74" }}>
          Already have an account?{" "}
          <Link href="/barber/login" className="font-medium hover:underline" style={{ color: "#A0522D" }}>
            Sign in
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
