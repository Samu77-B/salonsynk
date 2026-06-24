import { createAdminClient } from "@core/supabase/admin";
import { Reveal } from "@/components/reveal";
import { notFound } from "next/navigation";
import { NailGuestBookingForm } from "./guest-booking-form";
import { memberShowsOnDiary } from "@/lib/show-on-diary";
import { NAIL_SITE } from "@core/config/nail-site";

export default async function NailBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ technician?: string; stylist?: string; start?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const technicianPrefill = sp.technician ?? sp.stylist;
  const startPrefill = sp.start;

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    notFound();
  }

  const { data: salon } = await supabase
    .from("nail_salons")
    .select("id, name, slug, settings")
    .eq("slug", slug)
    .single();

  if (!salon) notFound();

  const [servicesRes, membersRes, categoriesRes] = await Promise.all([
    supabase
      .from("nail_services")
      .select("id, name, duration_minutes, category_id")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("nail_members")
      .select("id, display_name, show_on_diary")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("role", { ascending: false }),
    supabase
      .from("nail_service_categories")
      .select("id, name, sort_order")
      .eq("salon_id", salon.id)
      .order("sort_order")
      .order("name"),
  ]);

  const technicianRows = (membersRes.data ?? []) as {
    id: string;
    display_name?: string | null;
    show_on_diary?: boolean | null;
  }[];

  const bookableTechnicians = technicianRows
    .filter((m) => memberShowsOnDiary(m))
    .map((m) => ({
      id: m.id,
      display_name: m.display_name ?? null,
    }));

  const technicianOverrides: Record<string, Record<string, number>> = {};
  try {
    const memberIds = bookableTechnicians.map((m) => m.id);
    if (memberIds.length > 0) {
      const { data: ov } = await supabase
        .from("nail_technician_service_overrides")
        .select("technician_id, service_id, duration_minutes")
        .in("technician_id", memberIds);
      for (const o of ov ?? []) {
        const row = o as { technician_id: string; service_id: string; duration_minutes: number };
        if (!technicianOverrides[row.technician_id]) technicianOverrides[row.technician_id] = {};
        technicianOverrides[row.technician_id][row.service_id] = row.duration_minutes;
      }
    }
  } catch {
    /* table may not exist yet */
  }

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const displayName = (branding.company_name?.trim() || salon.name) as string;
  const bookingHeading = branding.booking_heading?.trim() ?? "";
  const primaryColor = branding.primary_color?.trim();
  const logoUrl = branding.logo_url?.trim();

  return (
    <main
      className="app-shell-dark flex min-h-screen w-full min-w-0 flex-col items-center px-4 py-6 sm:p-6 bg-canvas text-foreground"
      style={primaryColor ? ({ ["--accent"]: primaryColor } as React.CSSProperties) : undefined}
    >
      <Reveal className="w-full min-w-0 max-w-md space-y-6">
        <p className="text-center text-xs text-muted">{NAIL_SITE.name}</p>
        {logoUrl ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={displayName} className="h-14 w-auto object-contain object-center" />
          </div>
        ) : null}
        <h1 className="text-2xl font-bold text-center">{bookingHeading || `Book at ${displayName}`}</h1>
        <NailGuestBookingForm
          salonId={salon.id}
          salonName={displayName}
          services={(servicesRes.data ?? []).map((s) => {
            const row = s as {
              id: string;
              name: string;
              duration_minutes: number;
              category_id?: string | null;
            };
            return {
              id: row.id,
              name: row.name,
              duration_minutes: row.duration_minutes,
              category_id: row.category_id ?? null,
            };
          })}
          technicians={bookableTechnicians}
          technicianOverrides={technicianOverrides}
          categories={((categoriesRes.data ?? []) as { id: string; name: string }[]).map((c) => ({
            id: c.id,
            name: c.name,
          }))}
          prefillTechnicianId={technicianPrefill}
          prefillStartIso={startPrefill}
        />
      </Reveal>
    </main>
  );
}
