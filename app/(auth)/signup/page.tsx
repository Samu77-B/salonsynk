import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { RequestAccountForm } from "./request-account-form";
import { FirstMonthFree } from "@/components/marketing/first-month-free";
import { planTierFromQuery } from "@/config/plans";
import siteLogo from "../../../salonsynk_logo.png";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const initialPlanTier = planTierFromQuery(plan);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6">
      <Reveal className="w-full max-w-lg space-y-8">
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
          <h1 className="text-2xl font-bold">Request an account</h1>
          <FirstMonthFree className="mt-2 text-zinc-800" />
          <p className="text-muted text-sm mt-1">
            Tell us about your salon — we’ll set you up and email you when you can sign in.
          </p>
        </div>
        <RequestAccountForm initialPlanTier={initialPlanTier} />
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
