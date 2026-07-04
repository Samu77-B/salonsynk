import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { UpdatePasswordForm } from "./update-password-form";
import siteLogo from "../../../salonsynk_logo.png";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=auth");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6">
      <Reveal className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block mb-6">
            <Image
              src={siteLogo}
              alt="SalonSynk"
              width={560}
              height={160}
              className="mx-auto h-16 w-auto sm:h-20 md:h-24"
              sizes="(max-width: 768px) 128px, (max-width: 1024px) 160px, 192px"
              quality={95}
              priority
            />
          </Link>
          <h1 className="text-2xl font-bold">Set your password</h1>
          <p className="text-muted text-sm mt-1">
            Choose a new password for {user.email ?? "your account"} to finish setting up your login.
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <UpdatePasswordForm />
        </Suspense>
      </Reveal>
    </main>
  );
}
