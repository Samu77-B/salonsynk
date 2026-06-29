import { createClient } from "@core/supabase/server";
import { redirect } from "next/navigation";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { isManagerRole } from "@core/auth/dashboard-roles";
import { NailDashboardHeader } from "./nail-dashboard-header";
import { enforceNailSubscriptionIfRequired } from "@/lib/subscription-gate-platform.server";

export default async function NailDashboardLayout({
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
  const salonContext = await getCurrentUserNailSalon();
  if (!salonContext) redirect("/nail/onboarding");

  await enforceNailSubscriptionIfRequired();

  const memberRole = salonContext.member.role ?? null;
  const isManager = isManagerRole(isSuperAdmin, memberRole ?? "");
  const isOwner = memberRole === "owner" || salonContext.member.id === "admin";

  return (
    <div className="app-shell-dark min-h-screen flex flex-col overflow-x-hidden bg-canvas text-foreground">
      <NailDashboardHeader
        salonName={salonContext.salon.name}
        userEmail={user.email ?? null}
        isOwner={isOwner}
        isManager={isManager}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col text-foreground">
        <div className="mx-auto w-full min-w-0 max-w-[1600px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
