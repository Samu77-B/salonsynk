import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { hasQueueManagerAccess } from "@core/queue/platform-queue-access";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { BarberServicesView } from "./barber-services-view";

export const dynamic = "force-dynamic";

export default async function BarberServicesPage() {
  const context = await getCurrentUserShop();
  if (!context) redirect("/barber/access");

  const isSuperAdmin = await getIsSuperAdmin();
  const canManage = hasQueueManagerAccess(
    isSuperAdmin,
    context.member.role ?? "",
    context.member.id
  );
  if (!canManage) redirect("/barber/dashboard");

  const admin = createAdminClient();
  const [servicesRes, categoriesRes] = await Promise.all([
    admin
      .from("barber_services")
      .select("id, name, duration_minutes, price_minor, sort_order, category_id")
      .eq("shop_id", context.shop.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    admin
      .from("barber_service_categories")
      .select("id, name, sort_order")
      .eq("shop_id", context.shop.id)
      .order("sort_order")
      .order("name"),
  ]);

  const dbError = servicesRes.error?.message ?? categoriesRes.error?.message;

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
            className="text-foreground hover:underline"
          >
            public queue page
          </a>
          . Optional categories group them into headings.
        </p>
      </div>

      {dbError && (
        <p className="rounded border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          Database error: {dbError}
        </p>
      )}

      <BarberServicesView
        services={JSON.parse(JSON.stringify(servicesRes.data ?? []))}
        categories={JSON.parse(JSON.stringify(categoriesRes.data ?? []))}
      />
    </div>
  );
}
