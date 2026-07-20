import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { HowItWorksVideoCard } from "@/components/marketing/how-it-works-video-card";
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer";
import { MarketingSiteHeader } from "@/components/marketing/marketing-site-header";
import { SALON_HOW_IT_WORKS_VIDEOS } from "@/config/how-it-works-videos";
import { SITE } from "@/config/site";

export const metadata = {
  title: `How it works — ${SITE.name}`,
  description:
    "Short walkthrough videos: shared diary, self-employed team, in-person payments, and online booking for UK salons.",
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <MarketingSiteHeader variant="static" activeNav="how-it-works" />

      <main className="pb-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14 pb-4">
          <Reveal>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              How SalonSynk works
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600">
              Short walkthroughs of the dashboard — no download, no signup required. See the shared diary, how
              self-employed teams work, and how in-person payments stay with each stylist.
            </p>
          </Reveal>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
          <Reveal>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {SALON_HOW_IT_WORKS_VIDEOS.map((video) => (
                <HowItWorksVideoCard key={video.id} video={video} />
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal>
          <section className="border-t border-zinc-200 bg-zinc-50/50 py-16 sm:py-20">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Ready to try it?</h2>
              <p className="mt-3 text-zinc-600">
                Request access or book a short demo — we&apos;ll answer any questions after you&apos;ve watched.
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-xl bg-black px-8 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
                >
                  Request access
                </Link>
                <a
                  href={`mailto:${SITE.email}?subject=Demo%20request`}
                  className="inline-flex items-center justify-center rounded-xl border-2 border-zinc-300 bg-white px-8 py-3.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
                >
                  Book a demo
                </a>
              </div>
            </div>
          </section>
        </Reveal>
      </main>

      <MarketingSiteFooter />
    </div>
  );
}
