import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { NailServicesView } from "./nail-services-view";

export const dynamic = "force-dynamic";

export default async function NailServicesPage() {
  const context = await getCurrentUserNailSalon();
  if (!context) redirect("/onboarding");

  const isOwner = context.member.role === "owner" || context.member.id === "admin";
  if (!isOwner) redirect("/nail/queue");

  const admin = createAdminClient();

  const [servicesRes, categoriesRes] = await Promise.all([
    admin
      .from("nail_services")
      .select(
        "id, name, duration_minutes, price_minor, processing_time_minutes, description, color, category_id, sort_order"
      )
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    admin
      .from("nail_service_categories")
      .select("id, name, sort_order, color")
      .eq("salon_id", context.salon.id)
      .order("sort_order")
      .order("name"),
  ]);

  const dbError = servicesRes.error?.message ?? categoriesRes.error?.message;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/nail/queue" className="text-sm text-muted hover:text-foreground">
          ← Live queue
        </Link>
        <h1 className="text-xl font-bold mt-1">Services</h1>
        <p className="text-sm text-muted mt-1">
          Manage treatments shown on the walk-in{" "}
          <a
            href={`/nail/join/${context.salon.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            join page
          </a>
          .
        </p>
      </div>

      {dbError && (
        <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          Database error: {dbError}
        </p>
      )}

      <NailServicesView
        salonId={context.salon.id}
        canManageServices={isOwner}
        services={JSON.parse(JSON.stringify(servicesRes.data ?? []))}
        categories={JSON.parse(JSON.stringify(categoriesRes.data ?? []))}
      />
    </div>
  );
}
