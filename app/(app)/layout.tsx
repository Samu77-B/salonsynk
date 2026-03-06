import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppHeader } from "./app-header";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";

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

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <AppHeader userEmail={user.email} isSuperAdmin={isSuperAdmin} />
      {children}
    </div>
  );
}
