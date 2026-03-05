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
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!salon) notFound();

  const [servicesRes, membersRes] = await Promise.all([
    supabase.from("services").select("id, name, duration_minutes").eq("salon_id", salon.id),
    supabase.from("salon_members").select("id, display_name").eq("salon_id", salon.id).eq("is_active", true),
  ]);

  return (
    <main className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Book at {salon.name}</h1>
        <GuestBookingForm
          salonId={salon.id}
          salonName={salon.name}
          services={servicesRes.data ?? []}
          stylists={membersRes.data ?? []}
        />
      </div>
    </main>
  );
}
