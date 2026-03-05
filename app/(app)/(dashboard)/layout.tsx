import { redirect } from "next/navigation";
import { getCurrentUserSalon } from "@/lib/supabase/salon";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const salonContext = await getCurrentUserSalon();
  if (!salonContext) redirect("/onboarding");
  return <>{children}</>;
}
