import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { NAIL_SITE } from "@core/config/nail-site";

export default async function NailSettingsPage() {
  const context = await getCurrentUserNailSalon();
  if (!context) redirect("/nail/login");

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-sm text-muted">
        Manage your {NAIL_SITE.name} salon. Service prices, categories, and colours are configured under Services.
      </p>

      <section className="rounded-xl border border-border bg-background/60 p-5 space-y-4">
        <h2 className="text-base font-semibold">Salon</h2>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-muted">Name</dt>
            <dd className="font-medium">{context.salon.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Booking link</dt>
            <dd>
              <Link href={`/nail/book/${context.salon.slug}`} className="text-accent hover:underline">
                /nail/book/{context.salon.slug}
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-background/60 p-5 space-y-3">
        <h2 className="text-base font-semibold">Configuration</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/nail/services" className="text-accent hover:underline font-medium">
              Services &amp; categories
            </Link>
            <span className="text-muted"> — treatments, durations, and pricing</span>
          </li>
          <li>
            <Link href="/nail/team" className="text-accent hover:underline font-medium">
              Team
            </Link>
            <span className="text-muted"> — technicians, roles, and diary visibility</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
