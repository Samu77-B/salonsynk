import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { formatFlatFee } from "@/config/subscription";
import { OUTCOME_GROUPS, INCLUDED_IN_PLAN, UK_REASSURANCE_LEAD } from "@/config/features-marketing";

export function HomeOutcomesSection() {
  const flat = formatFlatFee();
  return (
    <Reveal>
      <section className="border-t border-zinc-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-zinc-900 text-center sm:text-3xl">
            Built around how your salon actually runs
          </h2>
          <p className="mt-3 text-center text-zinc-600 max-w-2xl mx-auto text-sm sm:text-base">
            Four areas we focus on — so you spend less time on admin and more time with clients.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {OUTCOME_GROUPS.map((group) => (
              <div
                key={group.title}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 shadow-sm"
              >
                <h3 className="font-semibold text-zinc-900">{group.title}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-zinc-600 leading-relaxed">
                  {group.bulletsHome.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="text-[#808080] shrink-0">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 max-w-xl mx-auto rounded-2xl border-2 border-[#C0C0C0] bg-[#F5F5F5] px-6 py-6 sm:px-8 sm:py-8">
            <h3 className="text-center font-semibold text-zinc-900">
              What&apos;s included in {flat}
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-zinc-700">
              {INCLUDED_IN_PLAN.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#808080] shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-8 text-center text-sm text-zinc-600 max-w-2xl mx-auto leading-relaxed">
            {UK_REASSURANCE_LEAD}{" "}
            <Link href="/policy" className="text-zinc-900 underline underline-offset-2 hover:text-zinc-700">
              Privacy policy
            </Link>{" "}
            for how we handle data.
          </p>

          <p className="mt-6 text-center">
            <Link
              href="/features"
              className="text-sm font-semibold text-zinc-900 underline underline-offset-4 decoration-zinc-400 hover:decoration-zinc-900"
            >
              View full feature list →
            </Link>
          </p>
        </div>
      </section>
    </Reveal>
  );
}
