import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { BarberLoginForm } from "./barber-login-form";
import logoImage from "../../../imgs/barber/logo.png";

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
            <Image
              src={logoImage}
              alt="BarberSynk"
              width={560}
              height={160}
              className="mx-auto h-16 w-auto sm:h-20"
              unoptimized
              priority
            />
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: "#36454F" }}>Sign in</h1>
          <p className="text-sm mt-1" style={{ color: "#5a6a74" }}>Welcome back to BarberSynk</p>
        </div>
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
