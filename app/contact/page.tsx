import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/config/site";

export const metadata = {
  title: `Contact — ${SITE.name}`,
  description: `Get in touch with ${SITE.name}. Email us at ${SITE.email}.`,
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200/80 bg-white">
        <div className="flex h-20 w-full items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/synk-logo2.gif"
              alt={SITE.name}
              width={560}
              height={160}
              className="h-14 w-auto sm:h-16"
              sizes="(min-width: 640px) 128px, 112px"
              quality={95}
            />
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors shrink-0"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
          Contact us
        </h1>
        <p className="mt-4 text-zinc-600">
          Have a question, want a demo, or need support? Get in touch and we’ll get back to you as soon as we can.
        </p>
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 sm:p-8">
          <p className="text-sm font-medium text-zinc-500">Email</p>
          <a
            href={`mailto:${SITE.email}`}
            className="mt-1 block text-lg font-medium text-zinc-900 hover:text-zinc-700 underline underline-offset-2"
          >
            {SITE.email}
          </a>
          <p className="mt-6 text-sm text-zinc-600">
            For demo requests, include “Demo request” in the subject line. For general enquiries or support, just drop us a line.
          </p>
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-[#E0E0E0] py-8 mt-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-medium text-zinc-600">{SITE.name}</span>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/contact" className="text-zinc-600 hover:text-zinc-900">
              Contact
            </Link>
            <Link href="/terms" className="text-zinc-600 hover:text-zinc-900">
              Terms
            </Link>
            <Link href="/policy" className="text-zinc-600 hover:text-zinc-900">
              Privacy
            </Link>
            <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
