import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatFlatFee } from "@/config/subscription";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, slug, stripe_connect_account_id, subscription_status, settings")
    .eq("id", context.salon.id)
    .single();

  return (
    <main className="p-4 md:p-6 max-w-2xl min-w-0">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <SettingsView
        salonId={context.salon.id}
        salonName={salon?.name ?? context.salon.name}
        stripeConnectAccountId={salon?.stripe_connect_account_id ?? null}
        subscriptionStatus={salon?.subscription_status ?? "inactive"}
        formatFlatFee={formatFlatFee()}
      />
    </main>
  );
}
