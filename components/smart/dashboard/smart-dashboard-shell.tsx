import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { SmartSidebar } from "@/components/smart/dashboard/smart-sidebar";
import { DashboardFooter } from "@/components/smart/dashboard/system-status";

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

  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const userName = profile?.full_name || user.email?.split("@")[0] || "Admin";

  return (
    <div className="smart-dashboard flex min-h-screen w-full bg-canvas text-foreground">
      <SmartSidebar userName={userName} userEmail={user.email ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">
        {children}
        <DashboardFooter />
      </div>
    </div>
  );
}
