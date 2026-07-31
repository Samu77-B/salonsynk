import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { createAdminClient } from "@core/supabase/admin";
import { ShopClientPortal } from "./shop-client-portal";

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
    .select("id, name, slug, estimated_wait_visible, settings")
    .eq("slug", shopSlug)
    .single();

  if (!shop) notFound();

  const settings = (shop.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | boolean | undefined>) ?? {};
  const brandingStr = (key: string) => {
    const v = branding[key];
    return typeof v === "string" ? v : "";
  };
  const displayName = brandingStr("company_name").trim() || shop.name;
  const primaryColor = brandingStr("primary_color").trim();
  const logoUrl = brandingStr("logo_url").trim();
  const showTitle = branding.show_title_on_queue !== false;
  const nextAvailableOnly = branding.next_available_only === true;
  const showServicesOnQueue = branding.show_services_on_queue !== false;

  const [servicesResult, walkInBarbersResult, queueCountResult] = await Promise.all([
    supabase
      .from("barber_services")
      .select("id, name, duration_minutes, price_minor")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),

    supabase
      .from("barber_members")
      .select("id, display_name, chair_number, avatar_url, role")
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
  const walkInBarbers = (walkInBarbersResult.data ?? []) as {
    id: string; display_name: string | null; chair_number: number | null; avatar_url: string | null; role: string;
  }[];
  const bookingBarbers = walkInBarbers.filter((b) => b.display_name?.trim());
  const queueLength = queueCountResult.count ?? 0;

  return (
    <div
      className="barber-dashboard min-h-screen bg-canvas text-foreground"
      style={
        primaryColor
          ? ({ ["--accent"]: primaryColor } as CSSProperties)
          : undefined
      }
    >
      {primaryColor ? (
        <div className="h-1.5 w-full bg-accent" aria-hidden />
      ) : null}
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-10">
        <header className="text-center mb-6">
          {logoUrl ? (
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={displayName}
                className="h-16 w-auto max-w-[240px] object-contain"
              />
            </div>
          ) : null}
          {showTitle ? <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1> : null}
          <p className={`text-xs text-muted uppercase tracking-widest ${showTitle ? "mt-2" : "mt-4"}`}>
            Walk-in &amp; bookings
          </p>
        </header>

        <ShopClientPortal
          shopId={shop.id}
          shopName={displayName}
          queueLength={queueLength}
          walkInBarbers={JSON.parse(JSON.stringify(walkInBarbers))}
          bookingBarbers={JSON.parse(JSON.stringify(bookingBarbers))}
          services={JSON.parse(JSON.stringify(services))}
          nextAvailableOnly={nextAvailableOnly}
          showServicesOnQueue={showServicesOnQueue}
        />
      </div>
    </div>
  );
}
