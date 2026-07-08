import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardPage, DashboardPageHeader } from "@/components/dashboard/page-layout";
import { HelpView } from "./help-view";

export default async function HelpPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <DashboardPage width="default">
      <DashboardPageHeader
        title="Help & Support"
        description="Quick guides for each area of SalonSynk, plus a direct line to our team."
      />
      <HelpView salonName={context.salon.name} userEmail={user?.email ?? undefined} />
    </DashboardPage>
  );
}
