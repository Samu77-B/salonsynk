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
    .select("id, name, email, phone, sex, patch_test_due_at")
    .eq("salon_id", context.salon.id)
    .order("name");

  const clientIds = (clients ?? []).map((c) => c.id);
  const { data: profilePhotos } = clientIds.length > 0
    ? await supabase
        .from("client_photos")
        .select("client_id, url")
        .in("client_id", clientIds)
        .eq("slot", "profile")
    : { data: [] };

  const photoMap = new Map(
    (profilePhotos ?? []).map((p: { client_id: string; url: string }) => [p.client_id, p.url])
  );

  const rows: ClientListRow[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    sex: c.sex ?? null,
    patch_test_due_at: c.patch_test_due_at,
    profile_photo_url: photoMap.get(c.id) ?? null,
  }));

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl p-4 md:p-6">
      <h1 className="mb-2 text-2xl font-bold">Clients</h1>
      <ClientsView salonId={context.salon.id} clients={rows} />
    </main>
  );
}
