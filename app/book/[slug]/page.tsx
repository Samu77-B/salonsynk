import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { GuestBookingForm } from "./guest-booking-form";

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
  const primaryColor = branding.primary_color?.trim();
  const logoUrl = branding.logo_url?.trim();

  return (
    <main
      className="min-h-screen p-6 flex flex-col items-center"
      style={
        primaryColor
          ? ({ ["--accent"]: primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      <div className="w-full max-w-md space-y-6">
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
        <h1 className="text-2xl font-bold text-center">
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
