import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { NAIL_SITE } from "@core/config/nail-site";
import { NailLoginForm } from "./nail-login-form";
import { SmartSynkLoginBanner } from "@/components/smart/smart-synk-login-banner";

const ACCENT = "#9B4B6A";
const TEXT_DARK = "#2D2A32";
const TEXT_MUTED = "#6B6560";
const BG_LIGHT = "#FAF7F5";

export const metadata: Metadata = {
  title: `Sign in — ${NAIL_SITE.name}`,
  description: `Sign in to your ${NAIL_SITE.name} account.`,
};

export default async function NailLoginPage() {
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
      <Reveal className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/nail" className="inline-block mb-6">
            <span className="text-2xl font-bold tracking-tight" style={{ color: TEXT_DARK }}>
              {NAIL_SITE.name}
            </span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: TEXT_DARK }}>Sign in</h1>
          <p className="text-sm mt-1" style={{ color: TEXT_MUTED }}>
            Welcome back to {NAIL_SITE.name}
          </p>
        </div>
        <SmartSynkLoginBanner from="nail" />
        <NailLoginForm />
        <p className="text-center text-sm" style={{ color: TEXT_MUTED }}>
          Need an account?{" "}
          <Link href="/nail/signup" className="font-medium hover:underline" style={{ color: ACCENT }}>
            Request access
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
