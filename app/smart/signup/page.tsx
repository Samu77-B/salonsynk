import Link from "next/link";
import { SMART_PLATFORMS } from "@core/config/smart-site";
import { SmartSynkLogo } from "@/components/smart/smart-synk-logo";
import { PlatformIcon } from "@/components/smart/marketing/platform-icons";
import { FirstMonthFree } from "@/components/marketing/first-month-free";

export default function SmartSignupPage() {
  return (
    <main className="smart-marketing flex min-h-screen flex-col items-center justify-center bg-white px-4 text-zinc-900">
      <div className="w-full max-w-lg space-y-8 text-center">
        <SmartSynkLogo variant="centered" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Request an account</h1>
          <FirstMonthFree className="mt-2 text-zinc-800" />
          <p className="mt-2 text-sm text-zinc-600">
            Choose your platform to request access. We&apos;ll set you up and email you when you can sign in.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SMART_PLATFORMS.map((p) => (
            <Link
              key={p.id}
              href={p.id === "paysynk" ? p.url : `${p.url}/signup`}
              className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: "rgba(255,107,44,0.15)", color: "#FF6B2C" }}
              >
                <PlatformIcon platform={p.id} className="h-5 w-5" />
              </div>
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
