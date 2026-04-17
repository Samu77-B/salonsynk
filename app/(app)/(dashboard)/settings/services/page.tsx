import { redirect } from "next/navigation";
import { getSettingsData } from "../data";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";

export default async function ServicesSettingsRedirectPage() {
  const data = await getSettingsData();
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isManagerRole(isSuperAdmin, data.context.member.role ?? "")) redirect("/dashboard");
  redirect("/services");
}
