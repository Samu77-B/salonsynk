import { SettingsNav } from "../settings/settings-nav";
import { ServicesView } from "../settings/services-view";
import { requireSalonFeature } from "@/lib/salon-features.server";
import { getSettingsData } from "../settings/data";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";
import { redirect } from "next/navigation";
import { DashboardPage, DashboardPageHeader } from "@/components/dashboard/page-layout";

export default async function ServicesPage() {
  await requireSalonFeature("service_catalog");
  const data = await getSettingsData();
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isManagerRole(isSuperAdmin, data.context.member.role ?? "")) redirect("/dashboard");

  return (
    <DashboardPage width="wide">
      <DashboardPageHeader
        title="Services"
        description="Categories, durations, prices, and diary colours for your menu."
      />
      <SettingsNav current="services" />
      <ServicesView
        salonId={data.context.salon.id}
        canManageServices={data.canManageServices}
        services={data.services}
        categories={data.categories}
      />
    </DashboardPage>
  );
}
