import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { GuestBookingForm } from "../guest-booking-form";

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

  const [servicesRes, membersRes] = await Promise.all([
    supabase.from("services").select("id, name, duration_minutes").eq("salon_id", salon.id),
    supabase.from("salon_members").select("id, display_name").eq("salon_id", salon.id).eq("is_active", true),
  ]);

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const displayName = (branding.company_name?.trim() || salon.name) as string;
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
      <div className="w-full max-w-md space-y-4">
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
        <h1 className="text-xl font-bold text-center">
          Book at {displayName}
        </h1>
        <GuestBookingForm
          salonId={salon.id}
          salonName={displayName}
          services={servicesRes.data ?? []}
          stylists={membersRes.data ?? []}
        />
      </div>
    </main>
  );
}
