import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/config/site";

export const metadata = {
  title: `Privacy Policy — ${SITE.name}`,
  description: `Privacy policy for ${SITE.name}. How we collect, use and protect your data.`,
};

export default function PolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div className="mt-8 space-y-6 text-zinc-600">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">1. Who we are</h2>
          <p>
            {SITE.name} is a product of {SITE.studio}. This policy explains how we collect, use and protect your personal data when you use our Service.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">2. Data we collect</h2>
          <p>
            We collect information you provide when signing up and using the Service, such as name, email address, business details, and appointment and client data you enter. We also collect technical data such as IP address and usage information.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">3. How we use your data</h2>
          <p>
            We use your data to provide and improve the Service, process payments, send service-related communications, and comply with legal obligations. We do not sell your personal data to third parties.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">4. Data sharing</h2>
          <p>
            We may share data with service providers (e.g. hosting, payment processing) who act on our instructions. We may disclose data where required by law.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">5. Data retention</h2>
          <p>
            We retain your data for as long as your account is active or as needed to provide the Service and fulfil the purposes described in this policy. You may request deletion of your data subject to legal and operational requirements.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">6. Security</h2>
          <p>
            We use appropriate technical and organisational measures to protect your data against unauthorised access, loss or alteration.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">7. Your rights</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, delete or port your data, or to object to or restrict certain processing. Contact us to exercise these rights.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">8. Cookies and similar technologies</h2>
          <p>
            We use cookies and similar technologies to operate the Service and improve your experience. You can manage cookie preferences in your browser.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">9. Changes</h2>
          <p>
            We may update this policy from time to time. We will indicate the last updated date at the top. Continued use of the Service after changes constitutes acceptance of the updated policy.
          </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mt-8 first:mt-0">10. Contact</h2>
          <p>
            For privacy-related questions or requests, please contact us at{" "}
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
