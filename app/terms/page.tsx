import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/config/site";

export const metadata = {
  title: `Terms and Conditions — ${SITE.name}`,
  description: `Terms and conditions of use for ${SITE.name}.`,
};

export default function TermsPage() {
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

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
          Terms and Conditions
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div className="mt-8 space-y-6 text-zinc-600">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">1. Agreement to terms</h2>
          <p>
            By accessing or using {SITE.name} (“the Service”), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the Service.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">2. Use of the Service</h2>
          <p>
            You may use the Service only for lawful purposes and in accordance with these terms. You are responsible for maintaining the confidentiality of your account and for all activity under your account.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">3. Subscription and payment</h2>
          <p>
            Subscription fees are charged in advance on a monthly basis. You may cancel at any time. Refunds are handled in accordance with our cancellation policy.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">4. Acceptable use</h2>
          <p>
            You must not use the Service to violate any applicable law, infringe others’ rights, or transmit harmful or offensive content. We may suspend or terminate access for breach of these terms.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">5. Intellectual property</h2>
          <p>
            The Service and its content (excluding your data) are owned by us or our licensors. You retain ownership of your data and grant us a licence to use it to provide the Service.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">6. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">7. Changes</h2>
          <p>
            We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated terms.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">8. Contact</h2>
          <p>
            For questions about these Terms and Conditions, please contact us at{" "}
            <a href={`mailto:${SITE.email}`} className="text-zinc-900 underline underline-offset-2 hover:text-zinc-700">{SITE.email}</a> or visit {SITE.url}.
          </p>
          </section>
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
