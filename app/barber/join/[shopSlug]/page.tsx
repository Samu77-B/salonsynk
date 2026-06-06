import { notFound } from "next/navigation";
import { createAdminClient } from "@core/supabase/admin";
import { JoinQueueForm } from "./join-queue-form";

export const dynamic = "force-dynamic";

export default async function PublicJoinQueuePage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    notFound();
  }

  const { data: shop } = await supabase
    .from("barber_shops")
    .select("id, name, slug, estimated_wait_visible")
    .eq("slug", shopSlug)
    .single();

  if (!shop) notFound();

  const [servicesResult, barbersResult, queueCountResult] = await Promise.all([
    supabase
      .from("barber_services")
      .select("id, name, duration_minutes, price_minor")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),

    supabase
      .from("barber_members")
      .select("id, display_name, chair_number")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .eq("is_accepting_walk_ins", true)
      .order("display_name"),

    supabase
      .from("barber_queue")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .eq("status", "waiting"),
  ]);

  const services = (servicesResult.data ?? []) as {
    id: string; name: string; duration_minutes: number; price_minor: number;
  }[];
  const barbers = (barbersResult.data ?? []) as {
    id: string; display_name: string | null; chair_number: number | null;
  }[];
  const queueLength = queueCountResult.count ?? 0;

  return (
    <div className="app-shell-dark min-h-screen bg-canvas text-foreground">
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        <header className="text-center mb-8">
          <h1 className="text-2xl font-bold">{shop.name}</h1>
          <p className="text-sm text-muted mt-1">Walk-in Queue</p>
        </header>

        <JoinQueueForm
          shopId={shop.id}
          shopName={shop.name}
          queueLength={queueLength}
          barbers={JSON.parse(JSON.stringify(barbers))}
          services={JSON.parse(JSON.stringify(services))}
        />
      </div>
    </div>
  );
}
