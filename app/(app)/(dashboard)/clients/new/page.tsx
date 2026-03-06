import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { redirect } from "next/navigation";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  return (
    <main className="p-4 md:p-6 max-w-lg min-w-0">
      <h1 className="text-2xl font-bold mb-4">Add client</h1>
      <ClientForm salonId={context.salon.id} />
    </main>
  );
}
