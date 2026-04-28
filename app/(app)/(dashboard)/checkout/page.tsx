import { Suspense } from "react";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CheckoutView } from "./checkout-view";

export default async function CheckoutPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const [clientsRes, servicesRes, productsRes, stylistsRes] = await Promise.all([
    supabase.from("clients").select("id, name, email").eq("salon_id", context.salon.id).order("name"),
    supabase.from("services").select("id, name, duration_minutes, price_minor").eq("salon_id", context.salon.id),
    supabase.from("products").select("id, name, price_minor").eq("salon_id", context.salon.id).eq("is_active", true),
    supabase.from("salon_members").select("id, display_name, employment_type").eq("salon_id", context.salon.id).eq("is_active", true),
  ]);

  const stylists = (stylistsRes.data ?? []).map((s) => ({
    id: s.id,
    displayName: s.display_name ?? "Stylist",
    employmentType: (s.employment_type as string) || "EMPLOYEE",
  }));

  const defaultStylistId =
    stylists.some((s) => s.id === context.member.id)
      ? context.member.id
      : stylists[0]?.id ?? "";

  return (
    <main className="mx-auto w-full min-w-0 max-w-lg p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading checkout…</p>}>
        <CheckoutView
          salonId={context.salon.id}
          clients={clientsRes.data ?? []}
          services={servicesRes.data ?? []}
          products={productsRes.data ?? []}
          stylists={stylists}
          defaultStylistId={defaultStylistId}
        />
      </Suspense>
    </main>
  );
}
