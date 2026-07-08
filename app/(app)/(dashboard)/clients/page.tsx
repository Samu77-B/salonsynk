import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardPage } from "@/components/dashboard/page-layout";
import { ClientsView, type ClientListRow } from "./clients-view";

export default async function ClientsPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  type ClientRow = { id: string; name: string | null; email: string | null; phone: string | null; sex?: string | null; patch_test_due_at: string | null; last_skin_test_at?: string | null };

  const supabase = await createClient();
  async function loadClients(): Promise<ClientRow[]> {
    const withSkinTest = await supabase
      .from("clients")
      .select("id, name, email, phone, sex, patch_test_due_at, last_skin_test_at")
      .eq("salon_id", context!.salon.id)
      .order("name");
    if (!withSkinTest.error) return (withSkinTest.data ?? []) as ClientRow[];
    const withSex = await supabase
      .from("clients")
      .select("id, name, email, phone, sex, patch_test_due_at")
      .eq("salon_id", context!.salon.id)
      .order("name");
    if (!withSex.error) return (withSex.data ?? []) as ClientRow[];
    return ((await supabase.from("clients").select("id, name, email, phone, patch_test_due_at").eq("salon_id", context!.salon.id).order("name")).data ?? []) as ClientRow[];
  }
  const clients = await loadClients();

  const photoMap = new Map<string, string>();
  try {
    const clientIds = (clients ?? []).map((c) => c.id);
    if (clientIds.length > 0) {
      const { data: profilePhotos } = await supabase
        .from("client_photos")
        .select("client_id, url")
        .in("client_id", clientIds)
        .eq("slot", "profile");
      for (const p of profilePhotos ?? []) {
        photoMap.set(
          (p as { client_id: string; url: string }).client_id,
          (p as { client_id: string; url: string }).url
        );
      }
    }
  } catch {
    // client_photos table may not exist yet
  }

  const rows: ClientListRow[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    sex: c.sex ?? null,
    patch_test_due_at: c.patch_test_due_at,
    last_skin_test_at: c.last_skin_test_at ?? null,
    profile_photo_url: photoMap.get(c.id) ?? null,
  }));

  return (
    <DashboardPage width="wide">
      <ClientsView salonId={context.salon.id} clients={rows} />
    </DashboardPage>
  );
}
