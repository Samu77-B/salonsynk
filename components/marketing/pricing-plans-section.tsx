import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import {
  ALL_PLANS_INCLUDE,
  PLAN_MARKETING_BULLETS,
  PLAN_TIER_ORDER,
  PLAN_TIERS,
  formatPlanPrice,
  type PlanTierId,
} from "@/config/plans";

export function PricingPlansSection({
  image,
  imageAlt = "Salon professional at work",
}: {
  image?: StaticImageData;
  imageAlt?: string;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-zinc-900 text-center sm:text-3xl">
        Simple, transparent pricing
      </h2>
      <p className="mt-3 text-center text-zinc-600 max-w-2xl mx-auto">
        Choose the plan that fits how you run your salon. No per-booking commissions — cancel anytime.
      </p>

      <div className="mt-12 flex flex-col lg:flex-row items-stretch gap-8 lg:gap-10">
        {image && (
          <div className="relative w-full lg:max-w-sm min-h-[240px] lg:min-h-[420px] rounded-2xl overflow-hidden border border-zinc-200 shadow-md shrink-0">
            <Image src={image} alt={imageAlt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 384px" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="grid gap-6 md:grid-cols-3">
            {PLAN_TIER_ORDER.map((tierId) => (
              <PlanCard key={tierId} tierId={tierId} highlighted={tierId === "professional"} />
            ))}
          </div>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-600">
            {ALL_PLANS_INCLUDE.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <span className="text-[#808080]">✓</span>
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-xs text-zinc-500 max-w-xl mx-auto">
            Your plan is assigned when you join. Stripe is optional for in-salon payments on plans that include
            checkout.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ tierId, highlighted }: { tierId: PlanTierId; highlighted?: boolean }) {
  const tier = PLAN_TIERS[tierId];
  const bullets = PLAN_MARKETING_BULLETS[tierId];

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-[#F5F5F5] p-6 sm:p-7 ${
        highlighted ? "border-2 border-zinc-900 shadow-lg md:-mt-1 md:mb-1" : "border-zinc-200 shadow-sm"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-bold text-zinc-900">{tier.label}</h3>
      <p className="mt-1 text-sm text-zinc-600">{tier.tagline}</p>
      <p className="mt-4 text-3xl font-bold text-zinc-900 sm:text-4xl">{formatPlanPrice(tierId)}</p>
      <p className="text-sm text-zinc-600">per salon, per month</p>
      <ul className="mt-5 flex-1 space-y-2 text-sm text-zinc-700">
        {bullets.map((line) => (
          <li key={line} className="flex items-start gap-2">
            <span className="text-[#808080] shrink-0 mt-0.5">✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
          highlighted
            ? "bg-black text-white hover:bg-zinc-800"
            : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
        }`}
      >
        Request access
      </Link>
    </div>
  );
}
