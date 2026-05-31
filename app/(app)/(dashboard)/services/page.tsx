import { SettingsNav } from "../settings/settings-nav";
import { ServicesView } from "../settings/services-view";
import { requireSalonFeature } from "@/lib/salon-features.server";
import { getSettingsData } from "../settings/data";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";
import { redirect } from "next/navigation";

export default async function ServicesPage() {
  await requireSalonFeature("service_catalog");
  const data = await getSettingsData();
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isManagerRole(isSuperAdmin, data.context.member.role ?? "")) redirect("/dashboard");

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-2">Services</h1>
      <SettingsNav current="services" />
      <ServicesView
        salonId={data.context.salon.id}
        canManageServices={data.canManageServices}
        services={data.services}
      />
    </main>
  );
}
