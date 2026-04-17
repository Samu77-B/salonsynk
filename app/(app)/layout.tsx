import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LoggedInAppShell } from "./logged-in-app-shell";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { isManagerRole } from "@/lib/dashboard-roles";

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
  const memberRole = salonContext?.member.role ?? null;
  const isManager = isManagerRole(isSuperAdmin, memberRole ?? "");

  let adminSalons: { id: string; name: string }[] = [];
  if (isSuperAdmin) {
    const { data } = await supabase
      .from("salons")
      .select("id, name")
      .order("name");
    adminSalons = (data ?? []).map((s) => ({ id: s.id, name: s.name }));
  }

  return (
    <LoggedInAppShell
      userEmail={user.email}
      isSuperAdmin={isSuperAdmin}
      isManager={isManager}
      memberRole={memberRole}
      currentSalon={salonContext?.salon}
      adminSalons={adminSalons}
    >
      {children}
    </LoggedInAppShell>
  );
}
