import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSmartAccess } from "@core/auth/smart-access";
import { SmartSidebar } from "@/components/smart/dashboard/smart-sidebar";
import { DashboardFooter } from "@/components/smart/dashboard/system-status";
import type { PlatformMembership } from "@core/auth/resolve-user-platform";

export async function SmartDashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const access = await getSmartAccess(user.id);
  if (!access.canAccess) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const userName = profile?.full_name || user.email?.split("@")[0] || "Owner";
  const locations: PlatformMembership[] = access.isSuperAdmin
    ? []
    : access.ownedLocations;

  return (
    <div className="smart-dashboard flex min-h-screen w-full bg-canvas text-foreground">
      <SmartSidebar
        userName={userName}
        userEmail={user.email ?? null}
        isSuperAdmin={access.isSuperAdmin}
        locations={locations}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {children}
        <DashboardFooter />
      </div>
    </div>
  );
}
