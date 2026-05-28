import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { PLAN_TIERS, formatPlanPrice, isPlanTierId, type PlanTierId } from "@/config/plans";

export default async function AdminSalonsPage() {
  const supabase = createAdminClient();
  const { data: salons } = await supabase
    .from("salons")
    .select("id, name, slug, subscription_status, plan_tier, created_at, settings")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-muted hover:text-foreground text-sm">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Salons</h1>
        </div>
        <Link
          href="/admin/salons/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          Add salon
        </Link>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Slug</th>
              <th className="text-left px-4 py-2 font-medium">Public URLs</th>
              <th className="text-left px-4 py-2 font-medium">Plan</th>
              <th className="text-left px-4 py-2 font-medium">Billing</th>
              <th className="text-left px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(salons ?? []).map((s) => {
              const rawTier = (s as { plan_tier?: string }).plan_tier ?? "professional";
              const tier: PlanTierId = isPlanTierId(rawTier) ? rawTier : "professional";
              return (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2 font-mono text-muted">{s.slug}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-col gap-0.5">
                    <a
                      href={`/book/${s.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline font-mono text-xs"
                    >
                      /book/{s.slug}
                    </a>
                    <a
                      href={`/shop/${s.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline font-mono text-xs"
                    >
                      /shop/{s.slug}
                    </a>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span className="font-medium">{PLAN_TIERS[tier].label}</span>
                  <span className="block text-xs text-muted">{formatPlanPrice(tier)}</span>
                </td>
                <td className="px-4 py-2 capitalize">{s.subscription_status}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/api/admin/switch-salon?salonId=${s.id}`}
                    className="text-accent hover:underline mr-3"
                  >
                    Manage
                  </Link>
                  <Link
                    href={`/admin/salons/${s.id}`}
                    className="text-accent hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
