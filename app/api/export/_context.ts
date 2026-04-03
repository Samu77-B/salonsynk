import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { canViewReports } from "@/lib/dashboard-roles";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExportSalonContext = {
  salonId: string;
  salonName: string;
  supabase: SupabaseClient;
};

export async function getExportContext(): Promise<ExportSalonContext | null> {
  const context = await getCurrentUserSalon();
  if (!context) return null;
  const isSuperAdmin = await getIsSuperAdmin();
  if (!canViewReports(isSuperAdmin, context.member.role ?? "")) return null;
  const supabase = await createClient();
  return {
    salonId: context.salon.id,
    salonName: context.salon.name,
    supabase,
  };
}
