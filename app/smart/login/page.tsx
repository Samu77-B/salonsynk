import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SmartLoginForm } from "./smart-login-form";
import { SMART_SITE } from "@core/config/smart-site";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
/* eslint-disable @next/next/no-img-element */

export default async function SmartLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const isSuperAdmin = await getIsSuperAdmin();
    if (isSuperAdmin) redirect("/smart/overview");
  }

  return (
    <main className="smart-marketing flex min-h-screen flex-col items-center justify-center bg-white px-4 text-zinc-900">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block mb-6">
            <img
              src={SMART_SITE.icon}
              alt={SMART_SITE.name}
              className="mx-auto h-12 w-auto object-contain md:hidden"
            />
            <img
              src={SMART_SITE.logo}
              alt={SMART_SITE.name}
              className="mx-auto hidden h-12 w-auto object-contain md:block sm:h-14"
            />
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">Sign in to {SMART_SITE.name}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            One login for SalonSynk, BarberSynk, and NailSynk
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-zinc-500 text-center">Loading…</p>}>
          <SmartLoginForm />
        </Suspense>
        <p className="text-center text-sm text-zinc-600">
          Need an account?{" "}
          <Link href="/signup" className="font-medium text-[#FF6B2C] hover:underline">
            Request access
          </Link>
        </p>
      </div>
    </main>
  );
}
