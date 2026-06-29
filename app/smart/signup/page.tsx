import Link from "next/link";
import Image from "next/image";
import { SMART_SITE, SMART_PLATFORMS } from "@core/config/smart-site";

export default function SmartSignupPage() {
  return (
    <main className="smart-marketing flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-lg space-y-8 text-center">
        <Link href="/">
          <Image
            src="/imgs/smart/logo.png"
            alt={SMART_SITE.name}
            width={80}
            height={80}
            className="mx-auto h-16 w-16 object-contain"
          />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold">Request an account</h1>
          <p className="mt-2 text-sm text-muted">
            Choose your platform to request access. We&apos;ll set you up and email you when you can sign in.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SMART_PLATFORMS.map((p) => (
            <Link
              key={p.id}
              href={`${p.url}/signup`}
              className="smart-glass rounded-xl p-4 text-sm font-medium hover:border-accent/30 transition-colors"
              style={{ borderColor: `${p.color}40` }}
            >
              {p.name}
            </Link>
          ))}
        </div>
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
