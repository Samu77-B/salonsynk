import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { createClient } from "@core/supabase/server";
import { redirect } from "next/navigation";
import { NailClientsView, type NailClientListRow } from "./clients-view";

export default async function NailClientsPage() {
  const context = await getCurrentUserNailSalon();
  if (!context) redirect("/nail/login");

  const supabase = await createClient();
  const { data: clients, error } = await supabase
    .from("nail_clients")
    .select("id, name, email, phone, patch_test_due_at, last_skin_test_at")
    .eq("salon_id", context.salon.id)
    .order("name");

  if (error) {
    console.error("[NailClientsPage]", error.message);
  }

  const rows: NailClientListRow[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    patch_test_due_at: c.patch_test_due_at,
    last_skin_test_at: c.last_skin_test_at ?? null,
  }));

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">Clients</h1>
      <NailClientsView salonId={context.salon.id} clients={rows} />
    </>
  );
}
