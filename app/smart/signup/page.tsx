import Link from "next/link";
import { SMART_SITE, SMART_PLATFORMS } from "@core/config/smart-site";
/* eslint-disable @next/next/no-img-element */

export default function SmartSignupPage() {
  return (
    <main className="smart-marketing flex min-h-screen flex-col items-center justify-center bg-white px-4 text-zinc-900">
      <div className="w-full max-w-lg space-y-8 text-center">
        <Link href="/">
          <img
            src={SMART_SITE.icon}
            alt={SMART_SITE.name}
            className="mx-auto h-12 w-auto md:hidden"
          />
          <img
            src={SMART_SITE.logo}
            alt={SMART_SITE.name}
            className="mx-auto hidden h-12 w-auto max-w-[min(100%,18rem)] md:block sm:h-14"
          />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Request an account</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Choose your platform to request access. We&apos;ll set you up and email you when you can sign in.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SMART_PLATFORMS.map((p) => (
            <Link
              key={p.id}
              href={`${p.url}/signup`}
              className="rounded-lg border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              {p.name}
            </Link>
          ))}
        </div>
        <p className="text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#FF6B2C] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
