import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SmartLoginForm } from "./smart-login-form";
import { SMART_SITE } from "@core/config/smart-site";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";

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
    <main className="smart-marketing flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block mb-6">
            <Image
              src="/imgs/smart/logo.png"
              alt={SMART_SITE.name}
              width={80}
              height={80}
              className="mx-auto h-16 w-16 object-contain"
            />
          </Link>
          <h1 className="font-heading text-2xl font-bold">Sign in to {SMART_SITE.name}</h1>
          <p className="mt-2 text-sm text-muted">
            One login for SalonSynk, BarberSynk, and NailSynk
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted text-center">Loading…</p>}>
          <SmartLoginForm />
        </Suspense>
        <p className="text-center text-sm text-muted">
          Need an account?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Request access
          </Link>
        </p>
      </div>
    </main>
  );
}
