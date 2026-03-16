import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppHeader } from "./app-header";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { getCurrentUserSalon } from "@/lib/supabase/salon";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isSuperAdmin = await getIsSuperAdmin();
  const salonContext = await getCurrentUserSalon();

  let adminSalons: { id: string; name: string }[] = [];
  if (isSuperAdmin) {
    const { data } = await supabase
      .from("salons")
      .select("id, name")
      .order("name");
    adminSalons = (data ?? []).map((s) => ({ id: s.id, name: s.name }));
  }

  return (
    <div className="app-shell-dark min-h-screen flex flex-col overflow-x-hidden bg-background text-foreground">
      <AppHeader
        userEmail={user.email}
        isSuperAdmin={isSuperAdmin}
        currentSalon={salonContext?.salon}
        adminSalons={adminSalons}
      />
      <main className="flex-1 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-foreground">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
