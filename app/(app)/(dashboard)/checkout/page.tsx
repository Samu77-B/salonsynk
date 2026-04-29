import { Suspense } from "react";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchSalonMembersAdaptiveSelect, memberShowsOnDiary } from "@/lib/show-on-diary";
import { CheckoutView } from "./checkout-view";

export default async function CheckoutPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const [clientsRes, servicesRes, productsRes] = await Promise.all([
    supabase.from("clients").select("id, name, email").eq("salon_id", context.salon.id).order("name"),
    supabase.from("services").select("id, name, duration_minutes, price_minor").eq("salon_id", context.salon.id),
    supabase
      .from("products")
      .select("id, name, price_minor, product_services(service_id)")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true),
  ]);

  type ProductRowRaw = {
    id: string;
    name: string;
    price_minor: number | null;
    product_services?: { service_id: string }[] | null;
  };

  const products =
    (productsRes.data ?? []).map((r) => {
      const row = r as ProductRowRaw;
      const linked =
        row.product_services?.map((x) => x.service_id).filter((id): id is string => typeof id === "string") ?? [];
      return {
        id: row.id,
        name: row.name,
        price_minor: row.price_minor ?? 0,
        linkedServiceIds: linked,
      };
    });

  const stylistsLoad = await fetchSalonMembersAdaptiveSelect(supabase, context.salon.id, [
    "id, display_name, employment_type, show_on_diary",
    "id, display_name, employment_type",
  ]);
  if (stylistsLoad.error) {
    console.error("[CheckoutPage] salon_members load failed:", stylistsLoad.error.message);
  }

  const stylists = (stylistsLoad.data as { id: string; display_name?: string | null; employment_type?: string | null; show_on_diary?: boolean | null }[])
    .filter((s) => memberShowsOnDiary(s as { show_on_diary?: boolean | null }))
    .map((s) => ({
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
          products={products}
          stylists={stylists}
          defaultStylistId={defaultStylistId}
        />
      </Suspense>
    </main>
  );
}
