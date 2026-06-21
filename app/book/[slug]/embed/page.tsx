import { createAdminClient } from "@/lib/supabase/admin";
import { Reveal } from "@/components/reveal";
import { notFound } from "next/navigation";
import { GuestBookingForm } from "../guest-booking-form";
import { PublicBookingExperience } from "@/components/public/public-booking-experience";
import { fetchSalonMembersAdaptiveSelect, memberShowsOnDiary } from "@/lib/show-on-diary";

/**
 * Embeddable booking page for use in iframes on salon websites.
 * Use ?primary=HEX to override accent color to match the host site (e.g. ?primary=%23000 or ?primary=000).
 */
export default async function BookEmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ primary?: string }>;
}) {
  const { slug } = await params;
  const { primary: primaryOverride } = await searchParams;

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
    .single();

  if (!salon) notFound();

  const categoriesQuery = async () => {
    try {
      return await supabase
        .from("service_categories")
        .select("id, name, sort_order")
        .eq("salon_id", salon.id)
        .order("sort_order")
        .order("name");
    } catch {
      return { data: [] as { id: string; name: string; sort_order: number }[], error: null };
    }
  };

  const servicesQuery = async () => {
    const withCat = await supabase
      .from("services")
      .select("id, name, duration_minutes, category_id")
      .eq("salon_id", salon.id)
      .order("sort_order")
      .order("name");
    if (!withCat.error) return withCat;
    return supabase.from("services").select("id, name, duration_minutes").eq("salon_id", salon.id).order("name");
  };

  const [servicesRes, membersLoad, categoriesRes] = await Promise.all([
    servicesQuery(),
    fetchSalonMembersAdaptiveSelect(supabase, salon.id as string, [
      "id, display_name, show_on_diary",
      "id, display_name",
    ]),
    categoriesQuery(),
  ]);

  const stylistRowsEmbed = membersLoad.data as { id: string; display_name?: string | null; show_on_diary?: boolean | null }[];
  const bookableStylistsEmbed = stylistRowsEmbed
    .filter((m: { show_on_diary?: boolean | null }) => memberShowsOnDiary(m))
    .map((m) => ({
      id: m.id,
      display_name: m.display_name ?? null,
    }));

  const stylistOverrides: Record<string, Record<string, number>> = {};
  try {
    const memberIds = bookableStylistsEmbed.map((m: { id: string }) => m.id);
    if (memberIds.length > 0) {
      const { data: ov } = await supabase
        .from("stylist_service_overrides")
        .select("stylist_id, service_id, custom_duration_minutes")
        .in("stylist_id", memberIds);
      for (const o of ov ?? []) {
        const row = o as { stylist_id: string; service_id: string; custom_duration_minutes: number };
        if (!stylistOverrides[row.stylist_id]) stylistOverrides[row.stylist_id] = {};
        stylistOverrides[row.stylist_id][row.service_id] = row.custom_duration_minutes;
      }
    }
  } catch {
    // table may not exist yet
  }

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const displayName = (branding.company_name?.trim() || salon.name) as string;
  const bookingHeading = branding.booking_heading?.trim() ?? "";
  const brandingColor = branding.primary_color?.trim();
  // Allow host page to override accent via ?primary=hex (e.g. ?primary=000 or ?primary=%23000)
  const hex = primaryOverride?.trim();
  const primaryColor = hex
    ? (hex.startsWith("#") ? hex : `#${hex}`)
    : brandingColor;
  const logoUrl = branding.logo_url?.trim();

  return (
    <main
      className="min-h-0 p-4 flex flex-col items-center bg-background text-foreground"
      style={
        primaryColor
          ? ({ ["--accent"]: primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      <Reveal className="w-full max-w-md space-y-4">
        {logoUrl ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={displayName}
              className="h-12 w-auto object-contain object-center"
            />
          </div>
        ) : null}
        {bookingHeading ? (
          <h1 className="text-xl font-bold text-center">
            {bookingHeading}
          </h1>
        ) : null}
        <PublicBookingExperience
          slug={slug}
          salonName={displayName}
          form={
            <GuestBookingForm
              salonId={salon.id}
              salonName={displayName}
              services={(servicesRes.data ?? []).map((s) => {
                const row = s as { id: string; name: string; duration_minutes: number; category_id?: string | null };
                return { id: row.id, name: row.name, duration_minutes: row.duration_minutes, category_id: row.category_id ?? null };
              })}
              stylists={bookableStylistsEmbed}
              stylistOverrides={stylistOverrides}
              categories={((categoriesRes as { data?: { id: string; name: string; sort_order: number }[] | null }).data ?? []).map((c) => ({
                id: c.id,
                name: c.name,
              }))}
            />
          }
        />
      </Reveal>
    </main>
  );
}
