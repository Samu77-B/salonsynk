import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CheckoutView } from "./checkout-view";

export default async function CheckoutPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const [clientsRes, servicesRes] = await Promise.all([
    supabase.from("clients").select("id, name, email").eq("salon_id", context.salon.id).order("name"),
    supabase.from("services").select("id, name, duration_minutes, price_minor").eq("salon_id", context.salon.id),
  ]);

  return (
    <main className="p-4 md:p-6 max-w-lg min-w-0">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      <CheckoutView
        salonId={context.salon.id}
        clients={clientsRes.data ?? []}
        services={servicesRes.data ?? []}
      />
    </main>
  );
}
