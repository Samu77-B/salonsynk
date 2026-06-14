import { createClient } from "@core/supabase/server";
import { redirect } from "next/navigation";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { isManagerRole } from "@core/auth/dashboard-roles";
import { BarberDashboardHeader } from "./barber-dashboard-header";

export default async function BarberDashboardLayout({
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
  const shopContext = await getCurrentUserShop();
  if (!shopContext) redirect("/onboarding");

  const memberRole = shopContext.member.role ?? null;
  const isManager = isManagerRole(isSuperAdmin, memberRole ?? "");
  const isOwner = memberRole === "owner" || shopContext.member.id === "admin";

  return (
    <div className="app-shell-dark min-h-screen flex flex-col overflow-x-hidden bg-canvas text-foreground">
      <BarberDashboardHeader
        shopName={shopContext.shop.name}
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
