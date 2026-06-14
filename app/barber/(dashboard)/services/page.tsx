import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { BarberServicesView } from "./barber-services-view";

export const dynamic = "force-dynamic";

export default async function BarberServicesPage() {
  const context = await getCurrentUserShop();
  if (!context) redirect("/onboarding");

  const isOwner = context.member.role === "owner" || context.member.id === "admin";
  if (!isOwner) redirect("/barber/dashboard");

  const admin = createAdminClient();
  const { data: services } = await admin
    .from("barber_services")
    .select("id, name, duration_minutes, price_minor, sort_order")
    .eq("shop_id", context.shop.id)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/barber/dashboard" className="text-sm text-muted hover:text-foreground">
          ← Live queue
        </Link>
        <h1 className="text-xl font-bold mt-1">Services</h1>
        <p className="text-sm text-muted mt-1">
          Manage the cuts and treatments customers can pick on your{" "}
          <a
            href={`/barber/join/${context.shop.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            public queue page
          </a>
          .
        </p>
      </div>

      <BarberServicesView services={JSON.parse(JSON.stringify(services ?? []))} />
    </div>
  );
}
