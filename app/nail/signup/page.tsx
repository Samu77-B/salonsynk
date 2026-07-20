import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { NAIL_SITE } from "@core/config/nail-site";
import { NailRequestForm } from "./nail-request-form";

const ACCENT = "#9B4B6A";
const TEXT_DARK = "#2D2A32";
const TEXT_MUTED = "#6B6560";
const BG_LIGHT = "#FAF7F5";

export const metadata: Metadata = {
  title: `Sign up — ${NAIL_SITE.name}`,
  description: `Request a ${NAIL_SITE.name} account. Walk-in queue management for nail bars, £25/mo.`,
};

export default async function NailSignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/nail/queue");

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6"
      style={{ backgroundColor: BG_LIGHT }}
    >
      <Reveal className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <Link href="/nail" className="inline-block mb-6">
            <span className="text-2xl font-bold tracking-tight" style={{ color: TEXT_DARK }}>
              {NAIL_SITE.name}
            </span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: TEXT_DARK }}>
            Request an account
          </h1>
          <p className="text-sm mt-1" style={{ color: TEXT_MUTED }}>
            Tell us about your salon — we&apos;ll get you set up and email you when you can sign in.
          </p>
        </div>
        <NailRequestForm />
        <p className="text-center text-sm" style={{ color: TEXT_MUTED }}>
          Already have an account?{" "}
          <Link href="/nail/login" className="font-medium hover:underline" style={{ color: ACCENT }}>
            Sign in
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
