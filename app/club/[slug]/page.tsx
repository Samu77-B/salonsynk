import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBookingPolicy } from "@/lib/booking-policy";
import { clubCookieName, decodeClubSession } from "@/lib/club/session";
import { ClubLoginForm, ClubPortalView } from "./club-portal";
import { Reveal } from "@/components/reveal";

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    notFound();
  }

  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, slug, settings")
    .eq("slug", slug)
    .maybeSingle();
  if (!salon) notFound();

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const displayName = branding.company_name?.trim() || salon.name;
  const policy = parseBookingPolicy(salon.slug as string, settings, displayName as string);
  if (!policy.clubPortalEnabled) notFound();

  const primaryColor = branding.primary_color?.trim() || undefined;
  const logoUrl = branding.logo_url?.trim() || undefined;

  const jar = await cookies();
  const session = decodeClubSession(jar.get(clubCookieName())?.value);
  const sessionOk = session && session.salonId === salon.id && session.slug === salon.slug;

  let portal: ReactNode = <ClubLoginForm slug={slug} clubName={policy.clubName} />;

  if (sessionOk && session) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, email, phone")
      .eq("id", session.clientId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (client) {
      const [{ data: inc }, { data: appts }] = await Promise.all([
        supabase
          .from("client_incentives")
          .select("service_points, product_points, points, total_visits, tier")
          .eq("salon_id", salon.id)
          .eq("client_id", client.id)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("id, start_time, status, services(name)")
          .eq("salon_id", salon.id)
          .eq("client_id", client.id)
          .order("start_time", { ascending: false })
          .limit(12),
      ]);

      const visits = (appts ?? []).map((row) => {
        const r = row as {
          id: string;
          start_time: string;
          status: string;
          services?: { name?: string } | { name?: string }[] | null;
        };
        const svc = Array.isArray(r.services) ? r.services[0]?.name : r.services?.name;
        return {
          id: r.id,
          startTime: r.start_time,
          status: r.status,
          serviceName: svc ?? null,
        };
      });

      portal = (
        <ClubPortalView
          clubName={policy.clubName}
          salonName={displayName as string}
          client={{ name: client.name, email: client.email, phone: client.phone }}
          loyalty={
            inc
              ? {
                  servicePoints: (inc.service_points as number | null) ?? (inc.points as number) ?? 0,
                  productPoints: (inc.product_points as number | null) ?? 0,
                  totalVisits: (inc.total_visits as number | null) ?? visits.length,
                  tier: (inc.tier as string | null) ?? "bronze",
                }
              : {
                  servicePoints: 0,
                  productPoints: 0,
                  totalVisits: visits.length,
                  tier: "bronze",
                }
          }
          visits={visits}
        />
      );
    }
  }

  return (
    <main
      className="flex min-h-screen w-full flex-col items-center px-4 py-6 sm:p-6"
      style={primaryColor ? ({ ["--accent"]: primaryColor } as React.CSSProperties) : undefined}
    >
      <Reveal className="w-full max-w-md space-y-6">
        {logoUrl ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={displayName as string} className="h-14 w-auto object-contain" />
          </div>
        ) : null}
        <h1 className="text-center text-2xl font-bold">{policy.clubName}</h1>
        <p className="text-center text-sm text-muted">
          Your {displayName} client club — details, points, and visits.
        </p>
        {portal}
        <p className="text-center text-sm">
          <Link href={`/book/${slug}`} className="text-accent underline">
            Book an appointment
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
