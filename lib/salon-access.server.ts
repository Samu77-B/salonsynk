import "server-only";

import { cookies } from "next/headers";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";

const ADMIN_SALON_COOKIE = "admin_salon_id";

/** Master admin can configure salons before the owner pays. */
export async function canBypassSalonSubscriptionGate(): Promise<boolean> {
  return getIsSuperAdmin();
}

export async function getAdminSalonSwitchId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SALON_COOKIE)?.value?.trim() || null;
}
