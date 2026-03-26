import { SettingsNav } from "../settings/settings-nav";
import { ServicesView } from "../settings/services-view";
import { getSettingsData } from "../settings/data";

export default async function ServicesPage() {
  const data = await getSettingsData();

  return (
    <main className="p-4 md:p-6 max-w-5xl min-w-0">
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
