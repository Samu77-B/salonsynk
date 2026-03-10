import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HelpView } from "./help-view";

export default async function HelpPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="p-4 md:p-6 max-w-3xl min-w-0">
      <HelpView salonName={context.salon.name} userEmail={user?.email ?? undefined} />
    </main>
  );
}
