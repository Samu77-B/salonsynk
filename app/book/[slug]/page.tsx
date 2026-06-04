import { createAdminClient } from "@/lib/supabase/admin";
import { Reveal } from "@/components/reveal";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuestBookingForm } from "./guest-booking-form";
import { fetchSalonMembersAdaptiveSelect, memberShowsOnDiary } from "@/lib/show-on-diary";
import { salonRowHasFeature } from "@/lib/salon-features";

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    notFound();
  }
  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, slug, settings, plan_tier, feature_overrides")
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

  const stylistRows = membersLoad.data as { id: string; display_name?: string | null; show_on_diary?: boolean | null }[];
  const bookableStylists = stylistRows
    .filter((m: { show_on_diary?: boolean | null }) => memberShowsOnDiary(m))
    .map((m) => ({
      id: m.id,
      display_name: m.display_name ?? null,
    }));

  const stylistOverrides: Record<string, Record<string, number>> = {};
  try {
    const memberIds = bookableStylists.map((m: { id: string }) => m.id);
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
  const primaryColor = branding.primary_color?.trim();
  const logoUrl = branding.logo_url?.trim();
  const showShopLink = salonRowHasFeature(salon, "products_shop");

  return (
    <main
      className="flex min-h-screen w-full min-w-0 flex-col items-center px-4 py-6 sm:p-6"
      style={
        primaryColor
          ? ({ ["--accent"]: primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      <Reveal className="w-full min-w-0 max-w-md space-y-6">
        {showShopLink ? (
          <div className="flex justify-center">
            <Link
              href={`/shop/${slug}`}
              className="text-sm font-medium text-accent underline hover:opacity-90"
            >
              Shop products
            </Link>
          </div>
        ) : null}
        {logoUrl ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={displayName}
              className="h-14 w-auto object-contain object-center"
            />
          </div>
        ) : null}
        {bookingHeading ? (
          <h1 className="text-2xl font-bold text-center">
            {bookingHeading}
          </h1>
        ) : null}
        <GuestBookingForm
          salonId={salon.id}
          salonName={displayName}
          services={(servicesRes.data ?? []).map((s) => {
            const row = s as { id: string; name: string; duration_minutes: number; category_id?: string | null };
            return { id: row.id, name: row.name, duration_minutes: row.duration_minutes, category_id: row.category_id ?? null };
          })}
          stylists={bookableStylists}
          stylistOverrides={stylistOverrides}
          categories={((categoriesRes as { data?: { id: string; name: string; sort_order: number }[] | null }).data ?? []).map((c) => ({
            id: c.id,
            name: c.name,
          }))}
        />
      </Reveal>
    </main>
  );
}
