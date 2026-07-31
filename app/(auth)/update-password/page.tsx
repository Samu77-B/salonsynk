import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { Reveal } from "@/components/reveal";
import { UpdatePasswordForm } from "./update-password-form";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";
import { DEFAULT_DASHBOARD_PATH, resolveProductFromHost } from "@/lib/platform-host";
import siteLogo from "../../../salonsynk_logo.png";
/* eslint-disable @next/next/no-img-element */

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=auth");
  }

  const host = (await headers()).get("host") ?? "";
  const product = resolveProductFromHost(host);
  const defaultNext = DEFAULT_DASHBOARD_PATH[product];

  const barberStyles = {
    bg: "#F5F1E8",
    heading: "#36454F",
    muted: "#5a6a74",
    accent: "#A0522D",
  };

  const nailStyles = {
    bg: "#FAF7F5",
    heading: "#2D2A32",
    muted: "#6B6560",
    accent: "#9B4B6A",
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6"
      style={
        product === "barber"
          ? { backgroundColor: barberStyles.bg }
          : product === "nail"
            ? { backgroundColor: nailStyles.bg }
            : undefined
      }
    >
      <Reveal className="w-full max-w-sm space-y-8">
        <div className="text-center">
          {product === "barber" ? (
            <Link href="/barber" className="inline-block mb-6">
              <img
                src="/imgs/barber/barbersynk-icon-v5.png"
                alt={BARBER_SITE.name}
                className="mx-auto h-12 w-auto md:hidden"
              />
              <img
                src="/imgs/barber/barbersynk-logo-v5.png"
                alt={BARBER_SITE.name}
                className="mx-auto hidden h-12 w-auto max-w-[min(100%,18rem)] md:block sm:h-14"
              />
            </Link>
          ) : product === "nail" ? (
            <Link href="/nail" className="inline-block mb-6">
              <span
                className="text-2xl font-bold tracking-tight"
                style={{ color: nailStyles.heading }}
              >
                {NAIL_SITE.name}
              </span>
            </Link>
          ) : (
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
          )}
          <h1
            className="text-2xl font-bold"
            style={
              product === "barber"
                ? { color: barberStyles.heading }
                : product === "nail"
                  ? { color: nailStyles.heading }
                  : undefined
            }
          >
            Set your password
          </h1>
          <p
            className="text-sm mt-1"
            style={
              product === "barber"
                ? { color: barberStyles.muted }
                : product === "nail"
                  ? { color: nailStyles.muted }
                  : { color: "var(--muted)" }
            }
          >
            Choose a new password for {user.email ?? "your account"} to finish setting up your
            login.
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <UpdatePasswordForm
            defaultNext={defaultNext}
            accentColor={
              product === "barber" ? barberStyles.accent : product === "nail" ? nailStyles.accent : undefined
            }
          />
        </Suspense>
      </Reveal>
    </main>
  );
}
