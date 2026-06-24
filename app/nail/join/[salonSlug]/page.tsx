import { notFound } from "next/navigation";
import { createAdminClient } from "@core/supabase/admin";
import { JoinQueueForm } from "./join-queue-form";

export const dynamic = "force-dynamic";

export default async function PublicJoinQueuePage({
  params,
}: {
  params: Promise<{ salonSlug: string }>;
}) {
  const { salonSlug } = await params;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    notFound();
  }

  const { data: salon } = await supabase
    .from("nail_salons")
    .select("id, name, slug, estimated_wait_visible, settings")
    .eq("slug", salonSlug)
    .single();

  if (!salon) notFound();

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | boolean | undefined>) ?? {};
  const brandingStr = (key: string) => {
    const v = branding[key];
    return typeof v === "string" ? v : "";
  };
  const displayName = brandingStr("company_name").trim() || salon.name;
  const primaryColor = brandingStr("primary_color").trim();
  const logoUrl = brandingStr("logo_url").trim();
  const showTitle = branding.show_title_on_queue !== false;
  const nextAvailableOnly = branding.next_available_only === true;
  const showServicesOnQueue = branding.show_services_on_queue !== false;

  const [servicesResult, techniciansResult, queueCountResult] = await Promise.all([
    supabase
      .from("nail_services")
      .select("id, name, duration_minutes, price_minor")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),

    supabase
      .from("nail_members")
      .select("id, display_name, station_number, avatar_url, role")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .eq("is_accepting_walk_ins", true)
      .order("display_name"),

    supabase
      .from("nail_queue")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "waiting"),
  ]);

  const services = (servicesResult.data ?? []) as {
    id: string; name: string; duration_minutes: number; price_minor: number;
  }[];
  const technicians = (techniciansResult.data ?? []) as {
    id: string;
    display_name: string | null;
    station_number: number | null;
    avatar_url: string | null;
    role: string;
  }[];
  const queueLength = queueCountResult.count ?? 0;

  return (
    <div
      className="app-shell-dark min-h-screen bg-canvas text-foreground"
      style={
        primaryColor
          ? ({ ["--accent"]: primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      {primaryColor ? (
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: primaryColor }}
          aria-hidden
        />
      ) : null}
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        <header className="text-center mb-8">
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
          {showTitle ? <h1 className="text-2xl font-bold">{displayName}</h1> : null}
          <p className={`text-sm text-muted ${showTitle ? "mt-1" : "mt-4"}`}>Walk-in Queue</p>
        </header>

        <JoinQueueForm
          salonId={salon.id}
          salonName={displayName}
          queueLength={queueLength}
          technicians={JSON.parse(JSON.stringify(technicians))}
          services={JSON.parse(JSON.stringify(services))}
          nextAvailableOnly={nextAvailableOnly}
          showServicesOnQueue={showServicesOnQueue}
        />
      </div>
    </div>
  );
}
