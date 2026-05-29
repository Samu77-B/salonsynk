import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { HomeOutcomesSection } from "@/components/marketing/home-outcomes-section";
import { PricingPlansSection } from "@/components/marketing/pricing-plans-section";
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer";
import { MarketingSiteHeader } from "@/components/marketing/marketing-site-header";
import { SITE } from "@/config/site";
import { formatPlanPrice } from "@/config/plans";
// Bundled so the hero image and logo are always available in the build
import heroImage from "../imgs/hero01.png";
import plansImage from "../imgs/plans_img_01.jpg";
import featureDiary from "../imgs/one_dairy.png";
import featureTeam from "../imgs/team.png";
import featureOnline from "../imgs/online.png";
import featureCom from "../imgs/com.png";

const FEATURES = [
  {
    title: "One diary",
    description: "See your whole team’s appointments in one place. No more double-booking or messy spreadsheets.",
    image: featureDiary,
    alt: "Calendar - one diary",
  },
  {
    title: "Your team, your clients",
    description: "Add stylists, manage clients, and keep colour formulas and notes in one system.",
    image: featureTeam,
    alt: "Team and clients",
  },
  {
    title: "Online booking",
    description: "Let clients book 24/7 via your branded booking page. Seamless from your website.",
    image: featureOnline,
    alt: "Online booking",
  },
  {
    title: "No commissions",
    description: "Plans from £29/mo. No per-booking cuts — you keep what you earn.",
    image: featureCom,
    alt: "No commissions - flat fee",
  },
];

const FAQ_ITEMS = [
  {
    q: "How much does SalonSynk cost?",
    a: `We offer three plans per salon: Essentials (${formatPlanPrice("essentials")}), Professional (${formatPlanPrice("professional")}), and Complete (${formatPlanPrice("complete")}). There are no per-booking commissions — you keep 100% of what you take. Your plan is chosen to match the features you need.`,
  },
  {
    q: "Can clients book online?",
    a: "Yes. Each salon gets a unique booking page (e.g. salonsynk.com/book/your-salon) that you can link from your website. Clients pick a service, stylist, and time.",
  },
  {
    q: "Do I need to connect Stripe?",
    a: "Stripe is optional. You can use SalonSynk for diary and bookings without it. Connect Stripe when you want to take deposits or in-salon payments.",
  },
  {
    q: "Is it just for UK salons?",
    a: "We’re built with UK salons and barbers in mind, but the product works anywhere. Pricing is in GBP.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <MarketingSiteHeader variant="fixed" activeNav="home" />

      <main>
        {/* Hero – full width, 100vh */}
        <section className="relative w-full h-[100vh] min-h-[400px] overflow-hidden">
          <Image
            src={heroImage}
            alt="Modern salon with appointment booking"
            fill
            className="object-cover"
            priority
            unoptimized
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center px-4 sm:px-6 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl drop-shadow-lg">
              No commissions.
              <br />
              <span className="text-[#F5F5F5]">Just Synk.</span>
            </h1>
            <p className="mt-4 text-lg text-white/95 max-w-xl drop-shadow-md">
              Salon management from {formatPlanPrice("essentials")}. One diary, your team, your clients — no
              per-booking commissions.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl bg-black px-6 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-zinc-800 transition-colors"
              >
                Request access
              </Link>
              <a
                href="#book-demo"
                className="inline-flex items-center justify-center rounded-xl border-2 border-white bg-white/10 backdrop-blur px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              >
                Book a demo
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <Reveal>
          <section className="border-t border-zinc-200 bg-zinc-50/50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-zinc-900 text-center sm:text-3xl">
              Everything you need to run your salon
            </h2>
            <p className="mt-3 text-center text-zinc-600 max-w-2xl mx-auto">
              One simple system for your diary, team, clients, and online booking.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-[#C0C0C0] transition-all"
                >
                  <div className="relative h-14 w-14 shrink-0">
                    <Image
                      src={f.image}
                      alt={f.alt}
                      fill
                      className="object-contain object-left"
                      sizes="56px"
                    />
                  </div>
                  <h3 className="mt-4 font-semibold text-zinc-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        </Reveal>

        <HomeOutcomesSection />

        {/* Pricing */}
        <Reveal>
          <section className="bg-[#E0E0E0] py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <PricingPlansSection
                image={plansImage}
                imageAlt="Professional barber attending to a client in a modern barbershop"
              />
            </div>
          </section>
        </Reveal>

        {/* FAQ */}
        <Reveal>
          <section className="border-t border-zinc-200 bg-zinc-50/50 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-zinc-900 text-center sm:text-3xl">
              Frequently asked questions
            </h2>
            <dl className="mt-10 space-y-6">
              {FAQ_ITEMS.map((item) => (
                <div
                  key={item.q}
                  className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6"
                >
                  <dt className="font-semibold text-zinc-900">{item.q}</dt>
                  <dd className="mt-2 text-sm text-zinc-600 leading-relaxed">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        </Reveal>

        {/* Book a demo CTA */}
        <Reveal>
          <section id="book-demo" className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
            <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
              See SalonSynk in action
            </h2>
            <p className="mt-3 text-zinc-600">
              Book a short demo and we’ll walk you through the diary, bookings,
              and how to get started.
            </p>
            <a
              href={`mailto:${SITE.email}?subject=Demo%20request`}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-black px-8 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
            >
              Book a demo
            </a>
          </div>
        </section>
        </Reveal>

        <MarketingSiteFooter />
      </main>
    </div>
  );
}