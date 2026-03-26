import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl p-4 md:p-6">
      <Link href="/clients" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        Back to clients
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Add client</h1>
      <p className="mb-6 text-sm text-muted">Create a new client record. You can add more detail after saving.</p>
      <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-base font-semibold">New client</h2>
        <ClientForm salonId={context.salon.id} />
      </div>
    </main>
  );
}
