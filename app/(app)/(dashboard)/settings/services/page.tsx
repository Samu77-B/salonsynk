import { SettingsNav } from "../settings-nav";
import { ServicesView } from "../services-view";
import { getSettingsData } from "../data";

export default async function ServicesSettingsPage() {
  const data = await getSettingsData();

  return (
    <main className="p-4 md:p-6 max-w-2xl min-w-0">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <SettingsNav current="services" />
      <ServicesView
        salonId={data.context.salon.id}
        canManageServices={data.canManageServices}
        services={data.services}
      />
    </main>
  );
}
