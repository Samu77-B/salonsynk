import { createAdminClient } from "@/lib/supabase/admin";
import { Reveal } from "@/components/reveal";
import { notFound } from "next/navigation";
import { GuestBookingForm } from "../guest-booking-form";
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

  const [servicesRes, membersLoad] = await Promise.all([
    supabase.from("services").select("id, name, duration_minutes").eq("salon_id", salon.id),
    fetchSalonMembersAdaptiveSelect(supabase, salon.id as string, [
      "id, display_name, show_on_diary",
      "id, display_name",
    ]),
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
        <GuestBookingForm
          salonId={salon.id}
          salonName={displayName}
          services={servicesRes.data ?? []}
          stylists={bookableStylistsEmbed}
          stylistOverrides={stylistOverrides}
        />
      </Reveal>
    </main>
  );
}
