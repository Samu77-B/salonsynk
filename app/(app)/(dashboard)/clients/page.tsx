import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClientsView, type ClientListRow } from "./clients-view";

export default async function ClientsPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, phone, patch_test_due_at")
    .eq("salon_id", context.salon.id)
    .order("name");

  const rows: ClientListRow[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    patch_test_due_at: c.patch_test_due_at,
  }));

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl p-4 md:p-6">
      <h1 className="mb-2 text-2xl font-bold">Clients</h1>
      <ClientsView salonId={context.salon.id} clients={rows} />
    </main>
  );
}
